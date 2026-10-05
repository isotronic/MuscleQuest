import type { CarryOverExercise } from "./carryOverLookup";

/** Above this multiple of the recent best, a weight is worth confirming. */
export const IMPLAUSIBLE_RATIO = 1.5;
/** A tenth of the entry is offered when it lands within this band of the best. */
export const SUGGESTION_MIN_RATIO = 0.5;
export const SUGGESTION_MAX_RATIO = 1.5;
/** Without history, anything heavier than this is worth confirming. */
export const NO_HISTORY_LIMIT_KG = 300;
export const NO_HISTORY_LIMIT_LBS = 660;

/**
 * Heaviest working (non-warm-up) set across the loaded history for one
 * exercise, in the units the history holds (display units in the session).
 */
export function heaviestWorkingWeight(
  history: CarryOverExercise[] | undefined,
): number | null {
  let best: number | null = null;
  for (const exercise of history ?? []) {
    for (const s of exercise.sets) {
      if (s.is_warmup || s.weight == null || s.weight <= 0) continue;
      if (best === null || s.weight > best) best = s.weight;
    }
  }
  return best;
}

export type WeightPlausibility =
  | { implausible: false }
  | { implausible: true; suggestion: number | null };

/**
 * Flags a weight that is far above what this exercise has seen, which is what
 * a dropped decimal comma looks like (62,5 read as 625). When a tenth of the
 * entry fits the history, that is offered as the likely intended value.
 */
export function checkWeightPlausibility({
  weight,
  reference,
  weightUnit,
}: {
  weight: number;
  reference: number | null;
  weightUnit: string;
}): WeightPlausibility {
  if (!Number.isFinite(weight) || weight <= 0) return { implausible: false };

  if (reference === null) {
    const limit =
      weightUnit === "lbs" ? NO_HISTORY_LIMIT_LBS : NO_HISTORY_LIMIT_KG;
    return weight > limit
      ? { implausible: true, suggestion: null }
      : { implausible: false };
  }

  if (weight <= reference * IMPLAUSIBLE_RATIO) return { implausible: false };

  const tenth = Math.round((weight / 10) * 100) / 100;
  const fits =
    tenth >= reference * SUGGESTION_MIN_RATIO &&
    tenth <= reference * SUGGESTION_MAX_RATIO;
  return { implausible: true, suggestion: fits ? tenth : null };
}
