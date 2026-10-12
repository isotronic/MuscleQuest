import { toLocalDateKey } from "@/utils/dates";
import { getISOWeek } from "@/utils/isoWeek";
import { weekStartKeyFor, type WeekRule } from "@/utils/week";

// The plan's deload week is stored as the first day ("YYYY-MM-DD") of the
// user's week, so it covers the same days as their weekly goal. Before the
// week start setting it was an ISO week ("2026-W42", Monday to Sunday); such
// a value is still read until its week is over.
const LEGACY_ISO_WEEK = /^\d{4}-W\d{2}$/;

/** The value to store for a deload during the week `date` is in. */
export function deloadWeekKey(date: Date, rule: WeekRule): string {
  return weekStartKeyFor(toLocalDateKey(date), rule);
}

/** True when `date` falls in the stored deload week. */
export function isDeloadWeek(
  stored: string | null | undefined,
  date: Date,
  rule: WeekRule,
): boolean {
  if (!stored) return false;
  if (LEGACY_ISO_WEEK.test(stored)) return stored === getISOWeek(date);
  return stored === deloadWeekKey(date, rule);
}
