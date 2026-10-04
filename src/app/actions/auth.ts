"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { fieldErrors, formToObject, signInSchema, signUpSchema, type FieldErrors } from "@/lib/validation";
import { getUserByEmail } from "@/server/queries";
import { createSession, destroySession } from "@/server/session";

export type AuthState = { errors?: FieldErrors; message?: string; values?: Record<string, string> } | undefined;

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = formToObject(form);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: raw.email ?? "" } };

  const user = await getUserByEmail(getDb(), parsed.data.email);
  // Same message for unknown email and wrong password, so accounts cannot be enumerated.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { message: "Email or password is incorrect", values: { email: parsed.data.email } };
  }
  await createSession(user);
  redirect("/dashboard");
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = formToObject(form);
  const parsed = signUpSchema.safeParse(raw);
  const values = { name: raw.name ?? "", email: raw.email ?? "" };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const db = getDb();
  const email = parsed.data.email.toLowerCase();
  if (await getUserByEmail(db, email)) {
    return { errors: { email: ["An account with this email already exists"] }, values };
  }
  const [user] = await db
    .insert(users)
    .values({ name: parsed.data.name, email, passwordHash: await hashPassword(parsed.data.password) })
    .returning();
  await createSession(user);
  redirect("/dashboard");
}

export async function signOut() {
  await destroySession();
  redirect("/sign-in");
}
