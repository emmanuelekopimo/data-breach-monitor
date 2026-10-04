"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getToday } from "@/lib/today";
import { fieldErrors, noteSchema, type FieldErrors } from "@/lib/validation";
import { saveNotes, setResolved, setStepDone } from "@/server/queries";
import { requireUser } from "@/server/session";

function idFrom(form: FormData): number | null {
  const id = Number(form.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function toggleStepAction(form: FormData) {
  const user = await requireUser();
  const id = idFrom(form);
  const step = String(form.get("step") ?? "");
  if (id) await setStepDone(getDb(), user.id, id, step, form.get("done") === "true");
  revalidatePath(`/exposures/${id}`);
}

export async function resolveAction(form: FormData) {
  const user = await requireUser();
  const id = idFrom(form);
  if (id) await setResolved(getDb(), user.id, id, form.get("reopen") === "true" ? null : getToday());
  revalidatePath("/", "layout");
}

export type NotesState = { errors?: FieldErrors; ok?: boolean } | undefined;

export async function saveNotesAction(_prev: NotesState, form: FormData): Promise<NotesState> {
  const user = await requireUser();
  const id = idFrom(form);
  const parsed = noteSchema.safeParse({ notes: form.get("notes") ?? "" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (id) await saveNotes(getDb(), user.id, id, parsed.data.notes);
  revalidatePath(`/exposures/${id}`);
  return { ok: true };
}
