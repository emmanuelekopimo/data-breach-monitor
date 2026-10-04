export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Data that lets an attacker log in or take money: act within days. */
const CRITICAL_CLASSES = new Set([
  "Passwords",
  "Auth tokens",
  "Credit cards",
  "Bank account numbers",
  "Social security numbers",
  "Government issued IDs",
  "Passport numbers",
  "Security questions and answers",
  "Credit card CVV",
]);

/** Data that enables identity theft or targeted phishing. */
const HIGH_CLASSES = new Set([
  "Partial credit card data",
  "Dates of birth",
  "Phone numbers",
  "Physical addresses",
  "Personal health data",
  "Password hints",
  "Payment histories",
  "Account balances",
  "Private messages",
  "Email messages",
  "Driver's licenses",
  "Income levels",
]);

/** Data that identifies a person or account. */
const MEDIUM_CLASSES = new Set([
  "Names",
  "Usernames",
  "IP addresses",
  "Geographic locations",
  "Employers",
  "Job titles",
  "Social media profiles",
  "Device information",
  "Genders",
]);

/** Severity of a breach is decided by the most dangerous data class it exposed. */
export function classifySeverity(dataClasses: readonly string[]): Severity {
  if (dataClasses.some((c) => CRITICAL_CLASSES.has(c))) return "critical";
  if (dataClasses.some((c) => HIGH_CLASSES.has(c))) return "high";
  if (dataClasses.some((c) => MEDIUM_CLASSES.has(c))) return "medium";
  return "low";
}

/** Remediation deadline, in days after the exposure is detected. */
export const SLA_DAYS: Record<Severity, number> = {
  critical: 3,
  high: 7,
  medium: 14,
  low: 30,
};

/** Points each unresolved exposure adds to the risk score. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 12,
  high: 6,
  medium: 2,
  low: 1,
};

export function severityRank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

export function dataClassSeverity(dataClass: string): Severity {
  return classifySeverity([dataClass]);
}
