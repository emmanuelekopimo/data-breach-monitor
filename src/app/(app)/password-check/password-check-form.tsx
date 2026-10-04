"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Fingerprint, OctagonAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { checkPasswordAction, type PasswordCheckState } from "@/app/actions/password";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";

const METER = ["var(--critical)", "var(--high)", "var(--medium)", "var(--good)", "var(--good)"];

export function PasswordCheckForm() {
  const [state, action] = useActionState<PasswordCheckState, FormData>(checkPasswordAction, undefined);
  const [show, setShow] = useState(false);
  const r = state?.result;

  return (
    <div className="grid grid-2">
      <section className="panel">
        <div className="panel-head">
          <h2>
            <Fingerprint size={16} aria-hidden /> Check a password
          </h2>
        </div>
        <div className="panel-body">
          <form action={action} className="stack" noValidate autoComplete="off">
            <Field name="password" label="Password" errors={state?.errors?.password}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input className="input" id="password" name="password" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="Type a password to test" />
                <button type="button" className="icon-btn" style={{ height: 38, width: 38 }} onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                </button>
              </div>
            </Field>
            <SubmitButton pendingText="Checking...">Check password</SubmitButton>
            <p className="cell-sub">Try a common one like password123 to see a hit.</p>
          </form>
        </div>
      </section>

      <section className="panel" aria-live="polite" data-testid="password-result">
        <div className="panel-head">
          <h2>Result</h2>
        </div>
        <div className="panel-body stack">
          {!r ? (
            <p className="text-2">Results appear here. Nothing is sent until you press Check password.</p>
          ) : (
            <>
              {r.verdict === "compromised" ? (
                <div className="callout bad">
                  <OctagonAlert size={22} className="t-critical" aria-hidden />
                  <div>
                    <div className="big-number t-critical" data-testid="breach-count">
                      {r.count!.toLocaleString("en-US")}
                    </div>
                    <strong>times seen in data breaches. Do not use this password.</strong>
                  </div>
                </div>
              ) : r.verdict === "weak" ? (
                <div className="callout warn">
                  <TriangleAlert size={22} className="t-medium" aria-hidden />
                  <div>
                    <strong>{r.count === null ? "Breach check unavailable." : "Not found in breaches,"} but it is weak.</strong>
                    <p className="text-2">Short or simple passwords can be guessed without any breach.</p>
                  </div>
                </div>
              ) : (
                <div className="callout ok">
                  <ShieldCheck size={22} className="t-good" aria-hidden />
                  <div>
                    <strong>{r.count === null ? "Strong, but the breach check was unavailable." : "Not found in any known breach."}</strong>
                    <p className="text-2">Still use it on one site only.</p>
                  </div>
                </div>
              )}
              {r.apiError ? <p className="t-medium">{r.apiError}</p> : null}
              <div className="stack" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="text-2">Strength: {r.strength.label}</span>
                  <span className="cell-sub">about {r.strength.entropyBits} bits</span>
                </div>
                <div className="meter" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <i key={i} style={i <= r.strength.score ? { background: METER[r.strength.score] } : undefined} />
                  ))}
                </div>
                {r.strength.hints.length ? <p className="cell-sub">{r.strength.hints.join(". ")}.</p> : null}
              </div>
              <div className="console" style={{ padding: 12 }}>
                <div className="hash">
                  SHA-1 = <b>{r.prefix}</b>
                  {"*".repeat(29)}
                  {r.suffixTail}
                </div>
                <div className="cell-sub" style={{ marginTop: 6 }}>
                  Sent: GET /range/<b className="t-good">{r.prefix}</b>. The rest of the hash was compared on the server.
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
