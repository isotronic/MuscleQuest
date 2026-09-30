import { useMemo } from "react";
import { TrackedExerciseWithSets } from "./useTrackedExercisesQuery";
import { METRIC_EPSILON, formatWeight } from "@/utils/units";

interface StatsInsights {
  workoutsPerWeek: number | null;
  biggestGainLabel: string | null;
  biggestGainValue: string | null;
  topBodyPart: string | null;
}

export const useStatsInsights = (
  workoutCount: number | undefined,
  trackedExercises: TrackedExerciseWithSets[] | undefined,
  /** Sets per body part group, see mergeBodyPartCounts. */
  bodyPartCounts: Record<string, number> | undefined,
  timeRangeDays: number,
  weightUnit: string,
  distanceUnit: string = "m",
): StatsInsights => {
  return useMemo(() => {
    const workoutsPerWeek =
      workoutCount && timeRangeDays > 0
        ? workoutCount / (timeRangeDays / 7)
        : null;

    // Biggest 1RM gain across tracked exercises in the current period
    let biggestGainLabel: string | null = null;
    let biggestGainValue: string | null = null;
    if (trackedExercises && trackedExercises.length > 0) {
      let maxGain = -Infinity;
      trackedExercises.forEach((ex) => {
        const sets = ex.completed_sets;
        if (sets.length < 2) return;
        const oldest = sets[sets.length - 1].progressionMetric;
        const latest = sets[0].progressionMetric;
        const gain = latest - oldest;
        if (gain > maxGain) {
          maxGain = gain;
          biggestGainLabel = ex.name;
          const isWeight =
            !ex.tracking_type ||
            ex.tracking_type === "weight" ||
            ex.tracking_type === "assisted";
          // Legacy rows carry float noise, so a flat lift can differ by a
          // fraction of a gram. Only a real gain counts.
          if (isWeight && maxGain > METRIC_EPSILON) {
            biggestGainValue = `+${formatWeight(maxGain, weightUnit)} ${weightUnit}`;
          } else if (ex.tracking_type === "reps" && maxGain > 0) {
            biggestGainValue = `+${Math.round(maxGain)} reps`;
          } else if (ex.tracking_type === "time" && maxGain > 0) {
            biggestGainValue = `+${Math.round(maxGain)}s`;
          } else if (ex.tracking_type === "distance" && maxGain > 0) {
            biggestGainValue = `+${maxGain.toFixed(1)} ${distanceUnit}`;
          } else {
            biggestGainLabel = null;
            biggestGainValue = null;
          }
        }
      });
    }

    // Top body part by set count
    const top = Object.entries(bodyPartCounts ?? {}).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const topBodyPart = top ? top[0] : null;

    return { workoutsPerWeek, biggestGainLabel, biggestGainValue, topBodyPart };
  }, [
    workoutCount,
    trackedExercises,
    bodyPartCounts,
    timeRangeDays,
    weightUnit,
    distanceUnit,
  ]);
};
