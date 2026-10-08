import { differenceInCalendarDays } from "date-fns";
import { kgToDisplay } from "@/utils/units";
import type {
  BodyPartSetCount,
  SplitGrouping,
  SplitRow,
  WorkoutSummary,
} from "@/utils/db/workoutStats";

type SummaryTotals = Pick<
  WorkoutSummary,
  "volume_kg" | "set_count" | "duration"
> &
  Partial<Pick<WorkoutSummary, "rep_count" | "local_date">>;

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
  const totalReps = workouts.reduce((acc, w) => acc + (w.rep_count ?? 0), 0);
  const trainingDays = new Set(
    workouts.map((w) => w.local_date).filter(Boolean),
  ).size;
  return {
    totalWorkouts,
    totalSets,
    totalReps,
    trainingDays,
    avgSetsPerWorkout:
      totalWorkouts > 0 ? Math.round((totalSets / totalWorkouts) * 10) / 10 : 0,
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

// Secondary muscles in the library use other names than target muscles
// ("deltoids" next to "delts"). By muscle, both count under the target name.
const MUSCLE_ALIASES: Record<string, string> = {
  deltoids: "delts",
  shoulders: "delts",
  "rear deltoids": "delts",
  "latissimus dorsi": "lats",
  quadriceps: "quads",
  trapezius: "traps",
  chest: "pectorals",
  "upper chest": "pectorals",
  "lower back": "spine",
  core: "abs",
  "lower abs": "abs",
  back: "upper back",
};

export const canonicalMuscle = (muscle: string): string => {
  const name = muscle.trim().toLowerCase();
  return MUSCLE_ALIASES[name] ?? name;
};

/**
 * Totals per group from fetchTrainingSplit rows. Body parts fold arms and
 * legs together like the training split always has; muscles fold aliases.
 * Secondary rows count `secondaryWeight` times their value (0 leaves them
 * out).
 */
export const mergeSplitRows = (
  rows: readonly SplitRow[],
  groupBy: SplitGrouping,
  measure: "sets" | "volume",
  secondaryWeight = 0,
): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const weight = row.secondary ? secondaryWeight : 1;
    if (weight <= 0) continue;
    const value = (measure === "sets" ? row.sets : row.volume_kg) * weight;
    if (value <= 0) continue;
    const key =
      groupBy === "bodyPart"
        ? mapBodyPart(row.name)
        : canonicalMuscle(row.name);
    totals[key] = (totals[key] ?? 0) + value;
  }
  return totals;
};

/**
 * Weeks covered by a time range, for per-week averages. All time runs from
 * the first workout; never less than one week.
 */
export const weeksInRange = (
  rangeDays: number,
  firstLocalDate: Date | null,
  now: Date = new Date(),
): number => {
  if (rangeDays > 0) return Math.max(1, rangeDays / 7);
  if (!firstLocalDate) return 1;
  // Calendar days, so a daylight saving change does not shave off an hour.
  const days = differenceInCalendarDays(now, firstLocalDate) + 1;
  return Math.max(1, days / 7);
};
