import { createHash } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
}

/** The leak index stores SHA-256 hashes of normalized emails, never the address. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function emailDomain(email: string): string {
  const at = normalizeEmail(email).lastIndexOf("@");
  return at === -1 ? "" : normalizeEmail(email).slice(at + 1);
}

/** ada.okafor@example.com -> ad******@example.com */
export function maskEmail(email: string): string {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = e.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}${"*".repeat(Math.max(3, local.length - keep))}@${e.slice(at + 1)}`;
}
