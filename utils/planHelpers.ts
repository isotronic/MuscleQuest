import type { Workout } from "@/store/workoutStore";
import type { PlanScheduleEntry } from "@/utils/database";

/**
 * Computes per-workout weekly completion targets and whether today is a rest day.
 * When a schedule exists, each workout's target equals the number of days it appears
 * in the schedule. When there is no schedule, weeklyGoal is distributed evenly
 * (floor/ceil) across all workouts, with a minimum of 1 per workout.
 */
export function computeWeeklyTargets(
  workouts: Workout[],
  weeklyGoal: number,
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
  } else {
    const numWorkouts = workouts.length;
    workouts.forEach((workout, i) => {
      if (workout.id == null) return;
      const base = Math.floor(weeklyGoal / numWorkouts);
      const extra = i < weeklyGoal % numWorkouts ? 1 : 0;
      perWorkoutTarget.set(workout.id, Math.max(1, base + extra));
    });
  }

  return { perWorkoutTarget, isRestDay };
}

/**
 * Returns a copy of `uncompleted` with today's scheduled workout (or the next
 * upcoming one on a rest day) moved to the front.
 */
export function prioritizeScheduledWorkout(
  uncompleted: Workout[],
  schedule: PlanScheduleEntry[] | null | undefined,
  todayDow: number,
  isRestDay: boolean,
): Workout[] {
  if (!schedule || schedule.length === 0) return uncompleted;

  const result = [...uncompleted];

  const pinFirst = (workoutId: number) => {
    const idx = result.findIndex((w) => w.id === workoutId);
    if (idx > 0) {
      const [w] = result.splice(idx, 1);
      result.unshift(w);
    }
  };

  if (!isRestDay) {
    const todayEntry = schedule.find((e) => e.day_of_week === todayDow);
    if (todayEntry) pinFirst(todayEntry.workout_id);
  } else {
    for (let i = 1; i <= 6; i++) {
      const nextDow = (todayDow + i) % 7;
      const nextEntry = schedule.find((e) => e.day_of_week === nextDow);
      if (nextEntry) {
        pinFirst(nextEntry.workout_id);
        break;
      }
    }
  }

  return result;
}
