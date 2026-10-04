import { expect, test } from "@playwright/test";
import { reseed, signInDemo } from "./helpers";

test.beforeEach(async ({ page }) => {
  await reseed();
  await signInDemo(page);
});

test("dashboard shows the seeded risk posture", async ({ page }) => {
  await expect(page.getByTestId("threat-level")).toHaveText("THREAT LEVEL: ELEVATED");
  await expect(page.getByTestId("stat-overdue")).toContainText("3");
  await expect(page.getByTestId("queue").locator("tbody tr").first()).toContainText("MyFitnessPal");
});

test("running a scan finds new exposures and raises the threat level", async ({ page }) => {
  await page.getByTestId("run-scan").click();
  const log = page.getByTestId("scan-log");
  await expect(log).toContainText("NEW CRITICAL ad********@example.com found in Fanlore");
  await expect(log).toContainText("Scan complete: 4 new exposure(s)");
  await page.reload();
  await expect(page.getByTestId("threat-level")).toHaveText("THREAT LEVEL: SEVERE");
});

test("reset demo data restores the starting state", async ({ page }) => {
  await page.getByTestId("run-scan").click();
  await expect(page.getByTestId("scan-log")).toContainText("Scan complete: 4 new exposure(s)");
  await page.reload();
  await expect(page.getByTestId("threat-level")).toHaveText("THREAT LEVEL: SEVERE");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByTestId("threat-level")).toHaveText("THREAT LEVEL: ELEVATED");
});

test("adding an asset validates input and scans it", async ({ page }) => {
  await page.goto("/assets");
  const form = page.getByTestId("add-asset-form");
  await form.getByLabel("Type").selectOption("domain");
  await form.getByLabel("Email address or domain").fill("not a domain");
  await form.getByRole("button", { name: "Add and scan" }).click();
  await expect(page.getByText("Enter a domain like example.com")).toBeVisible();
  // The select keeps its value after the server action re-renders the form.
  await expect(form.getByLabel("Type")).toHaveValue("domain");

  await form.getByLabel("Type").selectOption("email");
  await form.getByLabel("Email address or domain").fill("Demo.User@Example.net");
  await form.getByLabel("Label (optional)").fill("Test");
  await form.getByRole("button", { name: "Add and scan" }).click();
  await expect(page.getByRole("status")).toContainText("Now monitoring demo.user@example.net. Scan found");
  await expect(page.getByTestId("assets-table")).toContainText("demo.user@example.net");

  await form.getByLabel("Email address or domain").fill("demo.user@example.net");
  await form.getByRole("button", { name: "Add and scan" }).click();
  await expect(page.getByText("You already monitor this asset")).toBeVisible();
});

test("deleting an asset removes it", async ({ page }) => {
  await page.goto("/assets");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Stop monitoring ada.backup@example.org" }).click();
  await expect(page.getByTestId("assets-table")).not.toContainText("ada.backup@example.org");
});

test("filters exposures and works a finding to resolution", async ({ page }) => {
  await page.goto("/exposures");
  await page.getByLabel("Status").selectOption("overdue");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("exposure-count")).toHaveText("3 of 14 exposure(s)");
  await expect(page.getByLabel("Status")).toHaveValue("overdue");

  await page.getByRole("link", { name: "Canva" }).click();
  await expect(page.getByRole("heading", { name: /in Canva/ })).toBeVisible();
  await expect(page.getByTestId("steps-progress")).toHaveText("1/4 done");
  await page.getByRole("button", { name: "Complete: Turn on multi-factor authentication" }).click();
  await expect(page.getByTestId("steps-progress")).toHaveText("2/4 done");

  await page.getByLabel("Analyst notes").fill("MFA enabled, password rotated everywhere.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByTestId("resolve").click();
  await expect(page.locator("[data-status=resolved]").first()).toBeVisible();
  await expect(page.getByText("resolved late")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
});

test("breach catalog search and detail show the user's exposure", async ({ page }) => {
  await page.goto("/breaches");
  await page.getByLabel("Search service or domain").fill("linkedin");
  await page.getByRole("button", { name: "Search" }).click();
  await page.locator(`a[href="/breaches/LinkedIn"]`).click();
  await expect(page.getByRole("heading", { name: "LinkedIn", exact: true })).toBeVisible();
  await expect(page.getByTestId("your-exposure")).toContainText("1 of your identities are in this breach");
});

test("password check uses the Pwned Passwords range API", async ({ page }) => {
  await page.goto("/password-check");
  await page.getByRole("button", { name: "Check password" }).click();
  await expect(page.getByText("Enter a password to check")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Check password" }).click();
  const result = page.getByTestId("password-result");
  await expect(result).toContainText("times seen in data breaches");
  await expect(result).toContainText("GET /range/CBFDA");
});
