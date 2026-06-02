import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import { useExerciseDetailQuery } from "../useExerciseDetailQuery";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({ openDatabase: jest.fn() }));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

// ---------------------------------------------------------------------------
// Helpers to build a mock DB for fetchExerciseDetail
//
// Call order (timeRange = "0"):
//   1. getFirstAsync  – exercise flags (is_unilateral, double_weight, tracking_type)
//   2. getFirstAsync  – current tracking type override lookup
//   3. getAllAsync     – main best-sets CTE
//   4. getFirstAsync  – all-time PR
//   5. getFirstAsync  – exercise name
//   6. getAllAsync     – top 5 PR sets
//   7. getAllAsync     – recent 5 sessions
// ---------------------------------------------------------------------------

const makeRow = (overrides: Partial<any> = {}) => ({
  tracking_type: "weight",
  weight: 100,
  reps: 5,
  time: null,
  distance: null,
  set_number: 1,
  date_completed: "2026-01-10",
  progression_metric: 116.7,
  ...overrides,
});

function buildMockDb(rows: any[] = [makeRow()]) {
  const db = {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
  };
  // Call 1: flags (now includes tracking_type)
  db.getFirstAsync.mockResolvedValueOnce({
    is_unilateral: 0,
    double_weight: 0,
    tracking_type: "weight",
  });
  // Call 2: tracking type override lookup (null = no override)
  db.getFirstAsync.mockResolvedValueOnce(null);
  // Call 3: main sets CTE
  db.getAllAsync.mockResolvedValueOnce(rows);
  // Call 4: all-time PR
  db.getFirstAsync.mockResolvedValueOnce({ all_time_pr: 116.7 });
  // Call 5: exercise name
  db.getFirstAsync.mockResolvedValueOnce({ name: "Bench Press" });
  // Call 6: top 5 PR sets
  db.getAllAsync.mockResolvedValueOnce([makeRow()]);
  // Call 7: recent 5 sessions
  db.getAllAsync.mockResolvedValueOnce([makeRow()]);
  return db;
}

// ---------------------------------------------------------------------------
// useExerciseDetailQuery — configuration
// ---------------------------------------------------------------------------

describe("useExerciseDetailQuery — configuration", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: null, isLoading: false };
    });
  });

  it("is disabled when exerciseId <= 0", () => {
    useExerciseDetailQuery(0, "30", "kg");
    expect(capturedArgs.enabled).toBe(false);
  });

  it("is enabled when exerciseId > 0", () => {
    useExerciseDetailQuery(1, "30", "kg");
    expect(capturedArgs.enabled).toBe(true);
  });

  it("uses the full queryKey including all params", () => {
    useExerciseDetailQuery(1, "30", "kg", true, true, false);
    expect(capturedArgs.queryKey).toEqual([
      "exerciseDetail",
      1,
      "30",
      "kg",
      true,
      true,
      false,
      false, // excludeDeload default
    ]);
  });

  it("has staleTime and gcTime of 0", () => {
    useExerciseDetailQuery(1, "30", "kg");
    expect(capturedArgs.staleTime).toBe(0);
    expect(capturedArgs.gcTime).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useExerciseDetailQuery — queryFn (data transformation)
// ---------------------------------------------------------------------------

describe("useExerciseDetailQuery — queryFn", () => {
  let capturedArgs: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = buildMockDb();
    (openDatabase as jest.Mock).mockResolvedValue(mockDb);
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: null, isLoading: false };
    });
    useExerciseDetailQuery(1, "0", "kg");
  });

  it("returns null when no sets are found for the exercise", async () => {
    (openDatabase as jest.Mock).mockResolvedValue(buildMockDb([]));
    useExerciseDetailQuery(1, "0", "kg");
    const result = await capturedArgs.queryFn();
    expect(result).toBeNull();
  });

  it("returns ExerciseDetail with correct structure on success", async () => {
    const result = await capturedArgs.queryFn();
    expect(result).not.toBeNull();
    expect(result!.trackedExercise.name).toBe("Bench Press");
    expect(result!.allTimePR).toBe(116.7);
    expect(result!.trackingType).toBe("weight");
  });

  it("builds topPRSets from the PR rows query", async () => {
    const result = await capturedArgs.queryFn();
    expect(result!.topPRSets).toHaveLength(1);
    expect(result!.topPRSets[0].weight).toBe(100);
  });

  it("builds recentSessions from the recent rows query", async () => {
    const result = await capturedArgs.queryFn();
    expect(result!.recentSessions).toHaveLength(1);
    expect(result!.recentSessions[0].date_completed).toBe("2026-01-10");
  });

  it("mapRowToCompletedSet: includes weight+reps+oneRepMax for weight tracking", async () => {
    const result = await capturedArgs.queryFn();
    const set = result!.trackedExercise.completed_sets[0];
    expect(set.weight).toBe(100);
    expect(set.reps).toBe(5);
    expect(set.oneRepMax).toBeDefined();
    expect(set.time).toBeUndefined();
  });

  it("mapRowToCompletedSet: includes only reps for reps tracking", async () => {
    const repsRow = makeRow({
      tracking_type: "reps",
      weight: null,
      reps: 20,
      progression_metric: 20,
    });
    const db = buildMockDb([repsRow]);
    db.getFirstAsync.mockResolvedValueOnce({
      is_unilateral: 0,
      double_weight: 0,
    }); // flags — already consumed once; rebuild sequence
    // Rebuild a fresh mock for reps tracking
    const freshDb = {
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    };
    freshDb.getFirstAsync.mockResolvedValueOnce({
      is_unilateral: 0,
      double_weight: 0,
      tracking_type: "reps",
    });
    freshDb.getFirstAsync.mockResolvedValueOnce(null); // override lookup
    freshDb.getAllAsync.mockResolvedValueOnce([repsRow]);
    freshDb.getFirstAsync.mockResolvedValueOnce({ all_time_pr: 20 });
    freshDb.getFirstAsync.mockResolvedValueOnce({ name: "Pull-up" });
    freshDb.getAllAsync.mockResolvedValueOnce([repsRow]);
    freshDb.getAllAsync.mockResolvedValueOnce([repsRow]);
    (openDatabase as jest.Mock).mockResolvedValue(freshDb);
    useExerciseDetailQuery(2, "0", "kg");
    const result = await capturedArgs.queryFn();
    const set = result!.trackedExercise.completed_sets[0];
    expect(set.weight).toBeUndefined();
    expect(set.reps).toBe(20);
    expect(set.oneRepMax).toBeUndefined();
  });

  it("notifies Bugsnag and rethrows on error", async () => {
    (openDatabase as jest.Mock).mockRejectedValue(new Error("crash"));
    useExerciseDetailQuery(1, "0", "kg");
    await expect(capturedArgs.queryFn()).rejects.toThrow("crash");
    expect(Bugsnag.notify).toHaveBeenCalled();
  });

  it("fetches pre-range baseline when timeRange is not '0'", async () => {
    const freshDb = buildMockDb();
    // Add baseline call (8th call to getFirstAsync, after the 7 standard calls)
    (freshDb.getFirstAsync as jest.Mock).mockResolvedValueOnce({
      baseline_metric: 90,
    });
    (openDatabase as jest.Mock).mockResolvedValue(freshDb);
    useExerciseDetailQuery(1, "30", "kg");
    const result = await capturedArgs.queryFn();
    expect(result!.preRangeBaseline).toBe(90);
  });
});
