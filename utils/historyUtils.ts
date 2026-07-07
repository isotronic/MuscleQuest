import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

type HistorySet = CompletedWorkout["exercises"][number]["sets"][number];
type HistoryExercise = CompletedWorkout["exercises"][number];

/**
 * Finds the historical set matching a given set index in the current exercise
 * by type-ordinal rather than raw index.
 *
 * E.g. if current sets are [warmup, working, working] and history has [working, working],
 * index 1 (1st working set, ordinal 0) maps to history index 0 — not index 1.
 *
 * Pass all history exercises for the same exercise_id (may span multiple workouts),
 * most recent first. Uses the first entry that has any sets of the matching type,
 * falling back to its last set of that type if the current session added more
 * sets than that entry had (rather than reaching further back into history).
 */
export function findHistoricalSetByOrdinal(
  currentSets: { isWarmup?: boolean }[],
  targetSetIndex: number,
  historyExercises: HistoryExercise[],
): HistorySet | undefined {
  const targetIsWarmup = currentSets[targetSetIndex]?.isWarmup ?? false;
  const ordinal = currentSets
    .slice(0, targetSetIndex)
    .filter((s) => (s.isWarmup ?? false) === targetIsWarmup).length;

  for (const ex of historyExercises) {
    const setsOfType = ex.sets.filter((s) => s.is_warmup === targetIsWarmup);
    if (setsOfType.length === 0) continue;
    return setsOfType[ordinal] ?? setsOfType[setsOfType.length - 1];
  }
  return undefined;
}
