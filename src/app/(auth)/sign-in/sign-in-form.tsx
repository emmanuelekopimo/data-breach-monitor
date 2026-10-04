"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useActionState } from "react";
import { CircleAlert, LogIn } from "lucide-react";
import { signIn, type AuthState } from "@/app/actions/auth";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

const DEMO = { email: "analyst@breachwatch.dev", password: "Demo1234!" };

export function SignInForm() {
  const [state, action] = useActionState<AuthState, FormData>(signIn, undefined);
  return (
    <div className="auth-card">
      <div className="brand">
        <img src="/logo.svg" width={32} height={32} alt="" />
        <span className="brand-name">BREACHWATCH</span>
      </div>
      <div>
        <div className="eyebrow">Analyst sign in</div>
        <h1>Access the console</h1>
      </div>
      <div className="demo-note">
        Demo account is pre-filled: <b>{DEMO.email}</b> / <b>{DEMO.password}</b>
      </div>
      {state?.message ? (
        <div className="form-error" role="alert">
          <CircleAlert size={15} aria-hidden /> {state.message}
        </div>
      ) : null}
      <form action={action} noValidate>
        <Field name="email" label="Email" errors={state?.errors?.email}>
          <input className="input" id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email ?? DEMO.email} aria-describedby="email-error" />
        </Field>
        <Field name="password" label="Password" errors={state?.errors?.password}>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" defaultValue={DEMO.password} />
        </Field>
        <SubmitButton className="btn btn-primary btn-block" pendingText="Verifying...">
          <LogIn size={15} aria-hidden /> Sign in
        </SubmitButton>
      </form>
      <p className="text-2">
        No account? <Link href="/sign-up">Create one</Link>
      </p>
    </div>
  );
}
