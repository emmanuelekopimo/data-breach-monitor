import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, sessionSecret, signSession, verifySession } from "@/lib/auth/token";
import { getUserById } from "./queries";

export async function createSession(user: { id: number; email: string }) {
  const token = await signSession({ userId: user.id, email: user.email }, sessionSecret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Verifies the JWT and that the user still exists. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value, sessionSecret());
  if (!session) return null;
  return getUserById(getDb(), session.userId);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
