import { addDays, format, startOfWeek } from "date-fns";
import { localDateKeyToDate, toLocalDateKey } from "@/utils/dates";

// Weeks start on Monday everywhere the weekly goal is counted.
const WEEK_STARTS_ON = 1;

/** The `week_start` key ("YYYY-MM-DD", a Monday) of the week a training day is in. */
export function weekStartKeyFor(localDate: string): string {
  return format(
    startOfWeek(localDateKeyToDate(localDate), {
      weekStartsOn: WEEK_STARTS_ON,
    }),
    "yyyy-MM-dd",
  );
}

/** The last training day ("YYYY-MM-DD", a Sunday) of the week starting `weekStart`. */
export function weekEndKey(weekStart: string): string {
  return toLocalDateKey(addDays(localDateKeyToDate(weekStart), 6));
}

/**
 * The number of distinct training days within the week starting `weekStart`.
 * This is the "completed" figure a weekly_completions row records.
 */
export function countTrainingDaysInWeek(
  workouts: readonly { local_date: string }[],
  weekStart: string,
): number {
  const end = weekEndKey(weekStart);
  const days = new Set<string>();
  for (const { local_date } of workouts) {
    if (local_date && local_date >= weekStart && local_date <= end) {
      days.add(local_date);
    }
  }
  return days.size;
}
