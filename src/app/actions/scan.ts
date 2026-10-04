"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getToday } from "@/lib/today";
import { liveLookupFromEnv } from "@/server/live";
import { runScan, type ScanResult } from "@/server/scan";
import { requireUser } from "@/server/session";

export async function runScanAction(): Promise<ScanResult> {
  const user = await requireUser();
  const result = await runScan(getDb(), user.id, getToday(), liveLookupFromEnv());
  revalidatePath("/", "layout");
  return result;
}
