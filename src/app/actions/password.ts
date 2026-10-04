"use server";

import { countInRange, passwordStrength, passwordVerdict, sha1Parts, type PasswordVerdict, type Strength } from "@/lib/password";
import { fieldErrors, passwordCheckSchema, type FieldErrors } from "@/lib/validation";
import { requireUser } from "@/server/session";

export type PasswordCheckState =
  | {
      errors?: FieldErrors;
      result?: { prefix: string; suffixTail: string; count: number | null; strength: Strength; verdict: PasswordVerdict; apiError?: string };
    }
  | undefined;

/**
 * Checks a password against Pwned Passwords using k-anonymity. The password and
 * its full hash never leave the server and nothing is stored or logged.
 */
export async function checkPasswordAction(_prev: PasswordCheckState, form: FormData): Promise<PasswordCheckState> {
  await requireUser();
  const parsed = passwordCheckSchema.safeParse({ password: form.get("password") ?? "" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { prefix, suffix } = sha1Parts(parsed.data.password);
  const strength = passwordStrength(parsed.data.password);
  let count: number | null = null;
  let apiError: string | undefined;
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "user-agent": "BreachWatch-student-project" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    count = countInRange(await res.text(), suffix);
  } catch (err) {
    apiError = `Could not reach Pwned Passwords (${(err as Error).message}). Only the strength check ran.`;
  }
  return {
    result: { prefix, suffixTail: suffix.slice(-6), count, strength, verdict: passwordVerdict(count ?? 0, strength), apiError },
  };
}
