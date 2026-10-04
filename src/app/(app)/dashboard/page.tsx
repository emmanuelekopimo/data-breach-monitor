import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarClock, ChevronRight, CircleCheck, Database, ListChecks, OctagonAlert, Radar, ShieldAlert } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { ScanConsole } from "@/components/scan-console";
import { SeverityBars } from "@/components/severity-bars";
import { ThreatGauge } from "@/components/threat-gauge";
import { getDb } from "@/db";
import { daysOverdue, exposureStatus } from "@/lib/exposure";
import { formatDate, relativeDays } from "@/lib/dates";
import { compactNumber } from "@/lib/format";
import { getToday } from "@/lib/today";
import { getDashboard } from "@/server/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = getToday();
  const d = await getDashboard(getDb(), user.id, today);
  const s = d.summary;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Security overview</div>
          <h1>Welcome back, {user.name.split(" ")[0]}</h1>
          <p>Exposure status for every email address and domain you monitor, scored against remediation deadlines.</p>
        </div>
        <Link className="btn" href="/exposures?status=overdue">
          <OctagonAlert size={15} aria-hidden /> View overdue
        </Link>
      </div>

      <div className="grid grid-hero">
        <section className="panel" aria-labelledby="risk-h">
          <div className="panel-head">
            <h2 id="risk-h">
              <Activity size={16} aria-hidden /> Risk posture
            </h2>
            <span className="hint">0 to 100</span>
          </div>
          <ThreatGauge score={s.score} level={s.level} />
        </section>

        <div className="stack">
          <div className="grid grid-4">
            <div className="panel stat" data-testid="stat-assets">
              <span className="label">
                <Radar size={13} aria-hidden /> Assets
              </span>
              <span className="value">{d.assetCount}</span>
              <span className="sub">emails and domains</span>
            </div>
            <div className="panel stat" data-testid="stat-open">
              <span className="label">
                <ShieldAlert size={13} aria-hidden /> Unresolved
              </span>
              <span className="value">{s.unresolved}</span>
              <span className="sub">{s.dueSoon} due in 2 days</span>
            </div>
            <div className="panel stat" data-testid="stat-overdue">
              <span className="label">
                <CalendarClock size={13} aria-hidden /> Overdue
              </span>
              <span className={`value ${s.overdue ? "t-critical" : ""}`}>{s.overdue}</span>
              <span className="sub">past remediation deadline</span>
            </div>
            <div className="panel stat" data-testid="stat-resolved">
              <span className="label">
                <CircleCheck size={13} aria-hidden /> Resolved
              </span>
              <span className="value t-good">{s.resolved}</span>
              <span className="sub">of {s.total} findings</span>
            </div>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2>Unresolved by severity</h2>
              <span className="hint">deadline: critical 3d, high 7d, medium 14d, low 30d</span>
            </div>
            <div className="panel-body">
              <SeverityBars counts={s.bySeverity} />
            </div>
          </section>
        </div>
      </div>

      <div className="grid grid-wide">
        <section className="panel" aria-labelledby="queue-h">
          <div className="panel-head">
            <h2 id="queue-h">
              <ListChecks size={16} aria-hidden /> Remediation queue
            </h2>
            <Link className="hint" href="/exposures">
              all exposures
            </Link>
          </div>
          {d.queue.length === 0 ? (
            <div className="empty">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/all-clear.svg" width={120} height={96} alt="" />
              <strong>All clear</strong>
              <span>No unresolved exposures. Run a scan to check again.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data" data-testid="queue">
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th className="hide-sm">Severity</th>
                    <th className="hide-sm">Status</th>
                    <th className="hide-sm">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {d.queue.map((r) => {
                    const st = exposureStatus(r, today);
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link className="row-link" href={`/exposures/${r.id}`}>
                            {r.breachTitle}
                          </Link>
                          <span className="cell-sub">{r.emailMasked}</span>
                          <span className="show-sm">
                            <SeverityBadge severity={r.severity} />
                            <StatusBadge status={st} />
                          </span>
                        </td>
                        <td className="hide-sm">
                          <SeverityBadge severity={r.severity} />
                        </td>
                        <td className="hide-sm">
                          <StatusBadge status={st} />
                        </td>
                        <td className="hide-sm nowrap">
                          <span className={st === "overdue" ? "t-critical" : "text-2"}>{st === "overdue" ? `${daysOverdue(r, today)}d overdue` : relativeDays(r.dueOn, today)}</span>
                          <span className="cell-sub">{formatDate(r.dueOn)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ScanConsole assetCount={d.assetCount} />
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <Database size={16} aria-hidden /> Latest breaches in the wild
            </h2>
            <Link className="hint" href="/breaches">
              breach intel
            </Link>
          </div>
          <div className="list">
            {d.latestBreaches.map((b) => (
              <Link key={b.id} href={`/breaches/${b.name}`} className="list-item" style={{ textDecoration: "none" }}>
                <div className="grow">
                  <span className="title">{b.title}</span>
                  <span className="cell-sub">
                    added {formatDate(b.addedDate)} / {compactNumber(b.pwnCount)} accounts
                  </span>
                </div>
                <SeverityBadge severity={b.severity} />
                <ChevronRight size={16} className="muted" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>
              <Activity size={16} aria-hidden /> Recent detections
            </h2>
          </div>
          <div className="list">
            {d.recent.map((r) => (
              <Link key={r.id} href={`/exposures/${r.id}`} className="list-item" style={{ textDecoration: "none" }}>
                <div className="grow">
                  <span className="title">{r.breachTitle}</span>
                  <span className="cell-sub">
                    {r.emailMasked} / detected {relativeDays(r.detectedOn, today)}
                  </span>
                </div>
                <StatusBadge status={exposureStatus(r, today)} />
              </Link>
            ))}
            {d.recentScans[0] ? (
              <div className="list-item">
                <span className="cell-sub">
                  Last scan {formatDate(d.recentScans[0].ranOn)}: {d.recentScans[0].assetsChecked} assets, {d.recentScans[0].recordsMatched} records matched, {d.recentScans[0].newExposures} new
                </span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
