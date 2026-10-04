import { count, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { assets, breaches, exposures, leakRecords, scans, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { addDays, type IsoDate } from "@/lib/dates";
import { dueDateFor } from "@/lib/exposure";
import { emailDomain, hashEmail, maskEmail } from "@/lib/identity";
import { loadCatalog, type CatalogEntry } from "./catalog";

export const DEMO_EMAIL = "analyst@breachwatch.dev";
export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_NAME = "Ada Okafor";

type SeedExposure = { breach: string; detected: number; resolved?: number; steps?: string[]; notes?: string };
type SeedIdentity = { email: string; exposures: SeedExposure[]; pending?: string[] };

/**
 * Leak index for the demo. `exposures` were already found by earlier scans
 * (days are relative to today). `pending` records are in the index but not yet
 * detected, so the next scan finds them.
 */
const IDENTITIES: SeedIdentity[] = [
  {
    email: "ada.okafor@example.com",
    exposures: [
      { breach: "LinkedIn", detected: -420, resolved: -418, steps: ["change-password", "reused-passwords", "enable-mfa", "phishing-watch"] },
      { breach: "Adobe", detected: -420, resolved: -415, steps: ["change-password", "reused-passwords", "enable-mfa", "phishing-watch"] },
      { breach: "Twitter200M", detected: -60, resolved: -50, steps: ["phishing-watch", "enable-mfa"] },
      { breach: "Canva", detected: -5, steps: ["change-password"], notes: "Changed Canva password. Still need to check other sites that used the same one." },
      { breach: "Deezer", detected: -10 },
      { breach: "Wattpad", detected: -1 },
    ],
    pending: ["Fanlore"],
  },
  {
    email: "a.okafor@northwind.example",
    exposures: [
      { breach: "Dropbox", detected: -300, resolved: -299, steps: ["change-password", "reused-passwords", "enable-mfa", "phishing-watch"] },
      { breach: "Ticketcounter", detected: -40, resolved: -30, steps: ["contact-bank", "credit-freeze", "phishing-watch", "enable-mfa"], notes: "Resolved late: waited for the bank to reissue the card." },
      { breach: "Trello", detected: -4 },
    ],
    pending: ["RingCentral"],
  },
  {
    email: "ada.o@uni.example",
    exposures: [
      { breach: "Chegg", detected: -30, resolved: -28, steps: ["change-password", "reused-passwords", "enable-mfa", "phishing-watch"] },
      { breach: "Duolingo", detected: -2 },
    ],
    pending: ["Chess2026"],
  },
  // Colleagues on the company domain, found through the domain asset.
  { email: "j.mensah@northwind.example", exposures: [{ breach: "MyFitnessPal", detected: -9 }] },
  { email: "k.bello@northwind.example", exposures: [{ breach: "Carhartt", detected: -3 }] },
  { email: "hr@northwind.example", exposures: [{ breach: "Dubsmash", detected: -100, resolved: -98, steps: ["change-password", "reused-passwords", "enable-mfa", "phishing-watch"] }] },
  { email: "t.adeyemi@northwind.example", exposures: [], pending: ["ManchesterAirportsGroup"] },
  // Not monitored by anyone yet: add this address during the demo and run a scan.
  { email: "demo.user@example.net", exposures: [], pending: ["Zynga", "Dailymotion", "Lastfm", "Gravatar"] },
  { email: "sam.lee@example.net", exposures: [], pending: ["LinkedIn", "Canva"] },
];

const ASSETS = [
  { kind: "email" as const, value: "ada.okafor@example.com", label: "Personal" },
  { kind: "email" as const, value: "a.okafor@northwind.example", label: "Work" },
  { kind: "email" as const, value: "ada.o@uni.example", label: "Student" },
  { kind: "email" as const, value: "ada.backup@example.org", label: "Recovery" },
  { kind: "domain" as const, value: "northwind.example", label: "Company domain" },
];

export async function isEmpty(db: Db): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(users);
  return n === 0;
}

export async function resetDatabase(db: Db): Promise<void> {
  await db.execute(sql`TRUNCATE scans, exposures, assets, leak_records, breaches, users RESTART IDENTITY CASCADE`);
}

export async function seedDemo(db: Db, catalog: CatalogEntry[], today: IsoDate): Promise<{ breaches: number; exposures: number }> {
  const breachCount = await loadCatalog(db, catalog);
  const all = await db.select({ id: breaches.id, name: breaches.name, severity: breaches.severity }).from(breaches);
  const byName = new Map(all.map((b) => [b.name, b]));
  const need = (name: string) => {
    const b = byName.get(name);
    if (!b) throw new Error(`Seed breach ${name} is not in the catalog`);
    return b;
  };

  // Leak index
  const leakRows = IDENTITIES.flatMap((i) =>
    [...i.exposures.map((e) => e.breach), ...(i.pending ?? [])].map((name) => ({
      emailHash: hashEmail(i.email),
      emailMasked: maskEmail(i.email),
      emailDomain: emailDomain(i.email),
      breachId: need(name).id,
    })),
  );
  await db.insert(leakRecords).values(leakRows).onConflictDoNothing();

  // Demo user and assets
  const [user] = await db
    .insert(users)
    .values({ name: DEMO_NAME, email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD) })
    .returning({ id: users.id });
  const created = await db
    .insert(assets)
    .values(ASSETS.map((a) => ({ ...a, userId: user.id, lastScannedOn: addDays(today, -1) })))
    .returning({ id: assets.id, kind: assets.kind, value: assets.value });
  const assetFor = (email: string) =>
    created.find((a) => a.kind === "email" && a.value === email) ?? created.find((a) => a.kind === "domain" && a.value === emailDomain(email));

  // Exposures already found by earlier scans
  const exposureRows = IDENTITIES.flatMap((i) =>
    i.exposures.map((e) => {
      const b = need(e.breach);
      const asset = assetFor(i.email);
      if (!asset) throw new Error(`No asset covers ${i.email}`);
      const detectedOn = addDays(today, e.detected);
      return {
        userId: user.id,
        assetId: asset.id,
        breachId: b.id,
        emailHash: hashEmail(i.email),
        emailMasked: maskEmail(i.email),
        severity: b.severity,
        detectedOn,
        dueOn: dueDateFor(detectedOn, b.severity),
        resolvedOn: e.resolved === undefined ? null : addDays(today, e.resolved),
        stepsDone: e.steps ?? [],
        notes: e.notes ?? "",
      };
    }),
  );
  await db.insert(exposures).values(exposureRows);

  await db.insert(scans).values([
    { userId: user.id, ranOn: addDays(today, -5), ranAt: new Date(`${addDays(today, -5)}T08:15:00Z`), assetsChecked: 5, recordsMatched: 9, newExposures: 1 },
    { userId: user.id, ranOn: addDays(today, -1), ranAt: new Date(`${addDays(today, -1)}T08:15:00Z`), assetsChecked: 5, recordsMatched: 14, newExposures: 1 },
  ]);

  return { breaches: breachCount, exposures: exposureRows.length };
}
