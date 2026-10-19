import { differenceInCalendarDays } from "date-fns";
import type { Workout } from "@/store/workoutStore";
import type { PlanScheduleEntry } from "@/utils/database";
import { localDateKeyToDate } from "@/utils/dates";

export type TodayHero =
  | { kind: "noPlan" }
  /** A plan is active but has no workouts (new, or all removed). */
  | { kind: "emptyPlan" }
  | { kind: "done" }
  | {
      kind: "workout";
      workout: Workout;
      /** Its position in the plan, for workout-details and the fallback name. */
      workoutIndex: number;
      restDay: boolean;
      /** True when the schedule puts this workout on today. */
      scheduledToday: boolean;
      /** The next scheduled day for it (0=Mon … 6=Sun), null without a schedule. */
      nextDow: number | null;
      /** Calendar days since it was last done, null when not in recent history. */
      lastDoneDaysAgo: number | null;
    };

export interface RecentPlanSession {
  plan_id: number;
  workout_id: number;
  /** The training day, "YYYY-MM-DD". */
  local_date: string;
}

/**
 * What the home screen's Today card shows: the plan's next workout (today's
 * scheduled one, the next in rotation, or on a rest day the next scheduled
 * one), the done-for-today state, a prompt to add workouts to an empty
 * plan, or a prompt to pick a plan.
 *
 * @param orderedWorkouts - The plan's workouts in home order
 *   (planWorkoutsForWeek), so the first is the one to do next.
 */
export function todayHero({
  planId,
  planWorkouts,
  orderedWorkouts,
  schedule,
  isRestDay,
  doneToday,
  todayDow,
  todayKey,
  recentSessions,
}: {
  planId: number | null | undefined;
  planWorkouts: Workout[];
  orderedWorkouts: Workout[];
  schedule: PlanScheduleEntry[] | null | undefined;
  isRestDay: boolean;
  doneToday: boolean;
  todayDow: number;
  todayKey: string;
  recentSessions: RecentPlanSession[];
}): TodayHero {
  if (planId == null) return { kind: "noPlan" };
  const workout = orderedWorkouts[0];
  // Before done-for-today: a quick workout logged today would hide it.
  if (!workout) return { kind: "emptyPlan" };
  if (doneToday) return { kind: "done" };

  let nextDow: number | null = null;
  let scheduledToday = false;
  if (schedule?.length) {
    scheduledToday =
      !isRestDay &&
      schedule.some(
        (e) => e.day_of_week === todayDow && e.workout_id === workout.id,
      );
    if (!scheduledToday) {
      for (let i = 1; i <= 7; i++) {
        const dow = (todayDow + i) % 7;
        if (
          schedule.some(
            (e) => e.day_of_week === dow && e.workout_id === workout.id,
          )
        ) {
          nextDow = dow;
          break;
        }
      }
    }
  }

  let lastKey: string | null = null;
  for (const s of recentSessions) {
    if (String(s.plan_id) !== String(planId) || s.workout_id !== workout.id) {
      continue;
    }
    if (lastKey == null || s.local_date > lastKey) lastKey = s.local_date;
  }
  const lastDoneDaysAgo =
    lastKey == null
      ? null
      : differenceInCalendarDays(
          localDateKeyToDate(todayKey),
          localDateKeyToDate(lastKey),
        );

  return {
    kind: "workout",
    workout,
    workoutIndex: planWorkouts.findIndex((w) => w.id === workout.id),
    restDay: isRestDay,
    scheduledToday,
    nextDow,
    lastDoneDaysAgo,
  };
}
