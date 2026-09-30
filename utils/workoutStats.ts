import { kgToDisplay } from "@/utils/units";
import type { BodyPartSetCount, WorkoutSummary } from "@/utils/db/workoutStats";

type SummaryTotals = Pick<
  WorkoutSummary,
  "volume_kg" | "set_count" | "duration"
>;

/** Volume is reported in tonnes for kg and short tons for lbs. */
export const tonDivisorFor = (weightUnit: string) =>
  weightUnit === "lbs" ? 2000 : 1000;

export const volumeInTons = (volumeKg: number, weightUnit: string) =>
  kgToDisplay(volumeKg, weightUnit) / tonDivisorFor(weightUnit);

export const computeStats = (
  workouts: readonly SummaryTotals[],
  weightUnit: string,
) => {
  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce((acc, w) => acc + w.set_count, 0);
  const totalVolumeKg = workouts.reduce((acc, w) => acc + w.volume_kg, 0);
  const totalTimeSeconds = workouts.reduce((acc, w) => acc + w.duration, 0);
  return {
    totalWorkouts,
    totalSets,
    totalVolumeTons: volumeInTons(totalVolumeKg, weightUnit),
    totalTimeSeconds,
    avgDurationSeconds:
      totalWorkouts > 0 ? Math.round(totalTimeSeconds / totalWorkouts) : 0,
  };
};

const mapBodyPart = (bodyPart: string): string => {
  if (bodyPart === "upper arms" || bodyPart === "lower arms") return "arms";
  if (bodyPart === "upper legs" || bodyPart === "lower legs") return "legs";
  return bodyPart;
};

// Set counts keyed by the body part groups the stats screen shows.
export const mergeBodyPartCounts = (
  rows: readonly BodyPartSetCount[],
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const { body_part, set_count } of rows) {
    if (set_count <= 0) continue;
    const key = mapBodyPart(body_part);
    counts[key] = (counts[key] ?? 0) + set_count;
  }
  return counts;
};
