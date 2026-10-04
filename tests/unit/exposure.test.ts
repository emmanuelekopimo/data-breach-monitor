import { describe, expect, it } from "vitest";
import { compareForQueue, daysOverdue, dueDateFor, exposureStatus, riskScore, summarize, threatLevel, type ExposureLike } from "@/lib/exposure";

const TODAY = "2026-10-04";
const e = (over: Partial<ExposureLike>): ExposureLike => ({ severity: "high", dueOn: "2026-10-20", resolvedOn: null, ...over });

describe("dueDateFor", () => {
  it("applies the SLA for each severity", () => {
    expect(dueDateFor("2026-10-04", "critical")).toBe("2026-10-07");
    expect(dueDateFor("2026-10-04", "high")).toBe("2026-10-11");
    expect(dueDateFor("2026-10-04", "medium")).toBe("2026-10-18");
    expect(dueDateFor("2026-10-04", "low")).toBe("2026-11-03");
  });
});

describe("exposureStatus", () => {
  it("is resolved when a resolved date is set, even past the deadline", () => {
    expect(exposureStatus(e({ dueOn: "2026-09-01", resolvedOn: "2026-09-10" }), TODAY)).toBe("resolved");
  });
  it("is overdue the day after the deadline", () => {
    expect(exposureStatus(e({ dueOn: "2026-10-03" }), TODAY)).toBe("overdue");
  });
  it("is due soon on the deadline and up to two days before", () => {
    expect(exposureStatus(e({ dueOn: "2026-10-04" }), TODAY)).toBe("due-soon");
    expect(exposureStatus(e({ dueOn: "2026-10-06" }), TODAY)).toBe("due-soon");
  });
  it("is open when the deadline is further away", () => {
    expect(exposureStatus(e({ dueOn: "2026-10-07" }), TODAY)).toBe("open");
  });
  it("counts days overdue", () => {
    expect(daysOverdue(e({ dueOn: "2026-09-30" }), TODAY)).toBe(4);
    expect(daysOverdue(e({ dueOn: "2026-10-30" }), TODAY)).toBe(0);
  });
});

describe("riskScore and threatLevel", () => {
  it("is zero with nothing unresolved", () => {
    expect(riskScore([e({ resolvedOn: "2026-10-01" })], TODAY)).toBe(0);
    expect(threatLevel(0)).toBe("low");
  });
  it("weights overdue exposures by 1.5", () => {
    expect(riskScore([e({ severity: "critical", dueOn: "2026-10-10" })], TODAY)).toBe(12);
    expect(riskScore([e({ severity: "critical", dueOn: "2026-10-01" })], TODAY)).toBe(18);
  });
  it("caps at 100", () => {
    const many = Array.from({ length: 20 }, () => e({ severity: "critical", dueOn: "2026-09-01" }));
    expect(riskScore(many, TODAY)).toBe(100);
    expect(threatLevel(100)).toBe("severe");
  });
  it("maps scores to levels", () => {
    expect(threatLevel(14)).toBe("low");
    expect(threatLevel(15)).toBe("guarded");
    expect(threatLevel(45)).toBe("elevated");
    expect(threatLevel(75)).toBe("severe");
  });
});

describe("summarize and queue order", () => {
  const list = [
    e({ severity: "medium", dueOn: "2026-10-15" }),
    e({ severity: "critical", dueOn: "2026-10-01" }),
    e({ severity: "low", dueOn: "2026-09-01", resolvedOn: "2026-08-30" }),
    e({ severity: "high", dueOn: "2026-10-05" }),
  ];
  it("counts by status and severity", () => {
    const s = summarize(list, TODAY);
    expect(s).toMatchObject({ total: 4, unresolved: 3, overdue: 1, dueSoon: 1, resolved: 1 });
    expect(s.bySeverity).toEqual({ critical: 1, high: 1, medium: 1, low: 0 });
  });
  it("puts overdue first and resolved last", () => {
    const sorted = [...list].sort(compareForQueue(TODAY));
    expect(sorted.map((x) => x.severity)).toEqual(["critical", "high", "medium", "low"]);
  });
});
