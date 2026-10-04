/**
 * npm run db:seed            reset the database and load demo data
 * npm run db:seed -- --if-empty   only seed when there are no users (used on deploy)
 */
import { createDb } from "../src/db";
import { getToday } from "../src/lib/today";
import { readCatalogFile } from "../src/server/catalog";
import { DEMO_EMAIL, DEMO_PASSWORD, isEmpty, resetDatabase, seedDemo } from "../src/server/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const ifEmpty = process.argv.includes("--if-empty");
  const { db, client } = createDb(url, 1);
  try {
    if (ifEmpty && !(await isEmpty(db))) {
      console.log("Database already has data, skipping seed");
      return;
    }
    await resetDatabase(db);
    const today = getToday();
    const res = await seedDemo(db, readCatalogFile(), today);
    console.log(`Seeded ${res.breaches} breaches and ${res.exposures} exposures (today = ${today})`);
    console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
