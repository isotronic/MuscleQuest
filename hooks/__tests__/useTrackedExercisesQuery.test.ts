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

const makeAllTimePRRow = (exercise_id: number, pr: number) => ({
  exercise_id,
  all_time_pr: pr,
});

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
    // First call = tracked exercises, second call = all-time PR
    mockDb.getAllAsync
      .mockResolvedValueOnce([]) // tracked exercises
      .mockResolvedValueOnce([]); // all-time PRs

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toEqual([]);
  });

  it("queryFn groups rows by exercise_id", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        makeTrackedRow({ exercise_id: 100, set_number: 1 }),
        makeTrackedRow({ exercise_id: 100, set_number: 2, weight: 110 }),
      ])
      .mockResolvedValueOnce([makeAllTimePRRow(100, 150)]);

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result).toHaveLength(1);
    expect(result[0].exercise_id).toBe(100);
    expect(result[0].completed_sets).toHaveLength(2);
  });

  it("queryFn sets allTimePR from the PR query", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([makeTrackedRow()])
      .mockResolvedValueOnce([makeAllTimePRRow(100, 200)]);

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].allTimePR).toBe(200);
  });

  it("queryFn falls back to 0 for allTimePR when no PR row exists", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([makeTrackedRow()])
      .mockResolvedValueOnce([]); // no PR rows

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result[0].allTimePR).toBe(0);
  });

  it("queryFn skips sets with null progression_metric", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([makeTrackedRow({ progression_metric: null })])
      .mockResolvedValueOnce([]);

    useTrackedExercisesQuery("30", false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    // Exercise created but with no completed_sets (null progression filtered)
    expect(result[0].completed_sets).toHaveLength(0);
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
