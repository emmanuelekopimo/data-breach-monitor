import { createDb } from "@/db";
import { readCatalogFile } from "@/server/catalog";
import { resetDatabase, seedDemo } from "@/server/seed";

export const TODAY = "2026-10-04";
const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/breachwatch_test";

export const { db, client } = createDb(url, 2);

export async function freshSeed() {
  await resetDatabase(db);
  return seedDemo(db, readCatalogFile(), TODAY);
}
