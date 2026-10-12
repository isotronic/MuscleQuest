import { addDays, endOfDay, startOfWeek } from "date-fns";
import { localDateKeyToDate, toLocalDateKey } from "@/utils/dates";

// The one place a week's first day is decided. Everything that groups days
// into weeks (the weekly goal, the streak, the home week row, stats) goes
// through here, so a change of the user's week start reaches all of them.

/** The first day of a week, as date-fns counts: 0 is Sunday, 1 is Monday. */
export type WeekStartDay = 0 | 1;

/**
 * How days group into weeks. A change of week start applies to future weeks
 * only: days before `from` keep the `previous` rule, and the week that was
 * running when the user changed it stretches or shrinks to meet `from`, so no
 * day belongs to two weeks and none falls between them.
 */
export interface WeekRule {
  weekStartsOn: WeekStartDay;
  /** The rule for training days before `from`. */
  previous?: WeekStartDay;
  /** "YYYY-MM-DD": the first day of the first week under `weekStartsOn`. */
  from?: string;
}

/** Monday weeks, as the app counted before the setting existed. */
export const DEFAULT_WEEK_RULE: WeekRule = { weekStartsOn: 1 };

export function parseWeekStartDay(
  value: string | null | undefined,
): WeekStartDay | undefined {
  if (value === "0") return 0;
  if (value === "1") return 1;
  return undefined;
}

export interface WeekRuleSettings {
  weekStartsOn?: string | null;
  weekStartsOnPrevious?: string | null;
  weekStartsOnFrom?: string | null;
}

export function weekRuleFromSettings(
  settings: WeekRuleSettings | null | undefined,
): WeekRule {
  const weekStartsOn = parseWeekStartDay(settings?.weekStartsOn) ?? 1;
  const previous = parseWeekStartDay(settings?.weekStartsOnPrevious);
  const from = settings?.weekStartsOnFrom || undefined;
  if (previous === undefined || !from || previous === weekStartsOn) {
    return { weekStartsOn };
  }
  return { weekStartsOn, previous, from };
}

/** The setting values that store `rule`; "" clears a key. */
export function weekRuleToSettings(rule: WeekRule): Required<{
  [K in keyof WeekRuleSettings]: string;
}> {
  return {
    weekStartsOn: String(rule.weekStartsOn),
    weekStartsOnPrevious:
      rule.previous === undefined ? "" : String(rule.previous),
    weekStartsOnFrom: rule.from ?? "",
  };
}

const shiftKey = (key: string, days: number) =>
  toLocalDateKey(addDays(localDateKeyToDate(key), days));

const plainWeekStartKey = (key: string, day: WeekStartDay) =>
  toLocalDateKey(startOfWeek(localDateKeyToDate(key), { weekStartsOn: day }));

/**
 * The first new-rule week begins at the new-rule week start closest to one
 * week after the running week began: Monday to Sunday gives a six-day
 * transition week, Sunday to Monday an eight-day one.
 */
const transitionFromKey = (oldWeekStart: string, next: WeekStartDay) =>
  plainWeekStartKey(shiftKey(oldWeekStart, 10), next);

/** The week start that was running when the rule changed. */
const transitionWeekStartKey = (from: string, previous: WeekStartDay) =>
  plainWeekStartKey(shiftKey(from, -4), previous);

const hasTransition = (
  rule: WeekRule,
): rule is Required<Pick<WeekRule, "previous" | "from">> & WeekRule =>
  rule.previous !== undefined && !!rule.from;

/** The week start that applies on a training day. */
export function weekStartsOnFor(
  localDate: string,
  rule: WeekRule,
): WeekStartDay {
  if (hasTransition(rule) && localDate < rule.from) return rule.previous;
  return rule.weekStartsOn;
}

/** The week start that applies today, for laying out a week row. */
export function weekStartsOnToday(
  rule: WeekRule,
  today: Date = new Date(),
): WeekStartDay {
  return weekStartsOnFor(toLocalDateKey(today), rule);
}

