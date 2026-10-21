import { canonicalMuscle } from "@/utils/workoutStats";
import type { Set } from "@/store/workoutStore";

/** What the counts need from a planned exercise. */
export interface PlannedExercise {
  target_muscle?: string | null;
  /** Parsed list, or the JSON string some loaders leave in place. */
  secondary_muscles?: string[] | string | null;
  sets: Pick<Set, "isWarmup">[];
}

/**
 * Muscles a plan is checked against for gaps, as canonicalMuscle keys. A
 * workout is not: a push day leaves out legs on purpose.
 */
export const MAJOR_MUSCLES = [
  "pectorals",
  "upper back",
  "lats",
  "delts",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
] as const;

// Cardio machines target this; it is not a muscle to balance.
const NOT_A_MUSCLE = "cardiovascular system";

const secondaryList = (value: PlannedExercise["secondary_muscles"]) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((m): m is string => typeof m === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * Planned working sets per muscle, keyed like the stats widget. Each set
 * counts once for the target muscle and `secondaryWeight` times for each
 * secondary muscle (0 leaves them out). Warm-up sets are not counted.
 */
export const plannedMuscleSets = (
  exercises: readonly PlannedExercise[],
  secondaryWeight: number,
  times = 1,
): Record<string, number> => {
  const totals: Record<string, number> = {};
  const add = (muscle: string, sets: number) => {
    if (sets <= 0 || muscle === NOT_A_MUSCLE) return;
    totals[muscle] = (totals[muscle] ?? 0) + sets;
  };
  for (const exercise of exercises) {
    const working = exercise.sets.filter((s) => !s.isWarmup).length * times;
    if (working === 0) continue;
    const target = exercise.target_muscle
      ? canonicalMuscle(exercise.target_muscle)
      : null;
    if (target) add(target, working);
    if (secondaryWeight <= 0) continue;
    // The library can list a secondary twice under two names, or name the
    // target again: count each muscle once per exercise.
    const secondaries = new Set(
      secondaryList(exercise.secondary_muscles).map(canonicalMuscle),
    );
    secondaries.delete(target ?? "");
    for (const muscle of secondaries) add(muscle, working * secondaryWeight);
  }
  return totals;
};

/**
 * Sets per muscle for a whole plan. With a schedule, each workout counts once
 * for every day it is on, giving a week; without one, each workout counts
 * once, giving one round of the plan.
 */
export const planMuscleSets = (
  workouts: readonly { exercises: readonly PlannedExercise[] }[],
  scheduledWorkoutIndices: readonly number[],
  secondaryWeight: number,
): { totals: Record<string, number>; weekly: boolean } => {
  const scheduled = scheduledWorkoutIndices.filter(
    (i) => i >= 0 && i < workouts.length,
  );
  const weekly = scheduled.length > 0;
  const totals: Record<string, number> = {};
  workouts.forEach((workout, index) => {
    const times = weekly ? scheduled.filter((i) => i === index).length : 1;
    if (times === 0) return;
    const sets = plannedMuscleSets(workout.exercises, secondaryWeight, times);
    for (const [muscle, value] of Object.entries(sets)) {
      totals[muscle] = (totals[muscle] ?? 0) + value;
    }
  });
  return { totals, weekly };
};

/** Major muscles with no planned sets, in MAJOR_MUSCLES order. */
export const untrainedMuscles = (totals: Record<string, number>): string[] =>
  MAJOR_MUSCLES.filter((muscle) => !(totals[muscle] > 0));
