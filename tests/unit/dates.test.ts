import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, isIsoDate, relativeDays } from "@/lib/dates";
import { getToday } from "@/lib/today";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-04", 3)).toBe("2026-10-07");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-04")).toBe(3);
    expect(daysBetween("2026-10-04", "2026-10-01")).toBe(-3);
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("4/10/2026")).toBe(false);
  });

  it("formats dates and relative days", () => {
    expect(formatDate("2026-10-04")).toBe("4 Oct 2026");
    expect(relativeDays("2026-10-06", "2026-10-04")).toBe("in 2 days");
    expect(relativeDays("2026-10-01", "2026-10-04")).toBe("3 days ago");
    expect(relativeDays("2026-10-04", "2026-10-04")).toBe("today");
  });
});

describe("getToday", () => {
  it("uses BREACHWATCH_TODAY when set", () => {
    expect(getToday({ BREACHWATCH_TODAY: "2026-01-15" })).toBe("2026-01-15");
  });
  it("falls back to the clock", () => {
    expect(getToday({}, new Date("2026-10-04T23:00:00Z"))).toBe("2026-10-04");
  });
  it("rejects a malformed value", () => {
    expect(() => getToday({ BREACHWATCH_TODAY: "tomorrow" })).toThrow(/YYYY-MM-DD/);
  });
});
