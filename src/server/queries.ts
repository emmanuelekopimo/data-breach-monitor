import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { assets, breaches, exposures, scans, users } from "@/db/schema";
import type { IsoDate } from "@/lib/dates";
import { compareForQueue, exposureStatus, summarize, type ExposureStatus } from "@/lib/exposure";
import { isKnownStep } from "@/lib/remediation";
import type { Severity } from "@/lib/severity";

// Every function that reads or writes user data takes userId and filters on it.

export async function getUserById(db: Db, userId: number) {
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId));
  return u ?? null;
}

export async function getUserByEmail(db: Db, email: string) {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return u ?? null;
}

export type ExposureRow = {
  id: number;
  severity: Severity;
  detectedOn: string;
  dueOn: string;
  resolvedOn: string | null;
  emailMasked: string;
  stepsDone: string[];
  notes: string;
  assetId: number;
  assetValue: string;
  assetKind: "email" | "domain";
  assetLabel: string;
  breachId: number;
  breachName: string;
  breachTitle: string;
  breachDomain: string | null;
  breachDate: string;
  pwnCount: number;
  dataClasses: string[];
  description: string;
};

const exposureColumns = {
  id: exposures.id,
  severity: exposures.severity,
  detectedOn: exposures.detectedOn,
  dueOn: exposures.dueOn,
  resolvedOn: exposures.resolvedOn,
  emailMasked: exposures.emailMasked,
  stepsDone: exposures.stepsDone,
  notes: exposures.notes,
  assetId: assets.id,
  assetValue: assets.value,
  assetKind: assets.kind,
  assetLabel: assets.label,
  breachId: breaches.id,
  breachName: breaches.name,
  breachTitle: breaches.title,
  breachDomain: breaches.domain,
  breachDate: breaches.breachDate,
  pwnCount: breaches.pwnCount,
  dataClasses: breaches.dataClasses,
  description: breaches.description,
};

export async function listExposures(db: Db, userId: number, today: IsoDate): Promise<ExposureRow[]> {
  const rows = await db
    .select(exposureColumns)
    .from(exposures)
    .innerJoin(assets, eq(assets.id, exposures.assetId))
    .innerJoin(breaches, eq(breaches.id, exposures.breachId))
    .where(eq(exposures.userId, userId));
  return rows.sort(compareForQueue<ExposureRow>(today));
}

export async function getExposure(db: Db, userId: number, id: number): Promise<ExposureRow | null> {
  const [row] = await db
    .select(exposureColumns)
    .from(exposures)
    .innerJoin(assets, eq(assets.id, exposures.assetId))
    .innerJoin(breaches, eq(breaches.id, exposures.breachId))
    .where(and(eq(exposures.userId, userId), eq(exposures.id, id)));
  return row ?? null;
}

