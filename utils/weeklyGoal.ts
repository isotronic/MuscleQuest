import { endOfWeek, startOfWeek } from "date-fns";
import { isLocalDateInRange } from "@/utils/dates";

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
  today: Date = new Date(),
): boolean {
  if (goal <= 0) return false;
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
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
