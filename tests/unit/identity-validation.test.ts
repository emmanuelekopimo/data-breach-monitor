import { describe, expect, it } from "vitest";
import { emailDomain, hashEmail, maskEmail, normalizeDomain } from "@/lib/identity";
import { remediationSteps } from "@/lib/remediation";
import { cleanText } from "@/lib/text";
import { assetSchema, fieldErrors, signInSchema, signUpSchema } from "@/lib/validation";
import { signSession, verifySession } from "@/lib/auth/token";

describe("identity", () => {
  it("hashes emails case-insensitively", () => {
    expect(hashEmail(" Ada@Example.com ")).toBe(hashEmail("ada@example.com"));
    expect(hashEmail("ada@example.com")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("masks the local part", () => {
    expect(maskEmail("ada.okafor@example.com")).toBe("ad********@example.com");
    expect(maskEmail("a@x.io")).toBe("a***@x.io");
  });
  it("extracts and normalizes domains", () => {
    expect(emailDomain("j@Northwind.Example")).toBe("northwind.example");
    expect(normalizeDomain("@Example.COM.")).toBe("example.com");
  });
});

describe("validation", () => {
  it("normalizes a valid email asset", () => {
    const r = assetSchema.safeParse({ kind: "email", value: " Ada@Example.COM ", label: "Personal" });
    expect(r.success && r.data.value).toBe("ada@example.com");
  });
  it("rejects a bad domain with a field error", () => {
    const r = assetSchema.safeParse({ kind: "domain", value: "not a domain" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).value).toContain("Enter a domain like example.com");
  });
  it("rejects an unknown asset kind", () => {
    const r = assetSchema.safeParse({ kind: "phone", value: "123" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).kind).toBeDefined();
  });
  it("requires a number in sign-up passwords", () => {
    const r = signUpSchema.safeParse({ name: "Ada", email: "a@b.co", password: "onlyletters" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).password).toContain("Include at least one number");
  });
  it("reports a bad email on sign-in", () => {
    const r = signInSchema.safeParse({ email: "nope", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).email).toContain("Enter a valid email address");
  });
});

describe("remediation steps", () => {
  it("asks for a password change and MFA when passwords leak", () => {
    const ids = remediationSteps(["Email addresses", "Passwords"]).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["change-password", "reused-passwords", "enable-mfa", "phishing-watch"]));
  });
  it("adds bank and credit steps for financial and identity data", () => {
    const ids = remediationSteps(["Bank account numbers", "Dates of birth"]).map((s) => s.id);
    expect(ids).toContain("contact-bank");
    expect(ids).toContain("credit-freeze");
    expect(ids).not.toContain("change-password");
  });
});

describe("cleanText", () => {
  it("strips tags and typographic characters", () => {
    expect(cleanText("<a href='x'>Big</a> breach \u2014 \u201Cquoted\u201D &amp; more")).toBe('Big breach - "quoted" & more');
  });
});

describe("session tokens", () => {
  const secret = "test-secret-0123456789";
  it("round-trips a session", async () => {
    const token = await signSession({ userId: 7, email: "a@b.co" }, secret);
    expect(await verifySession(token, secret)).toEqual({ userId: 7, email: "a@b.co" });
  });
  it("rejects a token signed with another secret", async () => {
    const token = await signSession({ userId: 7, email: "a@b.co" }, secret);
    expect(await verifySession(token, "another-secret-0123456789")).toBeNull();
  });
  it("rejects an expired token", async () => {
    const token = await signSession({ userId: 7, email: "a@b.co" }, secret, Math.floor(Date.now() / 1000) - 60 * 60 * 24);
    expect(await verifySession(token, secret)).toBeNull();
  });
});