export function filterExposures(rows: ExposureRow[], today: IsoDate, filter: { status?: string; severity?: string; q?: string }) {
  const q = filter.q?.trim().toLowerCase();
  return rows.filter((r) => {
    const status = exposureStatus(r, today);
    if (filter.status === "active" && status === "resolved") return false;
    if (filter.status && filter.status !== "all" && filter.status !== "active" && status !== (filter.status as ExposureStatus)) return false;
    if (filter.severity && filter.severity !== "all" && r.severity !== filter.severity) return false;
    if (q && !`${r.breachTitle} ${r.emailMasked} ${r.assetValue} ${r.assetLabel}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export async function listAssets(db: Db, userId: number, today: IsoDate) {
  const list = await db.select().from(assets).where(eq(assets.userId, userId)).orderBy(asc(assets.kind), asc(assets.id));
  const rows = await listExposures(db, userId, today);
  return list.map((a) => {
    const mine = rows.filter((r) => r.assetId === a.id);
    return { ...a, exposures: mine.length, summary: summarize(mine, today) };
  });
}

export async function getDashboard(db: Db, userId: number, today: IsoDate) {
  const rows = await listExposures(db, userId, today);
  const [assetCount] = await db.select({ n: count() }).from(assets).where(eq(assets.userId, userId));
  const recentScans = await db.select().from(scans).where(eq(scans.userId, userId)).orderBy(desc(scans.ranAt)).limit(5);
  const latestBreaches = await db.select().from(breaches).orderBy(desc(breaches.addedDate), desc(breaches.pwnCount)).limit(5);
  return {
    summary: summarize(rows, today),
    queue: rows.filter((r) => exposureStatus(r, today) !== "resolved").slice(0, 6),
    recent: [...rows].sort((a, b) => b.detectedOn.localeCompare(a.detectedOn) || b.id - a.id).slice(0, 5),
    assetCount: assetCount.n,
    recentScans,
    latestBreaches,
  };
}

export const CATALOG_PAGE_SIZE = 24;

export async function searchCatalog(db: Db, opts: { q?: string; severity?: string; page?: number }) {
  const conds = [];
  const q = opts.q?.trim();
  if (q) conds.push(or(ilike(breaches.title, `%${q}%`), ilike(breaches.domain, `%${q}%`), ilike(breaches.name, `%${q}%`)));
  if (opts.severity && opts.severity !== "all") conds.push(eq(breaches.severity, opts.severity as Severity));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const [{ n }] = await db.select({ n: count() }).from(breaches).where(where);
  const rows = await db
    .select()
    .from(breaches)
    .where(where)
    .orderBy(desc(breaches.breachDate), desc(breaches.pwnCount))
    .limit(CATALOG_PAGE_SIZE)
    .offset((page - 1) * CATALOG_PAGE_SIZE);
  const [totals] = await db.select({ breaches: count(), accounts: sql<number>`coalesce(sum(${breaches.pwnCount}), 0)::bigint` }).from(breaches);
  return { rows, total: n, page, pages: Math.max(1, Math.ceil(n / CATALOG_PAGE_SIZE)), totals: { breaches: totals.breaches, accounts: Number(totals.accounts) } };
}

export async function getBreachByName(db: Db, name: string) {
  const [b] = await db.select().from(breaches).where(eq(breaches.name, name));
  return b ?? null;
}

/** Exposures this user has in one breach. */
export async function userExposuresInBreach(db: Db, userId: number, breachId: number) {
  return db
    .select({ id: exposures.id, emailMasked: exposures.emailMasked, resolvedOn: exposures.resolvedOn, dueOn: exposures.dueOn, severity: exposures.severity })
    .from(exposures)
    .where(and(eq(exposures.userId, userId), eq(exposures.breachId, breachId)));
}

// ---- mutations ----

export type AddAssetResult = { ok: true; id: number } | { ok: false; error: string };

export const MAX_ASSETS = 25;

export async function addAsset(db: Db, userId: number, input: { kind: "email" | "domain"; value: string; label: string }): Promise<AddAssetResult> {
  const [{ n }] = await db.select({ n: count() }).from(assets).where(eq(assets.userId, userId));
  if (n >= MAX_ASSETS) return { ok: false, error: `You can monitor up to ${MAX_ASSETS} assets` };
  const inserted = await db.insert(assets).values({ userId, ...input }).onConflictDoNothing().returning({ id: assets.id });
  if (!inserted.length) return { ok: false, error: "You already monitor this asset" };
  return { ok: true, id: inserted[0].id };
}

export async function deleteAsset(db: Db, userId: number, assetId: number): Promise<boolean> {
  const res = await db.delete(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId))).returning({ id: assets.id });
  return res.length > 0;
}

export async function setStepDone(db: Db, userId: number, exposureId: number, stepId: string, done: boolean): Promise<boolean> {
  if (!isKnownStep(stepId)) return false;
  const row = await getExposure(db, userId, exposureId);
  if (!row) return false;
  const steps = new Set(row.stepsDone);
  if (done) steps.add(stepId);
  else steps.delete(stepId);
  await db
    .update(exposures)
    .set({ stepsDone: [...steps] })
    .where(and(eq(exposures.id, exposureId), eq(exposures.userId, userId)));
  return true;
}

export async function setResolved(db: Db, userId: number, exposureId: number, resolvedOn: IsoDate | null): Promise<boolean> {
  const res = await db
    .update(exposures)
    .set({ resolvedOn })
    .where(and(eq(exposures.id, exposureId), eq(exposures.userId, userId)))
    .returning({ id: exposures.id });
  return res.length > 0;
}

export async function saveNotes(db: Db, userId: number, exposureId: number, notes: string): Promise<boolean> {
  const res = await db
    .update(exposures)
    .set({ notes })
    .where(and(eq(exposures.id, exposureId), eq(exposures.userId, userId)))
    .returning({ id: exposures.id });
  return res.length > 0;
}
