"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getToday } from "@/lib/today";
import { assetSchema, fieldErrors, formToObject, type FieldErrors } from "@/lib/validation";
import { addAsset, deleteAsset } from "@/server/queries";
import { runScan } from "@/server/scan";
import { requireUser } from "@/server/session";
import { liveLookupFromEnv } from "@/server/live";

export type AssetFormState = { errors?: FieldErrors; message?: string; ok?: string; values?: Record<string, string> } | undefined;

export async function addAssetAction(_prev: AssetFormState, form: FormData): Promise<AssetFormState> {
  const user = await requireUser();
  const raw = formToObject(form);
  const parsed = assetSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const db = getDb();
  const res = await addAsset(db, user.id, parsed.data);
  if (!res.ok) return { errors: { value: [res.error] }, values: raw };

  // Scan straight away so the user sees results for the new asset.
  const scan = await runScan(db, user.id, getToday(), liveLookupFromEnv());
  revalidatePath("/", "layout");
  const found = scan.newExposures;
  return { ok: `Now monitoring ${parsed.data.value}. Scan found ${found} new exposure${found === 1 ? "" : "s"}.` };
}

export async function deleteAssetAction(form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) await deleteAsset(getDb(), user.id, id);
  revalidatePath("/", "layout");
}
