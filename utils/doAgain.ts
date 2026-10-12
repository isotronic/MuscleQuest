import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import type { Plan } from "@/hooks/useAllPlansQuery";
import type { Exercise } from "@/utils/db/exercises";
import type { Set, UserExercise, Workout } from "@/store/workoutStore";

/**
 * The exercises for a quick workout that repeats a finished session: the same
 * exercises, set counts, set types and tracking type override. Targets are
 * the defaults a quick workout adds exercises with; the weights and reps from
 * last time arrive as prefills through the session's history lookup.
 *
 * `library` holds the current rows of the session's exercises. An exercise
 * no longer in it (deleted since) is left out. An exercise logged twice
 * (two blocks) comes back twice.
 */
export function buildDoAgainExercises(
  completed: CompletedWorkout,
  library: readonly Exercise[],
  restSeconds: number,
): UserExercise[] {
  const byId = new Map(library.map((row) => [row.exercise_id, row]));
  const rest = {
    restMinutes: Math.floor(restSeconds / 60),
    restSeconds: restSeconds % 60,
  };

  const exercises: UserExercise[] = [];
  for (const done of completed.exercises) {
    const row = byId.get(done.exercise_id);
    if (!row || done.sets.length === 0) continue;

    const trackingType = done.exercise_tracking_type;
    const sets: Set[] = done.sets.map((set) => ({
      repsMin:
        trackingType === "time" || trackingType === "distance" ? undefined : 8,
      repsMax:
        trackingType === "time" || trackingType === "distance" ? undefined : 12,
      ...rest,
      time: trackingType === "time" ? 30 : undefined,
      ...(trackingType === "distance" ? { distance: 0 } : {}),
      isWarmup: !!set.is_warmup,
      isDropSet: !!set.is_drop_set,
      isToFailure: !!set.is_to_failure,
    }));

    exercises.push({
      ...row,
      ...(trackingType !== (row.tracking_type || "weight")
        ? { tracking_type_override: trackingType }
        : {}),
      sets,
    });
  }
  return exercises;
}

/**
 * The saved workout a finished session came from, if it still exists, with
 * the plan to start it in (null outside a plan).
 */
export function findSourceWorkout(
  workoutId: number | null | undefined,
  plans: readonly Plan[],
  standaloneWorkouts: readonly Workout[],
): { workout: Workout; planId: number | null } | null {
  if (workoutId == null) return null;
  for (const plan of plans) {
    const workout = plan.workouts.find((w) => w.id === workoutId);
    if (workout) return { workout, planId: plan.id };
  }
  const standalone = standaloneWorkouts.find((w) => w.id === workoutId);
  return standalone ? { workout: standalone, planId: null } : null;
}
