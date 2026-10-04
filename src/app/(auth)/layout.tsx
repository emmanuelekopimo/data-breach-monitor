/* eslint-disable @next/next/no-img-element */
import { getDb } from "@/db";
import { compactNumber } from "@/lib/format";
import { searchCatalog } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  let totals = { breaches: 0, accounts: 0 };
  try {
    totals = (await searchCatalog(getDb(), {})).totals;
  } catch {
    // The sign-in page still renders if the database is unreachable.
  }
  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="brand">
          <img src="/logo.svg" width={36} height={36} alt="" />
          <div>
            <div className="brand-name">BREACHWATCH</div>
            <div className="brand-sub">Exposure monitoring console</div>
          </div>
        </div>
        <img className="hero" src="/hero-network.svg" alt="Network diagram with one compromised node" width={520} height={380} />
        <div className="stack">
          <p className="text-2" style={{ maxWidth: 460 }}>
            Watch your email addresses and company domains for appearances in known data breaches, then work each finding to resolution before its deadline.
          </p>
          <div className="facts">
            <div>
              <b>{totals.breaches}</b>verified breaches
            </div>
            <div>
              <b>{compactNumber(totals.accounts)}</b>accounts indexed
            </div>
            <div>
              <b>5 chars</b>of a password hash sent
            </div>
          </div>
        </div>
      </aside>
      <main className="auth-form">{children}</main>
    </div>
  );
}
