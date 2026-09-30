import { useQuery } from "@tanstack/react-query";
import {
  useBodyPartSetCountsQuery,
  useHasCompletedWorkoutQuery,
  usePreviousPeriodSummariesQuery,
  useWorkoutSummariesQuery,
} from "../useWorkoutSummariesQuery";
import {
  fetchBodyPartSetCounts,
  fetchWorkoutSummaries,
} from "@/utils/db/workoutStats";
import { toLocalDateKey } from "@/utils/dates";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("@/utils/db/workoutStats", () => ({
  fetchWorkoutSummaries: jest.fn().mockResolvedValue([]),
  fetchBodyPartSetCounts: jest.fn().mockResolvedValue([]),
  fetchHasCompletedWorkout: jest.fn().mockResolvedValue(true),
}));

const OPTIONS = {
  excludeWarmup: true,
  countUnilateralDouble: false,
  doubleWeightForPaired: true,
};

const dayKeyAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateKey(d);
};

const lastQuery = () => (useQuery as jest.Mock).mock.calls.at(-1)![0];

beforeEach(() => jest.clearAllMocks());

describe("workout summary queries", () => {
  // Saving, editing and deleting a workout invalidate ["completedWorkouts"].
  it("all sit under the completedWorkouts key", () => {
    useWorkoutSummariesQuery(30, OPTIONS);
    const current = lastQuery().queryKey;
    usePreviousPeriodSummariesQuery(30, OPTIONS);
    const previous = lastQuery().queryKey;
    useBodyPartSetCountsQuery(30, true);
    const bodyParts = lastQuery().queryKey;
    useHasCompletedWorkoutQuery();
    const any = lastQuery().queryKey;

    for (const key of [current, previous, bodyParts, any]) {
      expect(key[0]).toBe("completedWorkouts");
    }
    expect(new Set([current, previous, bodyParts, any].map(String)).size).toBe(
      4,
    );
  });

  it("uses a different cache entry per option set", () => {
    useWorkoutSummariesQuery(30, OPTIONS);
    const first = lastQuery().queryKey;
    useWorkoutSummariesQuery(30, { ...OPTIONS, excludeWarmup: false });

    expect(lastQuery().queryKey).not.toEqual(first);
  });

  it("limits the current period to the last N local days", async () => {
    useWorkoutSummariesQuery(30, OPTIONS);
    await lastQuery().queryFn();

    expect(fetchWorkoutSummaries).toHaveBeenCalledWith(
      { from: dayKeyAgo(30) },
      OPTIONS,
    );
  });

  it("loads everything when the range is all time", async () => {
    useWorkoutSummariesQuery(0, OPTIONS);
    await lastQuery().queryFn();

    expect(fetchWorkoutSummaries).toHaveBeenCalledWith({}, OPTIONS);
  });

  it("asks for the window just before the current period", async () => {
    usePreviousPeriodSummariesQuery(7, OPTIONS);
    await lastQuery().queryFn();

    expect(fetchWorkoutSummaries).toHaveBeenCalledWith(
      { from: dayKeyAgo(15), to: dayKeyAgo(8) },
      OPTIONS,
    );
  });

  it("has no previous period for all time", () => {
    usePreviousPeriodSummariesQuery(0, OPTIONS);

    expect(lastQuery().enabled).toBe(false);
  });

  it("counts body part sets over the same period", async () => {
    useBodyPartSetCountsQuery(90, true);
    await lastQuery().queryFn();

    expect(fetchBodyPartSetCounts).toHaveBeenCalledWith(
      { from: dayKeyAgo(90) },
      true,
    );
  });
});
