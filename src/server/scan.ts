import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { assets, breaches, exposures, leakRecords, scans } from "@/db/schema";
import type { IsoDate } from "@/lib/dates";
import { dueDateFor } from "@/lib/exposure";
import { hashEmail, maskEmail } from "@/lib/identity";
import type { Severity } from "@/lib/severity";

export type ScanLogLine = { level: "info" | "hit" | "ok" | "warn"; text: string };

export type ScanResult = {
  assetsChecked: number;
  recordsMatched: number;
  newExposures: number;
  log: ScanLogLine[];
};

/** Optional live lookup (Have I Been Pwned breachedaccount API). Returns breach names. */
export type LiveLookup = (email: string) => Promise<string[]>;

type Match = { breachId: number; breachName: string; severity: Severity; emailHash: string; emailMasked: string };

/**
 * Checks every asset the user monitors against the leak index and records new
 * exposures. Email assets are scanned before domains, so an address that is
 * monitored directly owns its findings.
 */
export async function runScan(db: Db, userId: number, today: IsoDate, live?: LiveLookup): Promise<ScanResult> {
  const log: ScanLogLine[] = [];
  const mine = await db.select().from(assets).where(eq(assets.userId, userId));
  mine.sort((a, b) => (a.kind === b.kind ? a.id - b.id : a.kind === "email" ? -1 : 1));
  log.push({ level: "info", text: `Loaded ${mine.length} monitored asset(s)` });

  let recordsMatched = 0;
  let newExposures = 0;

  for (const asset of mine) {
    const matches: Match[] = [];
    if (asset.kind === "email") {
      const rows = await db
        .select({ breachId: breaches.id, breachName: breaches.name, severity: breaches.severity, emailHash: leakRecords.emailHash, emailMasked: leakRecords.emailMasked })
        .from(leakRecords)
        .innerJoin(breaches, eq(breaches.id, leakRecords.breachId))
        .where(eq(leakRecords.emailHash, hashEmail(asset.value)));
      matches.push(...rows);

      if (live) {
        try {
          const names = await live(asset.value);
          if (names.length) {
            const found = await db.select().from(breaches).where(inArray(breaches.name, names));
            for (const b of found) {
              if (!matches.some((m) => m.breachId === b.id)) {
                matches.push({ breachId: b.id, breachName: b.name, severity: b.severity, emailHash: hashEmail(asset.value), emailMasked: maskEmail(asset.value) });
              }
            }
          }
        } catch (err) {
          log.push({ level: "warn", text: `Live lookup failed for ${maskEmail(asset.value)}: ${(err as Error).message}` });
        }
      }
    } else {
      const rows = await db
        .select({ breachId: breaches.id, breachName: breaches.name, severity: breaches.severity, emailHash: leakRecords.emailHash, emailMasked: leakRecords.emailMasked })
        .from(leakRecords)
        .innerJoin(breaches, eq(breaches.id, leakRecords.breachId))
        .where(eq(leakRecords.emailDomain, asset.value));
      matches.push(...rows);
    }

    recordsMatched += matches.length;
    const target = asset.kind === "email" ? maskEmail(asset.value) : `*@${asset.value}`;
    let added = 0;
    for (const m of matches) {
      const inserted = await db
        .insert(exposures)
        .values({
          userId,
          assetId: asset.id,
          breachId: m.breachId,
          emailHash: m.emailHash,
          emailMasked: m.emailMasked,
          severity: m.severity,
          detectedOn: today,
          dueOn: dueDateFor(today, m.severity),
        })
        .onConflictDoNothing()
        .returning({ id: exposures.id });
      if (inserted.length) {
        added++;
        log.push({ level: "hit", text: `NEW ${m.severity.toUpperCase()} ${m.emailMasked} found in ${m.breachName}` });
      }
    }
    newExposures += added;
    log.push({
      level: matches.length ? "info" : "ok",
      text: `${target}: ${matches.length} record(s) in leak index, ${added} new`,
    });
    await db.update(assets).set({ lastScannedOn: today }).where(and(eq(assets.id, asset.id), eq(assets.userId, userId)));
  }

  await db.insert(scans).values({ userId, ranOn: today, assetsChecked: mine.length, recordsMatched, newExposures, usedLiveApi: Boolean(live) });
  log.push({ level: newExposures ? "warn" : "ok", text: `Scan complete: ${newExposures} new exposure(s)` });
  return { assetsChecked: mine.length, recordsMatched, newExposures, log };
}

/** Live lookup against the paid HIBP API, used only when HIBP_API_KEY is set. */
export function hibpLookup(apiKey: string): LiveLookup {
  return async (email) => {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`, {
      headers: { "hibp-api-key": apiKey, "user-agent": "BreachWatch-student-project" },
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`HIBP responded ${res.status}`);
    const body = (await res.json()) as { Name: string }[];
    return body.map((b) => b.Name);
  };
}
