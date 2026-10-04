import type { ThreatLevel } from "@/lib/exposure";

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  low: "var(--good)",
  guarded: "var(--low)",
  elevated: "var(--high)",
  severe: "var(--critical)",
};

const LEVEL_TEXT: Record<ThreatLevel, string> = {
  low: "No urgent action. Keep monitoring.",
  guarded: "A few open findings. Work through the queue this week.",
  elevated: "Several unresolved or overdue findings need attention.",
  severe: "Critical exposures are open past their deadline. Act today.",
};

/** Semi-circle gauge for the 0 to 100 risk score. The score and level are always printed. */
export function ThreatGauge({ score, level }: { score: number; level: ThreatLevel }) {
  const r = 80;
  const len = Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * len;
  return (
    <div className="gauge" data-testid="threat-gauge">
      <svg viewBox="0 0 200 120" role="img" aria-label={`Risk score ${score} out of 100, threat level ${level}`}>
        <path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="var(--panel-3)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 105 A80 80 0 0 1 180 105"
          fill="none"
          stroke={LEVEL_COLOR[level]}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${len}`}
        />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = Math.PI * (1 - t / 100);
          return <line key={t} x1={100 + 64 * Math.cos(a)} y1={105 - 64 * Math.sin(a)} x2={100 + 58 * Math.cos(a)} y2={105 - 58 * Math.sin(a)} stroke="var(--muted)" strokeWidth="1.5" />;
        })}
        <text x="100" y="92" textAnchor="middle" fontFamily="var(--mono)" fontSize="34" fontWeight="700" fill="var(--text)">
          {score}
        </text>
        <text x="100" y="112" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--muted)" letterSpacing="1.5">
          RISK SCORE / 100
        </text>
      </svg>
      <div className={`level level-${level}`} data-testid="threat-level">
        THREAT LEVEL: {level.toUpperCase()}
      </div>
      <p className="explain">{LEVEL_TEXT[level]}</p>
    </div>
  );
}
