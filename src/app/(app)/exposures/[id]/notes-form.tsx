"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { saveNotesAction, type NotesState } from "@/app/actions/exposures";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export function NotesForm({ id, notes }: { id: number; notes: string }) {
  const [state, action] = useActionState<NotesState, FormData>(saveNotesAction, undefined);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="id" value={id} />
      <Field name="notes" label="Analyst notes" errors={state?.errors?.notes}>
        <textarea className="textarea" id="notes" name="notes" defaultValue={notes} maxLength={600} placeholder="What was done, who was contacted..." />
      </Field>
      <div className="row">
        <SubmitButton className="btn btn-sm" pendingText="Saving...">
          <Save size={13} aria-hidden /> Save notes
        </SubmitButton>
        {state?.ok ? <span className="t-good" role="status">Saved</span> : null}
      </div>
    </form>
  );
}