/** The `week_start` key ("YYYY-MM-DD") of the week a training day is in. */
export function weekStartKeyFor(localDate: string, rule: WeekRule): string {
  if (!hasTransition(rule) || localDate >= rule.from) {
    return plainWeekStartKey(localDate, rule.weekStartsOn);
  }
  const transitionStart = transitionWeekStartKey(rule.from, rule.previous);
  if (localDate >= transitionStart) return transitionStart;
  return plainWeekStartKey(localDate, rule.previous);
}

/** The last training day ("YYYY-MM-DD") of the week starting `weekStart`. */
export function weekEndKey(weekStart: string, rule: WeekRule): string {
  const end = shiftKey(weekStart, 6);
  if (!hasTransition(rule) || weekStart >= rule.from) return end;
  if (weekStart === transitionWeekStartKey(rule.from, rule.previous)) {
    return shiftKey(rule.from, -1);
  }
  return end;
}

/** The first day of the week before the one starting `weekStart`. */
export function previousWeekStartKey(
  weekStart: string,
  rule: WeekRule,
): string {
  return weekStartKeyFor(shiftKey(weekStart, -1), rule);
}

/** Local midnight on the first day of the week `date` is in. */
export function startOfAppWeek(date: Date, rule: WeekRule): Date {
  return localDateKeyToDate(weekStartKeyFor(toLocalDateKey(date), rule));
}

/** The last moment of the last day of the week `date` is in. */
export function endOfAppWeek(date: Date, rule: WeekRule): Date {
  const start = weekStartKeyFor(toLocalDateKey(date), rule);
  return endOfDay(localDateKeyToDate(weekEndKey(start, rule)));
}

/** The first day of the week before the one `date` is in. */
export function startOfPreviousAppWeek(date: Date, rule: WeekRule): Date {
  const start = weekStartKeyFor(toLocalDateKey(date), rule);
  return localDateKeyToDate(previousWeekStartKey(start, rule));
}

/**
 * The rule after the user picks `next` as their week start on `today`. The
 * running week keeps its start; the new rule begins with the next week.
 * Picking the old start again before the change took effect undoes it.
 *
 * Only one change is remembered: after a second change, days before the
 * first one group by the rule that was replaced. Stored weekly_completions
 * rows keep their keys either way.
 */
export function changeWeekStart(
  rule: WeekRule,
  next: WeekStartDay,
  today: Date = new Date(),
): WeekRule {
  const todayKey = toLocalDateKey(today);
  const inEffect = weekStartsOnFor(todayKey, rule);
  const pending = hasTransition(rule) && todayKey < rule.from;
  if (next === inEffect) {
    return pending ? { weekStartsOn: next } : rule;
  }
  if (pending) return rule; // `next` is already the pending rule
  const runningWeekStart = weekStartKeyFor(todayKey, rule);
  let from = transitionFromKey(runningWeekStart, next);
  // Changed on the running week's last day (Monday to Sunday, on a Sunday):
  // the new rule would start today and move today into a second week, so
  // the transition week is the next one instead.
  if (from <= todayKey) from = shiftKey(from, 7);
  return { weekStartsOn: next, previous: inEffect, from };
}

/**
 * Day indices in the app's 0 = Monday … 6 = Sunday numbering (plan schedules),
 * in the order a week row shows them for this week start.
 */
export function weekDayOrder(weekStartsOn: WeekStartDay): number[] {
  return weekStartsOn === 0 ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
}

/**
 * Days since the start of a plain seven-day week. For chart buckets and the
 * heatmap, which keep whole weeks aligned to the week start in effect today
 * (weekStartsOnToday) rather than following a transition week.
 */
export function daysIntoWeek(date: Date, weekStartsOn: WeekStartDay): number {
  return (date.getDay() - weekStartsOn + 7) % 7;
}

/** A date's index in the 0 = Monday … 6 = Sunday numbering. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * The number of distinct training days within the week starting `weekStart`.
 * This is the "completed" figure a weekly_completions row records.
 */
export function countTrainingDaysInWeek(
  workouts: readonly { local_date: string }[],
  weekStart: string,
  rule: WeekRule,
): number {
  const end = weekEndKey(weekStart, rule);
  const days = new Set<string>();
  for (const { local_date } of workouts) {
    if (local_date && local_date >= weekStart && local_date <= end) {
      days.add(local_date);
    }
  }
  return days.size;
}
