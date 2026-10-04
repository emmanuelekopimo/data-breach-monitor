import { expect, test } from "@playwright/test";
import { reseed, signInDemo } from "./helpers";

test.beforeAll(reseed);

test("mobile: sign in, read the dashboard and open a finding without horizontal scroll", async ({ page }) => {
  await signInDemo(page);
  await expect(page.getByTestId("threat-level")).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Exposures/ }).click();
  await expect(page).toHaveURL(/\/exposures$/);
  expect(await overflow()).toBeLessThanOrEqual(0);
  const firstRow = page.getByTestId("exposures-table").locator("tbody tr").first();
  await expect(firstRow.locator("[data-status=overdue]:visible")).toBeVisible();

  await firstRow.getByRole("link").click();
  await expect(page.getByRole("heading", { name: /in MyFitnessPal/ })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
