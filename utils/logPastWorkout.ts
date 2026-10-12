import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import type { Workout } from "@/store/workoutStore";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";

type EditedExercise = CompletedWorkout["exercises"][number];

/**
 * A saved workout's exercises as the history editor holds them, to prefill a
 * workout logged after the fact: the same exercises, set counts and set
 * types. Reps and time start at the targets; weights and distances are left
 * for the user to enter. Ids come from `nextId`, which hands out the negative
 * ids the editor uses for rows not yet saved.
 */
export function exercisesFromWorkout(
  workout: Workout,
  nextId: () => number,
): EditedExercise[] {
  return workout.exercises.map((exercise) => ({
    completed_exercise_id: nextId(),
    exercise_id: exercise.exercise_id,
    exercise_name: exercise.name,
    exercise_image: exercise.image,
    exercise_image_uri: exercise.image_uri ?? null,
    exercise_tracking_type: resolvedTrackingType(exercise),
    is_unilateral: exercise.is_unilateral,
    double_weight: exercise.double_weight,
    sets: exercise.sets.map((set, index) => ({
      set_id: nextId(),
      set_number: index + 1,
      weight: null,
      reps: set.repsMax ?? set.repsMin ?? null,
      time: set.time ?? null,
      distance: null,
      is_warmup: !!set.isWarmup,
      is_drop_set: !!set.isDropSet,
      is_to_failure: !!set.isToFailure,
      set_duration: null,
      note: null,
    })),
  }));
}
