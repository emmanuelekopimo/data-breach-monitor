"use client";

import { useActionState } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { addAssetAction, type AssetFormState } from "@/app/actions/assets";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export function AddAssetForm() {
  const [state, action] = useActionState<AssetFormState, FormData>(addAssetAction, undefined);
  return (
    <form action={action} noValidate className="stack" data-testid="add-asset-form">
      <div className="form-row">
        <Field name="kind" label="Type" errors={state?.errors?.kind}>
          {/* Uncontrolled select so it keeps working after React resets the form. */}
          <select className="select" id="kind" name="kind" defaultValue={state?.values?.kind ?? "email"} key={state?.values?.kind ?? "email"}>
            <option value="email">Email</option>
            <option value="domain">Domain</option>
          </select>
        </Field>
        <Field name="value" label="Email address or domain" errors={state?.errors?.value}>
          <input className="input" id="value" name="value" placeholder="name@example.com or example.com" defaultValue={state?.values?.value} key={state?.values?.value ?? "v"} />
        </Field>
        <Field name="label" label="Label (optional)" errors={state?.errors?.label}>
          <input className="input" id="label" name="label" placeholder="Work, Personal..." defaultValue={state?.values?.label} key={state?.values?.label ?? "l"} />
        </Field>
        <SubmitButton pendingText="Adding and scanning...">
          <Plus size={15} aria-hidden /> Add and scan
        </SubmitButton>
      </div>
      {state?.ok ? (
        <div className="form-ok" role="status">
          <CircleCheck size={15} aria-hidden /> {state.ok}
        </div>
      ) : null}
    </form>
  );
}
