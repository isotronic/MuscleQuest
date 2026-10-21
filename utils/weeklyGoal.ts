import { isLocalDateInRange } from "@/utils/dates";
import { endOfAppWeek, startOfAppWeek, type WeekRule } from "@/utils/week";

interface DatedWorkout {
  id: number;
  /** The training day, "YYYY-MM-DD". */
  local_date: string;
}

/**
 * True when this workout's day took the current week from one day short of
 * the goal to the goal. Counts training days, like the weekly goal banner,
 * and does not need the history to hold this workout yet.
 */
export function reachedGoalWithWorkout(
  workout: DatedWorkout,
  history: DatedWorkout[],
  goal: number,
  weekRule: WeekRule,
  today: Date = new Date(),
): boolean {
  if (goal <= 0) return false;
  const weekStart = startOfAppWeek(today, weekRule);
  const weekEnd = endOfAppWeek(today, weekRule);
  if (!isLocalDateInRange(workout.local_date, weekStart, weekEnd)) {
    return false;
  }
  const otherDays = new Set(
    history
      .filter(
        (w) =>
          w.id !== workout.id &&
          isLocalDateInRange(w.local_date, weekStart, weekEnd),
      )
      .map((w) => w.local_date),
  );
  if (otherDays.has(workout.local_date)) return false;
  return otherDays.size === goal - 1;
}

/** Distinct training days in the week holding `today`. */
export function trainingDaysThisWeek(
  history: { local_date: string }[],
  weekRule: WeekRule,
  today: Date = new Date(),
): number {
  const weekStart = startOfAppWeek(today, weekRule);
  const weekEnd = endOfAppWeek(today, weekRule);
  const thisWeek = history.filter((w) =>
    isLocalDateInRange(w.local_date, weekStart, weekEnd),
  );
  return new Set(thisWeek.map((w) => w.local_date)).size;
}
