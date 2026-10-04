import { describe, expect, it } from "vitest";
import { countInRange, passwordStrength, passwordVerdict, sha1Parts } from "@/lib/password";

describe("k-anonymity helpers", () => {
  it("splits the SHA-1 hash into a 5 character prefix and a suffix", () => {
    const { hash, prefix, suffix } = sha1Parts("password");
    expect(hash).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
    expect(prefix).toBe("5BAA6");
    expect(suffix).toBe("1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });
  it("finds the count for a suffix in a range response", () => {
    const body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:52256179\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:13";
    expect(countInRange(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(52256179);
    expect(countInRange(body, "FFFFF")).toBe(0);
  });
  it("ignores padding entries with a zero count", () => {
    expect(countInRange("ABCDEF:0", "abcdef")).toBe(0);
  });
});

describe("passwordStrength", () => {
  it("rates common passwords as very weak", () => {
    expect(passwordStrength("password123").score).toBe(0);
  });
  it("rates long mixed passwords as strong", () => {
    expect(passwordStrength("correct-Horse-battery-9-staple").score).toBeGreaterThanOrEqual(3);
  });
  it("gives hints for missing character types", () => {
    expect(passwordStrength("abcdefgh").hints).toContain("Add numbers");
  });
});

describe("passwordVerdict", () => {
  it("marks any breached password as compromised", () => {
    expect(passwordVerdict(3, passwordStrength("Xy!9-long-and-random-Q"))).toBe("compromised");
  });
  it("marks unbreached weak passwords as weak", () => {
    expect(passwordVerdict(0, passwordStrength("abc"))).toBe("weak");
  });
  it("accepts unbreached strong passwords", () => {
    expect(passwordVerdict(0, passwordStrength("Xy!9-long-and-random-Q"))).toBe("ok");
  });
});
