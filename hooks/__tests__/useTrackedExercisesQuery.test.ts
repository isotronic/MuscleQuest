import { useTrackedExercisesQuery } from "../useTrackedExercisesQuery";
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

// Full session row (returned by the filtered main query)
const makeTrackedRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  exercise_id: 100,
  date_added: "2026-01-01",
  name: "Bench Press",
  tracking_type: "weight",
  weight: 100,
  reps: 8,
  time: null,
  distance: null,
  set_number: 1,
  date_completed: "2026-01-15",
  progression_metric: 126.7,
  ...overrides,
});

// Minimal row returned by the allTrackedRows query (no set-level fields needed)
const makeAllTrackedRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  exercise_id: 100,
  date_added: "2026-01-01",
  name: "Bench Press",
  tracking_type: "weight",
  ...overrides,
});

const makeAllTimePRRow = (exercise_id: number, pr: number) => ({
  exercise_id,
  all_time_pr: pr,
});

// Helper: mock the three getAllAsync calls made per queryFn execution.
// Order matches the code:
//   1. Promise.all[0] – filtered main query (session rows)
//   2. Promise.all[1] – allTrackedRows query (base exercise rows)
//   3. sequential     – allTimePR query
const mockCalls = (
  filteredRows: any[],
  allTrackedRows: any[],
  prRows: any[],
) => {
  mockDb.getAllAsync
    .mockResolvedValueOnce(filteredRows)
    .mockResolvedValueOnce(allTrackedRows)
    .mockResolvedValueOnce(prRows);
};

describe("useTrackedExercisesQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with correct queryKey", () => {
    useTrackedExercisesQuery("30", false, false, false);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["trackedExercises", "30", false, false, false, false],
      }),
    );
  });

  it("queryFn returns empty array when no tracked exercises", async () => {
    mockCalls([], [], []);

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toEqual([]);
  });

  it("queryFn groups rows by exercise_id", async () => {
    mockCalls(
      [
        makeTrackedRow({ exercise_id: 100, set_number: 1 }),
        makeTrackedRow({ exercise_id: 100, set_number: 2, weight: 110 }),
      ],
      [makeAllTrackedRow({ exercise_id: 100 })],
      [makeAllTimePRRow(100, 150)],
    );

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(1);
    expect(result[0].exercise_id).toBe(100);
    expect(result[0].completed_sets).toHaveLength(2);
  });

  it("queryFn sets allTimePR from the PR query", async () => {
    mockCalls(
      [makeTrackedRow()],
      [makeAllTrackedRow()],
      [makeAllTimePRRow(100, 200)],
    );

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].allTimePR).toBe(200);
  });

  it("queryFn falls back to 0 for allTimePR when no PR row exists", async () => {
    mockCalls([makeTrackedRow()], [makeAllTrackedRow()], []);

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].allTimePR).toBe(0);
  });

  it("queryFn skips sets with null progression_metric", async () => {
    mockCalls(
      [makeTrackedRow({ progression_metric: null })],
      [makeAllTrackedRow()],
      [],
    );

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].completed_sets).toHaveLength(0);
  });

  it("exercises with all sessions filtered still appear with empty completed_sets", async () => {
    // Filtered query returns nothing (e.g. tracking type mismatch on all sessions)
    // but the exercise is still in tracked_exercises.
    mockCalls(
      [],
      [makeAllTrackedRow({ exercise_id: 42, name: "Pull Up" })],
      [],
    );

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(1);
    expect(result[0].exercise_id).toBe(42);
    expect(result[0].completed_sets).toHaveLength(0);
    expect(result[0].allTimePR).toBe(0);
  });

  it("multiple exercises from allTrackedRows all appear even when filtered query is empty", async () => {
    mockCalls(
      [],
      [
        makeAllTrackedRow({ exercise_id: 10, name: "Squat" }),
        makeAllTrackedRow({ exercise_id: 20, name: "Row" }),
        makeAllTrackedRow({ exercise_id: 30, name: "OHP" }),
      ],
      [],
    );

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(3);
    expect(result.map((e: any) => e.exercise_id)).toEqual(
      expect.arrayContaining([10, 20, 30]),
    );
    result.forEach((e: any) => expect(e.completed_sets).toHaveLength(0));
  });

  it("queryFn returns empty array on error (swallows errors)", async () => {
    const error = new Error("db error");
    mockDb.getAllAsync.mockRejectedValue(error);

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toEqual([]);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
