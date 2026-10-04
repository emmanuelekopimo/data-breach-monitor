import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import { exposureStatus } from "@/lib/exposure";
import { getDashboard, getUserByEmail, listAssets, listExposures, searchCatalog } from "@/server/queries";
import { DEMO_EMAIL, DEMO_PASSWORD, isEmpty } from "@/server/seed";
import { client, db, freshSeed, TODAY } from "./helpers";

afterAll(() => client.end());

describe("seed", () => {
  beforeEach(async () => {
    await freshSeed();
  });

  it("creates a demo user whose password verifies", async () => {
    const user = await getUserByEmail(db, DEMO_EMAIL);
    expect(user).not.toBeNull();
    expect(await verifyPassword(DEMO_PASSWORD, user!.passwordHash)).toBe(true);
    expect(await isEmpty(db)).toBe(false);
  });

  it("produces a mix of resolved, open, due soon and overdue exposures", async () => {
    const user = await getUserByEmail(db, DEMO_EMAIL);
    const rows = await listExposures(db, user!.id, TODAY);
    const statuses = new Set(rows.map((r) => exposureStatus(r, TODAY)));
    expect(statuses).toEqual(new Set(["resolved", "open", "due-soon", "overdue"]));
    expect(exposureStatus(rows[0], TODAY)).toBe("overdue");
  });

  it("builds the dashboard summary", async () => {
    const user = await getUserByEmail(db, DEMO_EMAIL);
    const d = await getDashboard(db, user!.id, TODAY);
    expect(d.assetCount).toBe(5);
    expect(d.summary.overdue).toBe(3);
    expect(d.summary.level).toBe("elevated");
    expect(d.queue.length).toBeGreaterThan(0);
  });

  it("reports per-asset exposure counts, including a clean asset", async () => {
    const user = await getUserByEmail(db, DEMO_EMAIL);
    const list = await listAssets(db, user!.id, TODAY);
    expect(list.find((a) => a.value === "ada.backup@example.org")?.exposures).toBe(0);
    expect(list.find((a) => a.value === "northwind.example")?.exposures).toBe(3);
  });

  it("searches the breach catalog", async () => {
    const res = await searchCatalog(db, { q: "linkedin" });
    expect(res.rows.some((r) => r.name === "LinkedIn")).toBe(true);
    const crit = await searchCatalog(db, { severity: "critical", page: 2 });
    expect(crit.rows.every((r) => r.severity === "critical")).toBe(true);
    expect(crit.page).toBe(2);
    expect(crit.totals.breaches).toBeGreaterThan(800);
  });
});
