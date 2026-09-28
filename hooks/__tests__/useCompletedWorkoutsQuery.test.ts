import {
  useCompletedWorkoutsQuery,
  useWorkoutSessionHistoryQuery,
  useGlobalExerciseHistoryForSessionQuery,
  usePreviousPeriodWorkoutsQuery,
} from "../useCompletedWorkoutsQuery";
import { toLocalDateKey } from "@/utils/dates";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockDb = {
  getAllAsync: jest.fn(),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};
jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(() => Promise.resolve(mockDb)),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

// A minimal flat row as returned by the SQL query
const makeRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  workout_id: 10,
  plan_id: 5,
  workout_name: "Push Day",
  date_completed: "2026-01-01T10:00:00.000Z",
  local_date: "2026-01-01",
  duration: 3600,
  total_sets_completed: 9,
  completed_exercise_id: 555,
  exercise_id: 100,
  exercise_name: "Bench Press",
  exercise_image: null,
  exercise_tracking_type: "weight",
  is_unilateral: 0,
  double_weight: 0,
  set_id: 1001,
  set_number: 1,
  weight: 100,
  reps: 8,
  time: null,
  distance: null,
  is_warmup: 0,
  set_duration: null,
  ...overrides,
});

describe("useCompletedWorkoutsQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with queryKey ['completedWorkouts', ...]", () => {
    useCompletedWorkoutsQuery("kg", "m", 30);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["completedWorkouts", "kg", "m", 30],
      }),
    );
  });

  it("queryFn returns an empty array when no rows", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    useCompletedWorkoutsQuery("kg", "m", 30);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toEqual([]);
  });

  it("queryFn groups flat rows into nested CompletedWorkout structure", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow()]);

    useCompletedWorkoutsQuery("kg", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].workout_name).toBe("Push Day");
    expect(result[0].exercises).toHaveLength(1);
    expect(result[0].exercises[0].exercise_name).toBe("Bench Press");
    expect(result[0].exercises[0].sets).toHaveLength(1);
    expect(result[0].exercises[0].completed_exercise_id).toBe(555);
  });

  it("groups multiple sets under the same exercise", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ set_id: 1001, set_number: 1, weight: 100 }),
      makeRow({ set_id: 1002, set_number: 2, weight: 110 }),
    ]);

    useCompletedWorkoutsQuery("kg", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(1);
    expect(result[0].exercises[0].sets).toHaveLength(2);
  });

  it("groups different exercises under the same workout", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ completed_exercise_id: 555, exercise_id: 100, set_id: 1001 }),
      makeRow({
        completed_exercise_id: 556,
        exercise_id: 200,
        exercise_name: "Squat",
        set_id: 2001,
      }),
    ]);

    useCompletedWorkoutsQuery("kg", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(1);
    expect(result[0].exercises).toHaveLength(2);
  });

  it("converts weight from kg to lbs when weightUnit is 'lbs'", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ weight: 100 })]);

    useCompletedWorkoutsQuery("lbs", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    // 100 kg * 2.2046226 = 220.5 lbs
    expect(result[0].exercises[0].sets[0].weight).toBeCloseTo(220.5, 0);
  });

  it("does not convert weight when weightUnit is 'kg'", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ weight: 80 })]);

    useCompletedWorkoutsQuery("kg", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].exercises[0].sets[0].weight).toBe(80);
  });

  it("converts distance from m to ft when distanceUnit is 'ft'", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ distance: 100, exercise_tracking_type: "distance" }),
    ]);

    useCompletedWorkoutsQuery("kg", "ft", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    // 100 m * 3.28084 = 328.08 ft
    expect(result[0].exercises[0].sets[0].distance).toBeCloseTo(328.08, 0);
  });

  it("uses 'Quick Workout' fallback when workout_name is null", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ workout_name: null })]);

    useCompletedWorkoutsQuery("kg", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].workout_name).toBe("Quick Workout");
  });

  it("null weight stays null", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ weight: null })]);

    useCompletedWorkoutsQuery("kg", "m", 0);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].exercises[0].sets[0].weight).toBeNull();
  });

  it("queryFn notifies Bugsnag and rethrows when DB query fails", async () => {
    const error = new Error("DB failure");
    mockDb.getAllAsync.mockRejectedValueOnce(error);

    useCompletedWorkoutsQuery("kg", "m", 30);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];

    await expect(queryFn()).rejects.toThrow();
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

describe("time range filtering", () => {
  afterEach(() => jest.clearAllMocks());

  const runQueryFn = async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const call = (useQuery as jest.Mock).mock.calls.at(-1)![0];
    await call.queryFn();
    return mockDb.getAllAsync.mock.calls.at(-1)!;
  };

  it("filters the recent range on the local training day, not on a UTC instant", async () => {
    useCompletedWorkoutsQuery("kg", "m", 30);
    const [sql, params] = await runQueryFn();

    expect(sql).not.toContain("date('now'");
    expect(sql).toContain("local_date >= ?");

    const expected = new Date();
    expected.setDate(expected.getDate() - 30);
    expect(params).toContain(toLocalDateKey(expected));
  });

  it("selects local_date so readers never have to derive the day", async () => {
    useCompletedWorkoutsQuery("kg", "m", 0);
    const [sql] = await runQueryFn();

    expect(sql).toContain("local_date");
  });

  it("carries local_date through to the grouped workout", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow()]);
    useCompletedWorkoutsQuery("kg", "m", 0);
    const call = (useQuery as jest.Mock).mock.calls.at(-1)![0];
    const result = await call.queryFn();

    expect(result[0].local_date).toBe("2026-01-01");
  });
});

