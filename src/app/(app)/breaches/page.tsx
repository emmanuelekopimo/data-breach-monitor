import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SeverityBadge } from "@/components/badges";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { compactNumber } from "@/lib/format";
import { searchCatalog } from "@/server/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Breach intel" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function BreachesPage(props: PageProps<"/breaches">) {
  await requireUser();
  const sp = await props.searchParams;
  const q = one(sp.q);
  const severity = one(sp.severity) || "all";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const res = await searchCatalog(getDb(), { q, severity, page });
  const link = (p: number) => `/breaches?${new URLSearchParams({ ...(q ? { q } : {}), ...(severity !== "all" ? { severity } : {}), page: String(p) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Threat intelligence</div>
          <h1>Breach catalog</h1>
          <p>
            {res.totals.breaches} verified public breaches covering {compactNumber(res.totals.accounts)} accounts, from the Have I Been Pwned breach list (CC BY 4.0). Severity is set by the most sensitive data class exposed.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-body">
          <form className="filters" method="get">
            <div className="field grow">
              <label htmlFor="q">Search service or domain</label>
              <input className="input" id="q" name="q" defaultValue={q} placeholder="linkedin, canva.com..." />
            </div>
            <div className="field">
              <label htmlFor="severity">Severity</label>
              <select className="select" id="severity" name="severity" defaultValue={severity}>
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <button className="btn" type="submit">
              <Search size={14} aria-hidden /> Search
            </button>
          </form>
        </div>
      </section>

      <p className="cell-sub" data-testid="catalog-count">
        {res.total} result(s), newest breach first
      </p>
      <div className="breach-grid" data-testid="breach-grid">
        {res.rows.map((b) => (
          <Link key={b.id} href={`/breaches/${b.name}`} className="breach-card">
            <div className="meta">
              <span>{formatDate(b.breachDate)}</span>
              <span>{compactNumber(b.pwnCount)} accts</span>
            </div>
            <h3 title={b.title}>{b.title}</h3>
            <span className="cell-sub">{b.domain || "no domain"}</span>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <SeverityBadge severity={b.severity} />
              <span className="cell-sub">{b.dataClasses.length} data types</span>
            </div>
          </Link>
        ))}
      </div>
      {res.rows.length === 0 ? <div className="panel empty">No breaches match that search.</div> : null}
      <div className="panel pager">
        {res.page > 1 ? (
          <Link className="btn btn-sm" href={link(res.page - 1)}>
            <ChevronLeft size={14} aria-hidden /> Newer
          </Link>
        ) : (
          <span />
        )}
        <span className="mono">
          page {res.page} / {res.pages}
        </span>
        {res.page < res.pages ? (
          <Link className="btn btn-sm" href={link(res.page + 1)}>
            Older <ChevronRight size={14} aria-hidden />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
