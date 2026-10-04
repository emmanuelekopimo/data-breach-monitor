import { expect, test } from "@playwright/test";
import { reseed, signInDemo } from "./helpers";

test.beforeAll(reseed);

test("redirects signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/exposures");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign-in form is pre-filled with the demo account and works", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toHaveValue("analyst@breachwatch.dev");
  await expect(page.getByLabel("Password")).toHaveValue("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back, Ada" })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".form-error")).toContainText("Email or password is incorrect");
});

test("sign-up shows inline validation errors", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Email").fill("bad-email");
  await page.getByLabel(/^Password/).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("bad-email");
});

test("a new account starts empty and cannot see demo data", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Sam Lee");
  await page.getByLabel("Email").fill("sam.lee@example.net");
  await page.getByLabel(/^Password/).fill("Sam12345!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("threat-level")).toHaveText("THREAT LEVEL: LOW");
  await expect(page.getByText("All clear")).toBeVisible();

  // Exposure 1 belongs to the demo user.
  await page.goto("/exposures/1");
  await expect(page.getByRole("heading", { name: "Nothing on the radar" })).toBeVisible();
});

test("sign out ends the session", async ({ page }) => {
  await signInDemo(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});
