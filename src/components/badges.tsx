import { CircleAlert, CircleCheck, CircleDot, Hourglass, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { STATUS_LABEL, type ExposureStatus } from "@/lib/exposure";
import type { Severity } from "@/lib/severity";

const SEV_ICON = { critical: OctagonAlert, high: TriangleAlert, medium: CircleAlert, low: Info } as const;

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = SEV_ICON[severity];
  return (
    <span className={`badge sev-${severity}`} data-severity={severity}>
      <Icon size={12} aria-hidden />
      {severity}
    </span>
  );
}

const STATUS_ICON = { overdue: OctagonAlert, "due-soon": Hourglass, open: CircleDot, resolved: CircleCheck } as const;

export function StatusBadge({ status }: { status: ExposureStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`badge st-${status}`} data-status={status}>
      <Icon size={12} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
