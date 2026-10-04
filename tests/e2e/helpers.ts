import { expect, type Page } from "@playwright/test";
import { createDb } from "../../src/db";
import { readCatalogFile } from "../../src/server/catalog";
import { resetDatabase, seedDemo } from "../../src/server/seed";

export const TODAY = "2026-10-04";

/** Puts the e2e database back to the demo seed. */
export async function reseed() {
  const { db, client } = createDb(process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/breachwatch_test", 1);
  await resetDatabase(db);
  await seedDemo(db, readCatalogFile(), TODAY);
  await client.end();
}

/** Signs in with the pre-filled demo credentials. */
export async function signInDemo(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
