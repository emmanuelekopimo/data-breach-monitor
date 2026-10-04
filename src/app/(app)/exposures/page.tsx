import type { Metadata } from "next";
import Link from "next/link";
import { Filter } from "lucide-react";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { getDb } from "@/db";
import { formatDate, relativeDays } from "@/lib/dates";
import { daysOverdue, exposureStatus } from "@/lib/exposure";
import { getToday } from "@/lib/today";
import { filterExposures, listExposures } from "@/server/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Exposures" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ExposuresPage(props: PageProps<"/exposures">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const filter = { status: one(sp.status) || "all", severity: one(sp.severity) || "all", q: one(sp.q) };
  const today = getToday();
  const all = await listExposures(getDb(), user.id, today);
  const rows = filterExposures(all, today, filter);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Findings</div>
          <h1>Exposures</h1>
          <p>Each row is one monitored identity found in one breach. Overdue findings are listed first, then by severity and deadline.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-body">
          {/* Plain GET form: filters live in the URL, selects stay uncontrolled. */}
          <form className="filters" method="get" data-testid="exposure-filters">
            <div className="field">
              <label htmlFor="status">Status</label>
              <select className="select" id="status" name="status" defaultValue={filter.status}>
                <option value="all">All</option>
                <option value="active">All unresolved</option>
                <option value="overdue">Overdue</option>
                <option value="due-soon">Due soon</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="severity">Severity</label>
              <select className="select" id="severity" name="severity" defaultValue={filter.severity}>
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="field grow">
              <label htmlFor="q">Search</label>
              <input className="input" id="q" name="q" defaultValue={filter.q} placeholder="breach, address or label" />
            </div>
            <button className="btn" type="submit">
              <Filter size={14} aria-hidden /> Apply
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 data-testid="exposure-count">
            {rows.length} of {all.length} exposure(s)
          </h2>
          {rows.length !== all.length ? (
            <Link className="hint" href="/exposures">
              clear filters
            </Link>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <div className="empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/radar-empty.svg" width={120} height={96} alt="" />
            <span>No exposures match these filters.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data" data-testid="exposures-table">
              <thead>
                <tr>
                  <th>Breach</th>
                  <th className="hide-sm">Severity</th>
                  <th className="hide-sm">Status</th>
                  <th className="hide-sm">Asset</th>
                  <th className="hide-sm">Detected</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
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
                      <td className="hide-sm">
                        <span className="text-2">{r.assetLabel || r.assetKind}</span>
                        <span className="cell-sub">{r.assetKind === "domain" ? `*@${r.assetValue}` : r.assetValue}</span>
                      </td>
                      <td className="hide-sm nowrap text-2">{formatDate(r.detectedOn)}</td>
                      <td className="nowrap">
                        {st === "resolved" ? (
                          <span className="t-good">resolved {formatDate(r.resolvedOn!)}</span>
                        ) : st === "overdue" ? (
                          <span className="t-critical">{daysOverdue(r, today)}d overdue</span>
                        ) : (
                          <span className="text-2">{relativeDays(r.dueOn, today)}</span>
                        )}
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
    </>
  );
}
