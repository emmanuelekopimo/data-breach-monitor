"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { signUp, type AuthState } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

export function SignUpForm() {
  const [state, action] = useActionState<AuthState, FormData>(signUp, undefined);
  return (
    <div className="auth-card">
      <div className="brand">
        <img src="/logo.svg" width={32} height={32} alt="" />
        <span className="brand-name">BREACHWATCH</span>
      </div>
      <div>
        <div className="eyebrow">New analyst</div>
        <h1>Create an account</h1>
      </div>
      <form action={action} noValidate>
        <Field name="name" label="Full name" errors={state?.errors?.name}>
          <input className="input" id="name" name="name" autoComplete="name" defaultValue={state?.values?.name} />
        </Field>
        <Field name="email" label="Email" errors={state?.errors?.email}>
          <input className="input" id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} />
        </Field>
        <Field name="password" label="Password (8+ characters, a letter and a number)" errors={state?.errors?.password}>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" />
        </Field>
        <SubmitButton className="btn btn-primary btn-block" pendingText="Creating...">
          <UserPlus size={15} aria-hidden /> Create account
        </SubmitButton>
      </form>
      <p className="text-2">
        Already registered? <Link href="/sign-in">Sign in</Link>
      </p>
    </div>
  );
}
