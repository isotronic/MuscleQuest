import { useEditCompletedWorkoutMutation } from "../useEditCompletedWorkoutMutation";
import { openDatabase } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(() => Promise.resolve({ runAsync: mockRunAsync })),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

const makeExercises = (weight: number) => [
  {
    exercise_id: 100,
    exercise_name: "Bench Press",
    exercise_tracking_type: "weight",
    sets: [
      {
        set_id: 1001,
        set_number: 1,
        weight,
        reps: 8,
        time: null,
        distance: null,
        is_warmup: false,
        set_duration: null,
      },
    ],
  },
];

describe("useEditCompletedWorkoutMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    mockRunAsync.mockResolvedValue(undefined);
    (openDatabase as jest.Mock).mockResolvedValue({ runAsync: mockRunAsync });
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue(undefined);
    (openDatabase as jest.Mock).mockResolvedValue({ runAsync: mockRunAsync });
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn runs UPDATE for each set in kg", async () => {
    useEditCompletedWorkoutMutation(42, "kg", "m");

    await capturedArgs.mutationFn(makeExercises(100));

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE completed_sets"),
      expect.arrayContaining([100, 8, 0, null, 1001, 1]),
    );
  });

  it("mutationFn converts weight from lbs to kg", async () => {
    useEditCompletedWorkoutMutation(42, "lbs", "m");

    await capturedArgs.mutationFn(makeExercises(220));

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE completed_sets"),
      expect.arrayContaining([
        expect.closeTo(220 * 0.45359237, 2), // converted to kg
      ]),
    );
  });

  it("onSuccess invalidates completedWorkout, completedWorkouts, and trackedExercises", () => {
    useEditCompletedWorkoutMutation(42, "kg", "m");

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkout", 42],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkouts"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["trackedExercises"],
    });
  });
});
