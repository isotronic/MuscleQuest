import type { Workout } from "@/store/workoutStore";
import type { PlanScheduleEntry } from "@/utils/database";

/**
 * Computes per-workout weekly completion targets and whether today is a rest day.
 * When a schedule exists, each workout's target equals the number of days it appears
 * in the schedule. Without a schedule the plan rotates in order (see
 * rotateFromLast) and there are no per-workout targets.
 */
export function computeWeeklyTargets(
  schedule: PlanScheduleEntry[] | null | undefined,
  todayDow: number,
): { perWorkoutTarget: Map<number, number>; isRestDay: boolean } {
  const perWorkoutTarget = new Map<number, number>();
  let isRestDay = false;

  if (schedule && schedule.length > 0) {
    for (const entry of schedule) {
      const current = perWorkoutTarget.get(entry.workout_id) ?? 0;
      perWorkoutTarget.set(entry.workout_id, current + 1);
    }
    const todayEntry = schedule.find((e) => e.day_of_week === todayDow);
    isRestDay = todayEntry == null;
  }

  return { perWorkoutTarget, isRestDay };
}

/**
 * Orders an unscheduled plan's workouts for rotation: the one after
 * `lastWorkoutId` (in plan order) first, wrapping around, regardless of week.
 * Starts at the first workout when there is no last workout or it is no longer
 * in the plan (deleted, or the plan was edited).
 */
export function rotateFromLast(
  workouts: Workout[],
  lastWorkoutId: number | null | undefined,
): Workout[] {
  const lastIndex =
    lastWorkoutId == null
      ? -1
      : workouts.findIndex((w) => w.id === lastWorkoutId);
  const start = lastIndex + 1;
  return [...workouts.slice(start), ...workouts.slice(0, start)];
}

/**
 * Returns a copy of `uncompleted` with today's scheduled workout (or the next
 * upcoming one on a rest day) moved to the front.
 *
 * @param completedTodayWorkoutIds - Set of workout IDs completed today. Used to
 *   fall back to tomorrow when today's workout was already done today but still
 *   appears in `uncompleted` because its weekly target is > 1.
 */
export function prioritizeScheduledWorkout(
  uncompleted: Workout[],
  schedule: PlanScheduleEntry[] | null | undefined,
  todayDow: number,
  isRestDay: boolean,
  completedTodayWorkoutIds?: Set<number>,
): Workout[] {
  if (!schedule || schedule.length === 0) return uncompleted;

  const result = [...uncompleted];

  // Returns true if the workout was found in the uncompleted list (and is now
  // at the front), false if it was not present (already completed / not in list).
  const pinFirst = (workoutId: number): boolean => {
    const idx = result.findIndex((w) => w.id === workoutId);
    if (idx > 0) {
      const [w] = result.splice(idx, 1);
      result.unshift(w);
    }
    return idx >= 0;
  };

  if (!isRestDay) {
    const todayEntry = schedule.find((e) => e.day_of_week === todayDow);
    const todayWorkoutDoneToday =
      todayEntry != null &&
      (completedTodayWorkoutIds?.has(todayEntry.workout_id) ?? false);
    if (
      !todayEntry ||
      todayWorkoutDoneToday ||
      !pinFirst(todayEntry.workout_id)
    ) {
      // Today's workout was completed today or is fully done for the week;
      // fall back to the next scheduled day.
      for (let i = 1; i <= 6; i++) {
        const nextDow = (todayDow + i) % 7;
        const nextEntry = schedule.find((e) => e.day_of_week === nextDow);
        if (nextEntry && pinFirst(nextEntry.workout_id)) break;
      }
    }
  } else {
    for (let i = 1; i <= 6; i++) {
      const nextDow = (todayDow + i) % 7;
      const nextEntry = schedule.find((e) => e.day_of_week === nextDow);
      if (nextEntry && pinFirst(nextEntry.workout_id)) break;
    }
  }

  return result;
}

export interface PlanWeekSession {
  workout_id: number;
  /** The training day, "YYYY-MM-DD". */
  local_date: string;
}

/**
 * The active plan's workouts in the order home shows them, plus the ones done
 * for this week.
 *
 * With a schedule, workouts below their weekly target come first, today's (or
 * the next scheduled) one leading, and a workout is done once it meets its
 * target. Without one, the plan rotates in order from the last completed
 * workout, ignoring week boundaries, and a workout is done once logged this
 * week (it keeps its place in the rotation).
 *
 * @param sessionsThisWeek - This plan's completed sessions in the current week.
 * @param lastWorkoutId - The workout of the plan's most recent session ever.
 */
export function planWorkoutsForWeek({
  workouts,
  schedule,
  todayDow,
  todayKey,
  sessionsThisWeek,
  lastWorkoutId,
}: {
  workouts: Workout[];
  schedule: PlanScheduleEntry[] | null | undefined;
  todayDow: number;
  todayKey: string;
  sessionsThisWeek: PlanWeekSession[];
  lastWorkoutId: number | null | undefined;
}): { workouts: Workout[]; doneIds: Set<number>; isRestDay: boolean } {
  const counts = new Map<number, number>();
  for (const s of sessionsThisWeek) {
    counts.set(s.workout_id, (counts.get(s.workout_id) ?? 0) + 1);
  }

  if (!schedule || schedule.length === 0) {
    return {
      workouts: rotateFromLast(workouts, lastWorkoutId),
      doneIds: new Set(
        workouts
          .filter((w) => w.id != null && counts.has(w.id))
          .map((w) => w.id!),
      ),
      isRestDay: false,
    };
  }

  const { perWorkoutTarget, isRestDay } = computeWeeklyTargets(
    schedule,
    todayDow,
  );
  const doneIds = new Set<number>();
  const uncompleted: Workout[] = [];
  const completed: Workout[] = [];
  for (const workout of workouts) {
    const target = perWorkoutTarget.get(workout.id!);
    if (target !== undefined && (counts.get(workout.id!) ?? 0) >= target) {
      doneIds.add(workout.id!);
      completed.push(workout);
    } else {
      uncompleted.push(workout);
    }
  }
  const completedTodayWorkoutIds = new Set(
    sessionsThisWeek
      .filter((s) => s.local_date === todayKey)
      .map((s) => s.workout_id),
  );
  const ordered = prioritizeScheduledWorkout(
    uncompleted,
    schedule,
    todayDow,
    isRestDay,
    completedTodayWorkoutIds,
  );
  return { workouts: [...ordered, ...completed], doneIds, isRestDay };
}
