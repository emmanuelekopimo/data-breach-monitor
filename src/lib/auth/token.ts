import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bw_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // one working shift

export type SessionPayload = { userId: number; email: string };

function key(secret: string): Uint8Array {
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET must be at least 16 characters");
  return new TextEncoder().encode(secret);
}

export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.SESSION_SECRET;
  if (secret) return secret;
  if (env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return "dev-only-secret-change-me-please";
}

export async function signSession(payload: SessionPayload, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || typeof payload.email !== "string") return null;
    return { userId, email: payload.email };
  } catch {
    return null;
  }
}
