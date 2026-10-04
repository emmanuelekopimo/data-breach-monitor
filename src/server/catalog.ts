import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { breaches } from "@/db/schema";
import { classifySeverity } from "@/lib/severity";

export type CatalogEntry = {
  name: string;
  title: string;
  domain: string | null;
  breachDate: string;
  addedDate: string;
  pwnCount: number;
  dataClasses: string[];
  description: string;
};

export function readCatalogFile(path = join(process.cwd(), "data", "breaches.json")): CatalogEntry[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { breaches: CatalogEntry[] };
  return parsed.breaches;
}

/** Inserts or updates every catalog entry. Returns the number of rows written. */
export async function loadCatalog(db: Db, entries: CatalogEntry[]): Promise<number> {
  const rows = entries.map((e) => ({ ...e, severity: classifySeverity(e.dataClasses) }));
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(breaches)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: breaches.name,
        set: {
          title: sql`excluded.title`,
          domain: sql`excluded.domain`,
          breachDate: sql`excluded.breach_date`,
          addedDate: sql`excluded.added_date`,
          pwnCount: sql`excluded.pwn_count`,
          dataClasses: sql`excluded.data_classes`,
          description: sql`excluded.description`,
          severity: sql`excluded.severity`,
        },
      });
  }
  return rows.length;
}
