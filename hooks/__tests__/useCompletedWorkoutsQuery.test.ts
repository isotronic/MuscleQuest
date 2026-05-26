import { useCompletedWorkoutsQuery } from "../useCompletedWorkoutsQuery";
import { openDatabase } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockDb = { getAllAsync: jest.fn() };
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
  date_completed: "2026-01-01",
  duration: 3600,
  total_sets_completed: 9,
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
      makeRow({ exercise_id: 100, set_id: 1001 }),
      makeRow({ exercise_id: 200, exercise_name: "Squat", set_id: 2001 }),
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
});
