import { SEVERITIES, type Severity } from "@/lib/severity";
import { SeverityBadge } from "./badges";

/** Unresolved exposures per severity. Each bar is labelled with its name and count. */
export function SeverityBars({ counts }: { counts: Record<Severity, number> }) {
  const max = Math.max(1, ...SEVERITIES.map((s) => counts[s]));
  return (
    <div className="sevbars">
      {SEVERITIES.map((s) => (
        <div className="sevbar" key={s} title={`${counts[s]} unresolved ${s}`}>
          <SeverityBadge severity={s} />
          <div className="track">
            <div className="fill" style={{ width: `${(counts[s] / max) * 100}%`, background: `var(--${s})` }} />
          </div>
          <span className="n">{counts[s]}</span>
        </div>
      ))}
    </div>
  );
}
