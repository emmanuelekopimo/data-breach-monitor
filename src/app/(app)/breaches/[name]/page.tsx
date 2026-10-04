import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldCheck, ShieldX } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { exposureStatus } from "@/lib/exposure";
import { remediationSteps } from "@/lib/remediation";
import { dataClassSeverity, SLA_DAYS } from "@/lib/severity";
import { getToday } from "@/lib/today";
import { getBreachByName, userExposuresInBreach } from "@/server/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Breach" };

export default async function BreachDetailPage(props: PageProps<"/breaches/[name]">) {
  const user = await requireUser();
  const { name } = await props.params;
  const db = getDb();
  const b = await getBreachByName(db, decodeURIComponent(name));
  if (!b) notFound();
  const mine = await userExposuresInBreach(db, user.id, b.id);
  const today = getToday();

  return (
    <>
      <Link href="/breaches" className="hint row" style={{ gap: 4 }}>
        <ChevronLeft size={14} aria-hidden /> Breach catalog
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">{b.domain || "Breach"}</div>
          <h1>{b.title}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <SeverityBadge severity={b.severity} />
            <span className="cell-sub">deadline when detected: {SLA_DAYS[b.severity]} days</span>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="panel stat">
          <span className="label">Accounts</span>
          <span className="value">{b.pwnCount.toLocaleString("en-US")}</span>
        </div>
        <div className="panel stat">
          <span className="label">Breach date</span>
          <span className="value" style={{ fontSize: 20 }}>
            {formatDate(b.breachDate)}
          </span>
        </div>
        <div className="panel stat">
          <span className="label">Made public</span>
          <span className="value" style={{ fontSize: 20 }}>
            {formatDate(b.addedDate)}
          </span>
        </div>
        <div className="panel stat">
          <span className="label">Data types</span>
          <span className="value">{b.dataClasses.length}</span>
        </div>
      </div>

      <div className="grid grid-wide">
        <section className="panel">
          <div className="panel-head">
            <h2>What happened</h2>
          </div>
          <div className="panel-body stack">
            <p className="desc">{b.description}</p>
            <div className="chips">
              {b.dataClasses.map((c) => (
                <span className="chip" key={c}>
                  <span className="dot" style={{ background: `var(--${dataClassSeverity(c)})` }} aria-hidden />
                  {c}
                </span>
              ))}
            </div>
            <div>
              <div className="nav-label" style={{ padding: "8px 0 6px" }}>
                Recommended response
              </div>
              <ul className="text-2" style={{ margin: 0, paddingLeft: 18 }}>
                {remediationSteps(b.dataClasses).map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="panel" data-testid="your-exposure">
          <div className="panel-head">
            <h2>Your exposure</h2>
          </div>
          {mine.length === 0 ? (
            <div className="callout ok" style={{ margin: 16 }}>
              <ShieldCheck size={20} className="t-good" aria-hidden />
              <div>
                <strong>Not affected</strong>
                <p className="text-2">None of your monitored assets were found in this breach.</p>
              </div>
            </div>
          ) : (
            <div className="list">
              <div className="callout bad" style={{ margin: 16 }}>
                <ShieldX size={20} className="t-critical" aria-hidden />
                <div>
                  <strong>{mine.length} of your identities are in this breach</strong>
                </div>
              </div>
              {mine.map((e) => (
                <Link key={e.id} href={`/exposures/${e.id}`} className="list-item" style={{ textDecoration: "none" }}>
                  <span className="grow mono">{e.emailMasked}</span>
                  <StatusBadge status={exposureStatus(e, today)} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
