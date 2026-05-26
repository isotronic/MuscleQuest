import { renderHook } from "@testing-library/react-native";
import { useWorkoutDurationEstimate } from "../useWorkoutDurationEstimate";
import { fetchSetDurationsForExercises } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  fetchSetDurationsForExercises: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

const makeExercise = (id: number): any => ({
  exercise_id: id,
  equipment: "barbell",
  is_unilateral: false,
  sets: [{ repsMin: 8, repsMax: 10, restMinutes: 2, restSeconds: 0 }],
});

describe("useWorkoutDurationEstimate", () => {
  let capturedQueryArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedQueryArgs = args;
      return { data: undefined, isLoading: false };
    });
  });

  it("returns null estimate when exercises is empty", () => {
    const { result } = renderHook(() => useWorkoutDurationEstimate([]));
    expect(result.current.estimate).toBeNull();
  });

  it("uses queryKey ['exerciseSetDurations', exerciseIds]", () => {
    renderHook(() =>
      useWorkoutDurationEstimate([makeExercise(1), makeExercise(3)]),
    );
    expect(capturedQueryArgs.queryKey).toEqual([
      "exerciseSetDurations",
      [1, 3],
    ]);
  });

  it("disables the query when exercises is empty", () => {
    renderHook(() => useWorkoutDurationEstimate([]));
    expect(capturedQueryArgs.enabled).toBe(false);
  });

  it("enables the query when there are exercises", () => {
    renderHook(() => useWorkoutDurationEstimate([makeExercise(1)]));
    expect(capturedQueryArgs.enabled).toBe(true);
  });

  it("queryFn calls fetchSetDurationsForExercises with exercise ids", async () => {
    (fetchSetDurationsForExercises as jest.Mock).mockResolvedValue({ 1: [] });
    renderHook(() => useWorkoutDurationEstimate([makeExercise(1)]));
    const result = await capturedQueryArgs.queryFn();
    expect(fetchSetDurationsForExercises).toHaveBeenCalledWith([1]);
    expect(result).toEqual({ 1: [] });
  });

  it("queryFn notifies Bugsnag on error and rethrows", async () => {
    const error = new Error("db error");
    (fetchSetDurationsForExercises as jest.Mock).mockRejectedValue(error);
    renderHook(() => useWorkoutDurationEstimate([makeExercise(1)]));
    await expect(capturedQueryArgs.queryFn()).rejects.toThrow("db error");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });

  it("returns a non-null estimate when exercises are provided", () => {
    (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });
    const { result } = renderHook(() =>
      useWorkoutDurationEstimate([makeExercise(1)]),
    );
    expect(result.current.estimate).not.toBeNull();
  });

  it("forwards isLoading from useQuery", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { result } = renderHook(() =>
      useWorkoutDurationEstimate([makeExercise(1)]),
    );
    expect(result.current.isLoading).toBe(true);
  });
});
