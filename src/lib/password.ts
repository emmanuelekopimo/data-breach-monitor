import { createHash } from "node:crypto";

/**
 * Pwned Passwords k-anonymity: only the first 5 hex characters of the SHA-1
 * hash are sent to the API. The match is done locally against the suffixes.
 */
export function sha1Parts(password: string): { hash: string; prefix: string; suffix: string } {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { hash, prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

/** Parses a range response ("SUFFIX:COUNT" lines) and returns the count for a suffix. */
export function countInRange(body: string, suffix: string): number {
  const wanted = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const [s, c] = line.trim().split(":");
    if (s && s.toUpperCase() === wanted) return Number.parseInt(c, 10) || 0;
  }
  return 0;
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; entropyBits: number; hints: string[] };

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

/** Rough strength estimate from length and character variety. */
export function passwordStrength(password: string): Strength {
  let pool = 0;
  const hints: string[] = [];
  if (/[a-z]/.test(password)) pool += 26;
  else hints.push("Add lowercase letters");
  if (/[A-Z]/.test(password)) pool += 26;
  else hints.push("Add uppercase letters");
  if (/\d/.test(password)) pool += 10;
  else hints.push("Add numbers");
  if (/[^A-Za-z0-9]/.test(password)) pool += 33;
  else hints.push("Add symbols");
  if (password.length < 12) hints.unshift("Use at least 12 characters");
  if (/(.)\1{2,}/.test(password)) hints.push("Avoid repeated characters");

  let entropy = password.length * Math.log2(Math.max(pool, 1));
  if (/(.)\1{2,}/.test(password)) entropy *= 0.75;
  if (/^(password|qwerty|123456|letmein|welcome|admin)/i.test(password)) entropy = Math.min(entropy, 10);
  const entropyBits = Math.round(entropy);

  const score = (entropyBits < 28 ? 0 : entropyBits < 40 ? 1 : entropyBits < 60 ? 2 : entropyBits < 80 ? 3 : 4) as Strength["score"];
  return { score, label: LABELS[score], entropyBits, hints };
}

export type PasswordVerdict = "compromised" | "weak" | "ok";

/** Any appearance in a breach makes a password unusable, whatever its strength. */
export function passwordVerdict(breachCount: number, strength: Strength): PasswordVerdict {
  if (breachCount > 0) return "compromised";
  if (strength.score <= 1) return "weak";
  return "ok";
}
