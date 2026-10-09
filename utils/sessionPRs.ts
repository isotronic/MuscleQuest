// Which sets of the session in progress are new personal records. Derived
// from the completed sets and their values, which the active workout store
// already persists, so the flags survive a crash and follow sets and
// exercises when they are reordered or removed.
import type { UserExercise } from "@/store/workoutStore";
import type { PriorBest } from "@/utils/db/workoutStats";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { setMetric } from "@/utils/prMetric";
import { displayToKg, displayToMetres, METRIC_EPSILON } from "@/utils/units";
import { convertTimeStrToSeconds } from "@/utils/utility";

type SetValues = {
  weight?: string;
  reps?: string;
  time?: string;
  distance?: string;
};

export interface SessionPRInput {
  exercises: UserExercise[];
  completedSets: { [exerciseIndex: number]: { [setIndex: number]: boolean } };
  /** The session's inputs, in the display units below. */
  weightAndReps: { [exerciseIndex: number]: { [setIndex: number]: SetValues } };
  priorBests: PriorBest[];
  weightUnit: string;
  distanceUnit: string;
  /** Canonical kg, for assisted sets. */
  bodyWeightKg: number;
}

/** exerciseIndex -> the indices of its sets that are new records. */
export type SessionPRs = Record<number, number[]>;

const toNumber = (value: string | undefined): number | null => {
  if (value == null || value === "") return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * A completed working set is a PR when it beats the best logged before the
 * session, under the same tracking type, by more than METRIC_EPSILON. Each
 * PR raises the bar for the sets after it, so a later, smaller improvement
 * in the same session is not a second PR. An exercise with no history has
 * nothing to beat. Sets are taken in exercise and set order.
 */
export function computeSessionPRs({
  exercises,
  completedSets,
  weightAndReps,
  priorBests,
  weightUnit,
  distanceUnit,
  bodyWeightKg,
}: SessionPRInput): SessionPRs {
  const bests = new Map<string, number>();
  for (const prior of priorBests) {
    bests.set(`${prior.exercise_id}:${prior.tracking_type}`, prior.best);
  }

  const prs: SessionPRs = {};
  exercises.forEach((exercise, exerciseIndex) => {
    const trackingType = resolvedTrackingType(exercise);
    const key = `${exercise.exercise_id}:${trackingType}`;
    exercise.sets.forEach((set, setIndex) => {
      if (set.isWarmup) return;
      if (completedSets[exerciseIndex]?.[setIndex] !== true) return;
      const best = bests.get(key);
      if (best === undefined) return;

      const values = weightAndReps[exerciseIndex]?.[setIndex] ?? {};
      const weight = toNumber(values.weight);
      const distance = toNumber(values.distance);
      const reps = toNumber(values.reps);
      const metric = setMetric(
        {
          weight: weight != null ? displayToKg(weight, weightUnit) : null,
          reps,
          time: values.time ? convertTimeStrToSeconds(values.time) : null,
          distance:
            distance != null ? displayToMetres(distance, distanceUnit) : null,
        },
        trackingType,
        {
          doubleWeight: !!exercise.double_weight,
          bodyWeight: bodyWeightKg,
        },
      );
      if (metric > best + METRIC_EPSILON) {
        (prs[exerciseIndex] ??= []).push(setIndex);
        bests.set(key, metric);
      }
    });
  });
  return prs;
}

export const isSessionPR = (
  prs: SessionPRs,
  exerciseIndex: number,
  setIndex: number,
): boolean => prs[exerciseIndex]?.includes(setIndex) ?? false;