describe("usePreviousPeriodWorkoutsQuery", () => {
  afterEach(() => jest.clearAllMocks());

  // Runs the queryFn the hook last handed react-query, and reports the SQL and
  // parameters it reached the database with.
  const lastQueryBounds = async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    await (useQuery as jest.Mock).mock.calls.at(-1)![0].queryFn();
    const [sql, params] = mockDb.getAllAsync.mock.calls.at(-1)!;
    return { sql, params: params as string[] };
  };

  it("bounds the previous period on inclusive local date keys", async () => {
    usePreviousPeriodWorkoutsQuery("kg", "m", 7);
    const { sql, params } = await lastQueryBounds();

    expect(sql).toContain("local_date BETWEEN ? AND ?");
    expect(params).toHaveLength(2);
    for (const p of params) expect(p).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes the final day of the previous period", async () => {
    // The current 7-day period is [today-7, today]; the previous one is the
    // window of the same size immediately before it, [today-15, today-8].
    // Both bounds are inclusive local date keys, so a workout logged at any
    // time on the end day is counted -- the BETWEEN against a full datetime
    // used to drop it.
    usePreviousPeriodWorkoutsQuery("kg", "m", 7);
    const { params } = await lastQueryBounds();
    const expectedEnd = new Date();
    expectedEnd.setDate(expectedEnd.getDate() - 8);
    const expectedStart = new Date();
    expectedStart.setDate(expectedStart.getDate() - 15);

    expect(params[1]).toBe(toLocalDateKey(expectedEnd));
    expect(params[0]).toBe(toLocalDateKey(expectedStart));
  });

  it("derives its bounds from the local calendar, not from a UTC ISO slice", async () => {
    usePreviousPeriodWorkoutsQuery("kg", "m", 30);
    const { params } = await lastQueryBounds();
    const localToday = toLocalDateKey(new Date());

    expect(params[1] < localToday).toBe(true);
    expect(params[0] < params[1]).toBe(true);
  });
});

describe("useWorkoutSessionHistoryQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("queryFn includes completed_exercise_id on the grouped exercise", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ completed_exercise_id: 777 }),
    ]);

    useWorkoutSessionHistoryQuery(10, "kg", "m");
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].exercises[0].completed_exercise_id).toBe(777);
  });

  it("preserves 2 decimal places of a weight logged with fractional precision", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ weight: 62.25 })]);

    useWorkoutSessionHistoryQuery(10, "kg", "m");
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].exercises[0].sets[0].weight).toBe(62.25);
  });
});

describe("useGlobalExerciseHistoryForSessionQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("queryFn includes completed_exercise_id on the grouped exercise", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ completed_exercise_id: 888 }),
    ]);

    useGlobalExerciseHistoryForSessionQuery([100], "kg", "m");
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].exercises[0].completed_exercise_id).toBe(888);
  });
});
