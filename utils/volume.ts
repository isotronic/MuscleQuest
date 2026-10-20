// The one definition of training volume. volumeSql in utils/db/workoutStats.ts
// is its SQL twin; keep the two in step (volumeParity.test.ts checks they
// agree).
import { kgToDisplay } from "@/utils/units";

export interface VolumeOptions {
  excludeWarmup: boolean;
  countUnilateralDouble: boolean;
  doubleWeightForPaired: boolean;
  /** Count body weight for bodyweight and weighted bodyweight sets. */
  includeBodyWeight: boolean;
}

export interface VolumeExercise {
  /** The tracking type the set was logged under, override applied. */
  tracking_type: string | null | undefined;
  /** The exercise's own tracking type, before any per-workout override. */
  base_tracking_type?: string | null;
  is_unilateral?: number | boolean | null;
  double_weight?: number | boolean | null;
}

export interface VolumeSet {
  weight: number | null;
  reps: number | null;
  is_warmup?: boolean | number | null;
}

/**
 * Volume of one set, in the unit of `set.weight`; `bodyWeight` must be in
 * the same unit and is the body weight when the set was logged (null or 0
 * when unknown, which counts body-weight terms as nothing).
 *
 * - weight: weight x reps, paired weights doubled when set to.
 * - assisted: (body weight - assistance) x reps, whatever the setting.
 * - reps: body weight x reps when body weight is included, else 0.
 * - weighted bodyweight (a reps exercise logged as weight): the added weight,
 *   plus body weight when it is included.
 * - time, distance: 0.
 *
 * Unilateral reps are doubled when set to, for every type.
 */
export function setVolume(
  set: VolumeSet,
  exercise: VolumeExercise,
  options: VolumeOptions,
  bodyWeight: number | null | undefined,
): number {
  if (options.excludeWarmup && set.is_warmup) return 0;
  const reps = set.reps ?? 0;
  if (!reps) return 0;
  const repM = options.countUnilateralDouble && exercise.is_unilateral ? 2 : 1;
  const weightM =
    options.doubleWeightForPaired && exercise.double_weight ? 2 : 1;
  const bw = bodyWeight != null && bodyWeight > 0 ? bodyWeight : 0;
  const weight = set.weight ?? 0;
  const counted = options.includeBodyWeight ? bw : 0;

  switch (exercise.tracking_type) {
    case "time":
    case "distance":
      return 0;
    case "assisted":
      return Math.max(0, bw - weight) * reps * repM;
    case "reps":
      return counted * reps * repM;
    default: {
      const added = weight * weightM;
      const base = exercise.base_tracking_type === "reps" ? counted : 0;
      return (base + added) * reps * repM;
    }
  }
}

interface VolumeWorkout {
  exercises: {
    exercise_tracking_type: string;
    base_tracking_type?: string | null;
    is_unilateral?: number;
    double_weight?: number;
    sets: VolumeSet[];
  }[];
}

/** Sum of setVolume over every set of a workout. */
export function workoutVolume(
  workout: VolumeWorkout,
  options: VolumeOptions,
  bodyWeight: number | null | undefined,
): number {
  let total = 0;
  for (const exercise of workout.exercises) {
    const volumeExercise: VolumeExercise = {
      tracking_type: exercise.exercise_tracking_type,
      base_tracking_type: exercise.base_tracking_type,
      is_unilateral: exercise.is_unilateral,
      double_weight: exercise.double_weight,
    };
    for (const set of exercise.sets) {
      total += setVolume(set, volumeExercise, options, bodyWeight);
    }
  }
  return total;
}

/**
 * Volume of a loaded completed workout, whose set weights are in
 * `weightUnit`. Uses the body weight stored with the workout's query (the
 * weight logged at the time), never today's.
 */
export function completedWorkoutVolume(
  workout: VolumeWorkout & { body_weight_kg?: number | null },
  options: VolumeOptions,
  weightUnit: string,
): number {
  return workoutVolume(
    workout,
    options,
    workoutBodyWeight(workout, weightUnit),
  );
}

/** A loaded workout's body weight at the time, in `weightUnit`, or null. */
export function workoutBodyWeight(
  workout: { body_weight_kg?: number | null },
  weightUnit: string,
): number | null {
  return workout.body_weight_kg != null && workout.body_weight_kg > 0
    ? kgToDisplay(workout.body_weight_kg, weightUnit)
    : null;
}

/** The volume settings, as stored ("true"/"false" strings). */
export function volumeOptionsFromSettings(
  settings:
    | {
        excludeWarmupSets?: string;
        countUnilateralDouble?: string;
        doubleWeightForPaired?: string;
        includeBodyWeightInVolume?: string;
      }
    | undefined,
): VolumeOptions {
  return {
    excludeWarmup: settings?.excludeWarmupSets === "true",
    countUnilateralDouble: settings?.countUnilateralDouble === "true",
    doubleWeightForPaired: settings?.doubleWeightForPaired === "true",
    includeBodyWeight: settings?.includeBodyWeightInVolume === "true",
  };
}
