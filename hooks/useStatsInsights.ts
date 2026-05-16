import { useMemo } from "react";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";
import { TrackedExerciseWithSets } from "./useTrackedExercisesQuery";
import { Exercise } from "@/utils/database";
import { capitalizeWords } from "@/utils/utility";

interface StatsInsights {
  workoutsPerWeek: number | null;
  biggestGainLabel: string | null;
  biggestGainValue: string | null;
  topBodyPart: string | null;
}

const mapBodyPart = (bp: string): string => {
  if (bp === "upper arms" || bp === "lower arms") return "arms";
  if (bp === "upper legs" || bp === "lower legs") return "legs";
  return bp;
};

export const useStatsInsights = (
  completedWorkouts: CompletedWorkout[] | undefined,
  trackedExercises: TrackedExerciseWithSets[] | undefined,
  exercises: Exercise[] | undefined,
  timeRangeDays: number,
  weightUnit: string,
  distanceUnit: string = "m",
): StatsInsights => {
  return useMemo(() => {
    const workoutsPerWeek =
      completedWorkouts && completedWorkouts.length > 0 && timeRangeDays > 0
        ? completedWorkouts.length / (timeRangeDays / 7)
        : null;

    // Biggest 1RM gain across tracked exercises in the current period
    let biggestGainLabel: string | null = null;
    let biggestGainValue: string | null = null;
    if (trackedExercises && trackedExercises.length > 0) {
      let maxGain = -Infinity;
      const convFactor = weightUnit === "lbs" ? 2.2046226 : 1;

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
          if (isWeight && maxGain > 0) {
            biggestGainValue = `+${(maxGain * convFactor).toFixed(1)} ${weightUnit}`;
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
    let topBodyPart: string | null = null;
    if (completedWorkouts && exercises) {
      const bpMap: Record<number, string> = {};
      exercises.forEach((e) => { bpMap[e.exercise_id] = e.body_part; });

      const counts: Record<string, number> = {};
      completedWorkouts.forEach((w) => {
        w.exercises.forEach((ex) => {
          const raw = bpMap[ex.exercise_id];
          if (!raw) return;
          const bp = mapBodyPart(raw);
          counts[bp] = (counts[bp] || 0) + ex.sets.length;
        });
      });

      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) topBodyPart = capitalizeWords(top[0]);
    }

    return { workoutsPerWeek, biggestGainLabel, biggestGainValue, topBodyPart };
  }, [completedWorkouts, trackedExercises, exercises, timeRangeDays, weightUnit]);
};
