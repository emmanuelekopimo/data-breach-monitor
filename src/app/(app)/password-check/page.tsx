import type { Metadata } from "next";
import { requireUser } from "@/server/session";
import { PasswordCheckForm } from "./password-check-form";

export const metadata: Metadata = { title: "Password check" };

export default async function PasswordCheckPage() {
  await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Credential hygiene</div>
          <h1>Has this password been leaked?</h1>
          <p>
            Checks a password against more than a billion passwords from real breaches using the Pwned Passwords k-anonymity API. Only the first 5 characters of the SHA-1 hash leave the server. The password is never stored or logged.
          </p>
        </div>
      </div>
      <PasswordCheckForm />
    </>
  );
}
