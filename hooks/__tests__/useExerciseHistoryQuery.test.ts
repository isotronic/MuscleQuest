import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import { useExerciseHistoryQuery } from "../useExerciseHistoryQuery";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({ openDatabase: jest.fn() }));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeRow = (overrides: Partial<any> = {}) => ({
  id: 1,
  set_number: 1,
  weight: 100,
  reps: 5,
  time: null,
  distance: null,
  date_completed: "2026-01-10",
  workout_id: 10,
  workout_name: "Chest Day",
  tracking_type: "weight",
  hist_bw_kg: 80,
  is_warmup: 0,
  progression_metric: 116.7,
  all_time_pr: 116.7,
  ...overrides,
});

// ---------------------------------------------------------------------------
// useExerciseHistoryQuery — configuration
// ---------------------------------------------------------------------------

describe("useExerciseHistoryQuery — configuration", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: undefined, isLoading: false };
    });
  });

  it("is disabled when exerciseId <= 0", () => {
    useExerciseHistoryQuery(0);
    expect(capturedArgs.enabled).toBe(false);
  });

  it("is enabled when exerciseId > 0", () => {
    useExerciseHistoryQuery(5);
    expect(capturedArgs.enabled).toBe(true);
  });

  it("uses queryKey ['exerciseHistory', exerciseId]", () => {
    useExerciseHistoryQuery(42);
    expect(capturedArgs.queryKey).toEqual(["exerciseHistory", 42]);
  });
});

// ---------------------------------------------------------------------------
// useExerciseHistoryQuery — queryFn
// ---------------------------------------------------------------------------

describe("useExerciseHistoryQuery — queryFn", () => {
  let capturedArgs: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = { getAllAsync: jest.fn() };
    (openDatabase as jest.Mock).mockResolvedValue(mockDb);
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: undefined, isLoading: false };
    });
    useExerciseHistoryQuery(1);
  });

  it("returns empty sections, null trackingType, and empty chartSets when rows are empty", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await capturedArgs.queryFn();
    expect(result).toEqual({ sections: [], trackingType: null, chartSets: [] });
  });

  it("groups rows by date+workoutId into sections", async () => {
    const rows = [
      makeRow({
        id: 1,
        date_completed: "2026-01-10",
        workout_id: 10,
        set_number: 1,
      }),
      makeRow({
        id: 2,
        date_completed: "2026-01-10",
        workout_id: 10,
        set_number: 2,
      }),
      makeRow({
        id: 3,
        date_completed: "2026-01-07",
        workout_id: 9,
        set_number: 1,
      }),
    ];
    mockDb.getAllAsync.mockResolvedValue(rows);
    const result = await capturedArgs.queryFn();
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].data).toHaveLength(2);
    expect(result.sections[1].data).toHaveLength(1);
  });

  it("formats section dates using en-US locale", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ date_completed: "2026-01-10" }),
    ]);
    const result = await capturedArgs.queryFn();
    // Should match "Jan 10, 2026"
    expect(result.sections[0].date).toMatch(/Jan\s+10,\s+2026/);
  });

  it("marks a set as is_pr when its progression_metric equals all_time_pr", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ progression_metric: 116.7, all_time_pr: 116.7 }),
    ]);
    const result = await capturedArgs.queryFn();
    expect(result.sections[0].data[0].is_pr).toBe(true);
  });

  it("marks a set as not is_pr when progression_metric is below all_time_pr", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ progression_metric: 100, all_time_pr: 116.7 }),
    ]);
    const result = await capturedArgs.queryFn();
    expect(result.sections[0].data[0].is_pr).toBe(false);
  });

  it("excludes warmup sets from chartSets", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ is_warmup: 1, progression_metric: 80 }),
      makeRow({
        id: 2,
        is_warmup: 0,
        progression_metric: 116.7,
        set_number: 2,
      }),
    ]);
    const result = await capturedArgs.queryFn();
    expect(result.chartSets).toHaveLength(1);
    expect(result.chartSets[0].set_number).toBe(2);
  });

  it("excludes sets with null progression_metric from chartSets", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ is_warmup: 0, progression_metric: null }),
    ]);
    const result = await capturedArgs.queryFn();
    expect(result.chartSets).toHaveLength(0);
  });

  it("includes oneRepMax in chartSets for weight tracking", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ tracking_type: "weight" }),
    ]);
    const result = await capturedArgs.queryFn();
    expect(result.chartSets[0].oneRepMax).toBeDefined();
    expect(result.chartSets[0].oneRepMax).toBe(Math.round(116.7 * 10) / 10);
  });

  it("does not include oneRepMax in chartSets for time tracking", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({
        tracking_type: "time",
        weight: null,
        reps: null,
        time: 60,
        progression_metric: 60,
      }),
    ]);
    const result = await capturedArgs.queryFn();
    expect(result.chartSets[0].oneRepMax).toBeUndefined();
  });

  it("returns correct trackingType from the first row", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ tracking_type: "reps" })]);
    const result = await capturedArgs.queryFn();
    expect(result.trackingType).toBe("reps");
  });

  it("notifies Bugsnag and rethrows on error", async () => {
    const error = new Error("db crash");
    mockDb.getAllAsync.mockRejectedValue(error);
    await expect(capturedArgs.queryFn()).rejects.toThrow("db crash");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
