"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getToday } from "@/lib/today";
import { DEMO_EMAIL, resetDemoUser } from "@/server/seed";
import { requireUser } from "@/server/session";

/** Restores the demo account to its starting state. Only the demo account can do this. */
export async function resetDemoAction() {
  const user = await requireUser();
  if (user.email !== DEMO_EMAIL) return;
  await resetDemoUser(getDb(), user.id, getToday());
  revalidatePath("/", "layout");
}
