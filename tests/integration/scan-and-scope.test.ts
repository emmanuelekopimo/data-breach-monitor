import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { addAsset, deleteAsset, getExposure, getUserByEmail, listAssets, listExposures, saveNotes, setResolved, setStepDone } from "@/server/queries";
import { runScan } from "@/server/scan";
import { DEMO_EMAIL, resetDemoUser } from "@/server/seed";
import { client, db, freshSeed, TODAY } from "./helpers";

afterAll(() => client.end());

let demoId: number;
let otherId: number;

beforeEach(async () => {
  await freshSeed();
  demoId = (await getUserByEmail(db, DEMO_EMAIL))!.id;
  const [other] = await db.insert(users).values({ name: "Other User", email: "other@example.com", passwordHash: await hashPassword("Other1234!") }).returning();
  otherId = other.id;
});

describe("runScan", () => {
  it("finds the pending leak records for the demo user", async () => {
    const res = await runScan(db, demoId, TODAY);
    expect(res.assetsChecked).toBe(5);
    expect(res.newExposures).toBe(4);
    expect(res.log.some((l) => l.level === "hit" && l.text.includes("Fanlore"))).toBe(true);
    const fanlore = (await listExposures(db, demoId, TODAY)).find((r) => r.breachName === "Fanlore")!;
    expect(fanlore.detectedOn).toBe(TODAY);
    expect(fanlore.dueOn).toBe("2026-10-07");
  });

  it("is idempotent", async () => {
    await runScan(db, demoId, TODAY);
    const again = await runScan(db, demoId, TODAY);
    expect(again.newExposures).toBe(0);
  });

  it("detects a newly added email", async () => {
    const added = await addAsset(db, otherId, { kind: "email", value: "demo.user@example.net", label: "" });
    expect(added.ok).toBe(true);
    const res = await runScan(db, otherId, TODAY);
    expect(res.newExposures).toBe(4);
  });

  it("uses a live lookup when one is supplied", async () => {
    await addAsset(db, otherId, { kind: "email", value: "fresh@example.com", label: "" });
    const res = await runScan(db, otherId, TODAY, async () => ["Adobe", "NotInCatalog"]);
    expect(res.newExposures).toBe(1);
  });

  it("keeps scanning when the live lookup fails", async () => {
    await addAsset(db, otherId, { kind: "email", value: "fresh@example.com", label: "" });
    const res = await runScan(db, otherId, TODAY, async () => {
      throw new Error("rate limited");
    });
    expect(res.log.some((l) => l.level === "warn" && l.text.includes("rate limited"))).toBe(true);
  });
});

describe("user scoping", () => {
  it("never returns another user's exposures", async () => {
    expect(await listExposures(db, otherId, TODAY)).toHaveLength(0);
    const demoRow = (await listExposures(db, demoId, TODAY))[0];
    expect(await getExposure(db, otherId, demoRow.id)).toBeNull();
  });

  it("refuses to change another user's data", async () => {
    const demoRow = (await listExposures(db, demoId, TODAY))[0];
    expect(await setResolved(db, otherId, demoRow.id, TODAY)).toBe(false);
    expect(await saveNotes(db, otherId, demoRow.id, "x")).toBe(false);
    expect(await setStepDone(db, otherId, demoRow.id, "enable-mfa", true)).toBe(false);
    const demoAsset = (await listAssets(db, demoId, TODAY))[0];
    expect(await deleteAsset(db, otherId, demoAsset.id)).toBe(false);
    expect((await getExposure(db, demoId, demoRow.id))!.resolvedOn).toBeNull();
  });
});

describe("mutations", () => {
  it("rejects duplicate assets", async () => {
    const res = await addAsset(db, demoId, { kind: "email", value: "ada.okafor@example.com", label: "" });
    expect(res).toEqual({ ok: false, error: "You already monitor this asset" });
  });

  it("resolves, tracks steps and reopens an exposure", async () => {
    const row = (await listExposures(db, demoId, TODAY))[0];
    expect(await setStepDone(db, demoId, row.id, "enable-mfa", true)).toBe(true);
    expect(await setStepDone(db, demoId, row.id, "not-a-step", true)).toBe(false);
    expect(await setResolved(db, demoId, row.id, TODAY)).toBe(true);
    let after = (await getExposure(db, demoId, row.id))!;
    expect(after.resolvedOn).toBe(TODAY);
    expect(after.stepsDone).toContain("enable-mfa");
    await setResolved(db, demoId, row.id, null);
    after = (await getExposure(db, demoId, row.id))!;
    expect(after.resolvedOn).toBeNull();
  });

  it("deletes an asset together with its exposures", async () => {
    const work = (await listAssets(db, demoId, TODAY)).find((a) => a.label === "Work")!;
    expect(await deleteAsset(db, demoId, work.id)).toBe(true);
    const rows = await listExposures(db, demoId, TODAY);
    expect(rows.some((r) => r.assetId === work.id)).toBe(false);
  });
});

describe("resetDemoUser", () => {
  it("restores the demo account after changes, dated relative to a new today", async () => {
    await runScan(db, demoId, TODAY);
    await addAsset(db, demoId, { kind: "email", value: "demo.user@example.net", label: "" });
    expect(await resetDemoUser(db, demoId, "2026-11-01")).toBe(14);
    const rows = await listExposures(db, demoId, "2026-11-01");
    expect(rows).toHaveLength(14);
    expect(rows.find((r) => r.breachName === "Wattpad")!.detectedOn).toBe("2026-10-31");
    expect((await listAssets(db, demoId, "2026-11-01")).map((a) => a.value)).not.toContain("demo.user@example.net");
    // The pending leak records are still there, so the next scan finds them again.
    expect((await runScan(db, demoId, "2026-11-01")).newExposures).toBe(4);
  });

  it("leaves other users alone", async () => {
    await addAsset(db, otherId, { kind: "email", value: "demo.user@example.net", label: "" });
    await resetDemoUser(db, demoId, TODAY);
    expect(await listAssets(db, otherId, TODAY)).toHaveLength(1);
  });
});
