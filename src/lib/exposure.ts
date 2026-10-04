import { addDays, daysBetween, type IsoDate } from "./dates";
import { SEVERITY_WEIGHT, SLA_DAYS, severityRank, type Severity } from "./severity";

export type ExposureStatus = "resolved" | "overdue" | "due-soon" | "open";

export const STATUS_LABEL: Record<ExposureStatus, string> = {
  resolved: "Resolved",
  overdue: "Overdue",
  "due-soon": "Due soon",
  open: "Open",
};

/** Days before the deadline when an open exposure is flagged as due soon. */
export const DUE_SOON_DAYS = 2;

export function dueDateFor(detectedOn: IsoDate, severity: Severity): IsoDate {
  return addDays(detectedOn, SLA_DAYS[severity]);
}

export type ExposureLike = {
  severity: Severity;
  dueOn: IsoDate;
  resolvedOn: IsoDate | null;
};

export function exposureStatus(e: ExposureLike, today: IsoDate): ExposureStatus {
  if (e.resolvedOn) return "resolved";
  const left = daysBetween(today, e.dueOn);
  if (left < 0) return "overdue";
  if (left <= DUE_SOON_DAYS) return "due-soon";
  return "open";
}

/** Days past the deadline (0 when not overdue). */
export function daysOverdue(e: ExposureLike, today: IsoDate): number {
  if (e.resolvedOn) return 0;
  return Math.max(0, daysBetween(e.dueOn, today));
}

/**
 * Risk score from 0 to 100. Each unresolved exposure adds its severity weight;
 * overdue exposures count one and a half times. The total is capped at 100.
 */
export function riskScore(exposures: readonly ExposureLike[], today: IsoDate): number {
  let score = 0;
  for (const e of exposures) {
    const status = exposureStatus(e, today);
    if (status === "resolved") continue;
    const weight = SEVERITY_WEIGHT[e.severity];
    score += status === "overdue" ? weight * 1.5 : weight;
  }
  return Math.min(100, Math.round(score));
}

export type ThreatLevel = "low" | "guarded" | "elevated" | "severe";

export function threatLevel(score: number): ThreatLevel {
  if (score >= 75) return "severe";
  if (score >= 45) return "elevated";
  if (score >= 15) return "guarded";
  return "low";
}

export type ExposureSummary = {
  total: number;
  unresolved: number;
  overdue: number;
  dueSoon: number;
  resolved: number;
  bySeverity: Record<Severity, number>;
  score: number;
  level: ThreatLevel;
};

export function summarize(exposures: readonly ExposureLike[], today: IsoDate): ExposureSummary {
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let overdue = 0;
  let dueSoon = 0;
  let resolved = 0;
  for (const e of exposures) {
    const status = exposureStatus(e, today);
    if (status === "resolved") {
      resolved++;
      continue;
    }
    bySeverity[e.severity]++;
    if (status === "overdue") overdue++;
    if (status === "due-soon") dueSoon++;
  }
  const score = riskScore(exposures, today);
  return {
    total: exposures.length,
    unresolved: exposures.length - resolved,
    overdue,
    dueSoon,
    resolved,
    bySeverity,
    score,
    level: threatLevel(score),
  };
}

/**
 * Order for the remediation queue: unresolved first, then overdue first,
 * then by severity, then by the earliest deadline.
 */
export function compareForQueue<T extends ExposureLike>(today: IsoDate) {
  const statusOrder: Record<ExposureStatus, number> = { overdue: 0, "due-soon": 1, open: 2, resolved: 3 };
  return (a: T, b: T): number => {
    const sa = statusOrder[exposureStatus(a, today)];
    const sb = statusOrder[exposureStatus(b, today)];
    if (sa !== sb) return sa - sb;
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    return a.dueOn.localeCompare(b.dueOn);
  };
}
