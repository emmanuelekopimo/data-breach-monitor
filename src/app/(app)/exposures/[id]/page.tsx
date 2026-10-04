import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, ExternalLink, ListChecks, RotateCcw, ShieldCheck } from "lucide-react";
import { resolveAction, toggleStepAction } from "@/app/actions/exposures";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { SubmitButton } from "@/components/submit-button";
import { getDb } from "@/db";
import { formatDate, relativeDays } from "@/lib/dates";
import { daysOverdue, exposureStatus } from "@/lib/exposure";
import { compactNumber } from "@/lib/format";
import { remediationSteps } from "@/lib/remediation";
import { dataClassSeverity, SLA_DAYS } from "@/lib/severity";
import { getToday } from "@/lib/today";
import { getExposure } from "@/server/queries";
import { requireUser } from "@/server/session";
import { NotesForm } from "./notes-form";

export const metadata: Metadata = { title: "Exposure" };

export default async function ExposureDetailPage(props: PageProps<"/exposures/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const exposureId = Number(id);
  if (!Number.isInteger(exposureId)) notFound();
  const r = await getExposure(getDb(), user.id, exposureId);
  if (!r) notFound();

  const today = getToday();
  const status = exposureStatus(r, today);
  const steps = remediationSteps(r.dataClasses);
  const done = steps.filter((s) => r.stepsDone.includes(s.id)).length;

  return (
    <>
      <Link href="/exposures" className="hint row" style={{ gap: 4 }}>
        <ChevronLeft size={14} aria-hidden /> All exposures
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finding #{r.id}</div>
          <h1>
            {r.emailMasked} in {r.breachTitle}
          </h1>
          <div className="row" style={{ marginTop: 8 }}>
            <SeverityBadge severity={r.severity} />
            <StatusBadge status={status} />
            <span className="cell-sub">
              via {r.assetKind === "domain" ? `domain *@${r.assetValue}` : r.assetValue}
              {r.assetLabel ? ` (${r.assetLabel})` : ""}
            </span>
          </div>
        </div>
        <form action={resolveAction}>
          <input type="hidden" name="id" value={r.id} />
          {status === "resolved" ? (
            <>
              <input type="hidden" name="reopen" value="true" />
              <SubmitButton className="btn" pendingText="Reopening...">
                <RotateCcw size={15} aria-hidden /> Reopen
              </SubmitButton>
            </>
          ) : (
            <SubmitButton className="btn btn-primary" pendingText="Saving..." data-testid="resolve">
              <ShieldCheck size={15} aria-hidden /> Mark resolved
            </SubmitButton>
          )}
        </form>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Remediation deadline</h2>
          <span className="hint">
            {r.severity} findings must be resolved within {SLA_DAYS[r.severity]} days
          </span>
        </div>
        <div className="panel-body">
          <div className="timeline">
            <div className="tl">
              <span>Detected</span>
              <strong>{formatDate(r.detectedOn)}</strong>
            </div>
            <div className="tl" style={status === "overdue" ? { borderColor: "var(--critical)" } : undefined}>
              <span>Deadline</span>
              <strong>{formatDate(r.dueOn)}</strong>
              <span className={status === "overdue" ? "t-critical" : ""}>{status === "overdue" ? `${daysOverdue(r, today)} days overdue` : status === "resolved" ? "met or closed" : relativeDays(r.dueOn, today)}</span>
            </div>
            <div className="tl" style={status === "resolved" ? { borderColor: "var(--good)" } : undefined}>
              <span>{r.resolvedOn ? "Resolved" : "Today"}</span>
              <strong>{formatDate(r.resolvedOn ?? today)}</strong>
              {r.resolvedOn ? <span className={r.resolvedOn > r.dueOn ? "t-medium" : "t-good"}>{r.resolvedOn > r.dueOn ? "resolved late" : "on time"}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-wide">
        <section className="panel">
          <div className="panel-head">
            <h2>
              <ListChecks size={16} aria-hidden /> Response checklist
            </h2>
            <span className="hint" data-testid="steps-progress">
              {done}/{steps.length} done
            </span>
          </div>
          <div className="panel-body stack">
            <div className="progress" aria-hidden>
              <div style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <div className="steps">
              {steps.map((s) => {
                const isDone = r.stepsDone.includes(s.id);
                return (
                  <form key={s.id} action={toggleStepAction} className="step" data-done={isDone}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="step" value={s.id} />
                    <input type="hidden" name="done" value={String(!isDone)} />
                    <button type="submit" className="step-check" aria-label={`${isDone ? "Undo" : "Complete"}: ${s.title}`} aria-pressed={isDone}>
                      {isDone ? <Check size={15} aria-hidden /> : null}
                    </button>
                    <div>
                      <div className="step-title">{s.title}</div>
                      <div className="step-detail">{s.detail}</div>
                    </div>
                  </form>
                );
              })}
            </div>
            <NotesForm id={r.id} notes={r.notes} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Breach intel</h2>
            <Link className="hint row" style={{ gap: 4 }} href={`/breaches/${r.breachName}`}>
              catalog entry <ExternalLink size={12} aria-hidden />
            </Link>
          </div>
          <div className="panel-body stack">
            <dl className="kv">
              <dt>Service</dt>
              <dd>{r.breachDomain ?? r.breachTitle}</dd>
              <dt>Breach date</dt>
              <dd>{formatDate(r.breachDate)}</dd>
              <dt>Accounts</dt>
              <dd className="mono">{compactNumber(r.pwnCount)}</dd>
            </dl>
            <div>
              <div className="nav-label" style={{ padding: "0 0 6px" }}>
                Data exposed
              </div>
              <div className="chips">
                {r.dataClasses.map((c) => (
                  <span className="chip" key={c}>
                    <span className="dot" style={{ background: `var(--${dataClassSeverity(c)})` }} aria-hidden />
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <p className="desc">{r.description}</p>
          </div>
        </section>
      </div>
    </>
  );
}
