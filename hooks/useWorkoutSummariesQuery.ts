import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchBodyPartSetCounts,
  fetchHasCompletedWorkout,
  fetchPriorBests,
  fetchRecentPRs,
  fetchTrainingSplit,
  fetchWorkoutSummaries,
  type BodyPartSetCount,
  type PriorBest,
  type RecentPR,
  type SplitGrouping,
  type SplitRow,
  type LocalDateRange,
  type WorkoutStatsOptions,
  type WorkoutSummary,
} from "@/utils/db/workoutStats";
import { toLocalDateKey } from "@/utils/dates";
import { getPreviousPeriodDates } from "./useCompletedWorkoutsQuery";

// All keys start with "completedWorkouts", which the save, edit and delete
// mutations invalidate.
const ROOT = "completedWorkouts";

// The last `days` local days up to today; everything when days is 0.
const currentPeriod = (days: number): LocalDateRange => {
  if (days <= 0) return {};
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: toLocalDateKey(from) };
};

const optionsKey = (options: WorkoutStatsOptions) => [
  options.excludeWarmup,
  options.countUnilateralDouble,
  options.doubleWeightForPaired,
];

// One row per completed workout with its sets totalled in SQL. timeRange is in
// days, 0 for all time.
export const useWorkoutSummariesQuery = (
  timeRange: number,
  options: WorkoutStatsOptions,
) =>
  useQuery<WorkoutSummary[]>({
    queryKey: [ROOT, "summaries", timeRange, ...optionsKey(options)],
    queryFn: () => fetchWorkoutSummaries(currentPeriod(timeRange), options),
    staleTime: 60_000,
  });

export const usePreviousPeriodSummariesQuery = (
  timeRange: number,
  options: WorkoutStatsOptions,
) => {
  const enabled = timeRange > 0;
  return useQuery<WorkoutSummary[]>({
    queryKey: [ROOT, "summaries", timeRange, "prev", ...optionsKey(options)],
    queryFn: () => {
      const { startDate, endDate } = getPreviousPeriodDates(timeRange);
      return fetchWorkoutSummaries({ from: startDate, to: endDate }, options);
    },
    enabled,
    staleTime: 60_000,
  });
};

export const useBodyPartSetCountsQuery = (
  timeRange: number,
  excludeWarmup: boolean,
) =>
  useQuery<BodyPartSetCount[]>({
    queryKey: [ROOT, "bodyParts", timeRange, excludeWarmup],
    queryFn: () =>
      fetchBodyPartSetCounts(currentPeriod(timeRange), excludeWarmup),
    staleTime: 60_000,
  });

/** Whether the user has ever completed a workout. */
export const useHasCompletedWorkoutQuery = () =>
  useQuery<boolean>({
    queryKey: [ROOT, "any"],
    queryFn: fetchHasCompletedWorkout,
    staleTime: 60_000,
  });

/** Raw sets and volume per body part or muscle; see mergeSplitRows. */
export const useTrainingSplitQuery = (
  timeRange: number,
  groupBy: SplitGrouping,
  options: WorkoutStatsOptions,
) =>
  useQuery<SplitRow[]>({
    queryKey: [ROOT, "split", timeRange, groupBy, ...optionsKey(options)],
    queryFn: () =>
      fetchTrainingSplit(currentPeriod(timeRange), groupBy, options),
    staleTime: 60_000,
  });

export const useRecentPRsQuery = (
  timeRange: number,
  trackedOnly: boolean,
  limit: number,
) =>
  useQuery<RecentPR[]>({
    // Changing the tracked exercises invalidates this key as well.
    queryKey: [ROOT, "recentPRs", timeRange, trackedOnly, limit],
    queryFn: () =>
      fetchRecentPRs(currentPeriod(timeRange), { trackedOnly, limit }),
    staleTime: 60_000,
  });

/** The PRs set in one saved session, for its summary. */
export const useWorkoutPRsQuery = (completedWorkoutId: number) =>
  useQuery<RecentPR[]>({
    queryKey: [ROOT, "workoutPRs", completedWorkoutId],
    queryFn: () =>
      fetchRecentPRs(
        {},
        { trackedOnly: false, limit: 100, completedWorkoutId },
      ),
    enabled: completedWorkoutId > 0,
    staleTime: 60_000,
  });

/**
 * Each exercise's best set before the session, to spot PRs as they happen.
 * Keyed on the exercise ids, so adding or replacing an exercise loads its
 * best too.
 */
export const usePriorBestsQuery = (exerciseIds: number[]) =>
  useQuery<PriorBest[]>({
    queryKey: [ROOT, "priorBests", exerciseIds],
    queryFn: () => fetchPriorBests(exerciseIds),
    enabled: exerciseIds.length > 0,
    // Keeps the badges while an added or replaced exercise's best loads.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
