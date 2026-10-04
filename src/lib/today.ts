import { isIsoDate, toIsoDate, type IsoDate } from "./dates";

/**
 * Returns "today" for all business rules. Set BREACHWATCH_TODAY=YYYY-MM-DD to
 * pin the date for demos and tests.
 */
export function getToday(env: Record<string, string | undefined> = process.env, now: Date = new Date()): IsoDate {
  const pinned = env.BREACHWATCH_TODAY?.trim();
  if (pinned) {
    if (!isIsoDate(pinned)) throw new Error(`BREACHWATCH_TODAY must be YYYY-MM-DD, got "${pinned}"`);
    return pinned;
  }
  return toIsoDate(now);
}
