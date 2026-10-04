/**
 * Refreshes data/breaches.json from the public Have I Been Pwned breach list.
 * The breach list is free to use under CC BY 4.0 (https://haveibeenpwned.com/API/v3).
 * Run: npm run breaches:sync
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanText } from "../src/lib/text";

type HibpBreach = {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
  IsStealerLog?: boolean;
};

async function main() {
  const res = await fetch("https://haveibeenpwned.com/api/v3/breaches", {
    headers: { "user-agent": "BreachWatch-student-project" },
  });
  if (!res.ok) throw new Error(`HIBP responded ${res.status}`);
  const all = (await res.json()) as HibpBreach[];

  // Keep verified, public breaches only. Sensitive, spam, fabricated, retired
  // and malware entries are dropped.
  const kept = all
    .filter((b) => b.IsVerified && !b.IsSensitive && !b.IsSpamList && !b.IsFabricated && !b.IsRetired && !b.IsMalware)
    .map((b) => ({
      name: b.Name,
      title: cleanText(b.Title),
      domain: b.Domain || null,
      breachDate: b.BreachDate,
      addedDate: b.AddedDate.slice(0, 10),
      pwnCount: b.PwnCount,
      dataClasses: b.DataClasses.map(cleanText),
      description: cleanText(b.Description),
    }))
    .sort((a, b) => b.breachDate.localeCompare(a.breachDate));

  const out = join(process.cwd(), "data", "breaches.json");
  writeFileSync(out, JSON.stringify({ source: "https://haveibeenpwned.com/api/v3/breaches", license: "CC BY 4.0", fetchedOn: new Date().toISOString().slice(0, 10), breaches: kept }, null, 0));
  console.log(`Wrote ${kept.length} of ${all.length} breaches to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
