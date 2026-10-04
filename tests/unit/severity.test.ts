import { describe, expect, it } from "vitest";
import { classifySeverity, SLA_DAYS } from "@/lib/severity";

describe("classifySeverity", () => {
  it("is critical when passwords or financial data leak", () => {
    expect(classifySeverity(["Email addresses", "Passwords"])).toBe("critical");
    expect(classifySeverity(["Email addresses", "Bank account numbers"])).toBe("critical");
  });
  it("is high for identity data", () => {
    expect(classifySeverity(["Email addresses", "Dates of birth", "Names"])).toBe("high");
    expect(classifySeverity(["Email addresses", "Phone numbers"])).toBe("high");
  });
  it("is medium for names and usernames", () => {
    expect(classifySeverity(["Email addresses", "Names", "Usernames"])).toBe("medium");
  });
  it("is low when only the email leaked", () => {
    expect(classifySeverity(["Email addresses"])).toBe("low");
  });
  it("gives tighter deadlines to worse severities", () => {
    expect(SLA_DAYS.critical).toBeLessThan(SLA_DAYS.high);
    expect(SLA_DAYS.high).toBeLessThan(SLA_DAYS.medium);
    expect(SLA_DAYS.medium).toBeLessThan(SLA_DAYS.low);
  });
});
