import { useEditCompletedWorkoutMutation } from "../useEditCompletedWorkoutMutation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";
import { syncCompletedWorkoutChanged } from "@/utils/sharedSync";
import { applyHistoryEdits } from "@/utils/db/historyEdits";
import type { EditableWorkout } from "@/utils/historyEditOps";

jest.mock("@/utils/db/historyEdits", () => ({
  applyHistoryEdits: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/utils/sharedSync", () => ({
  syncCompletedWorkoutChanged: jest.fn(),
}));
jest.mock("@/utils/progressionRecompute", () => ({
  refreshProgressionAfterHistoryChange: jest.fn(),
}));
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));
// The real module needs react-native's Platform, mocked away above.
jest.mock("expo-localization", () => ({
  getLocales: () => [{ decimalSeparator: ".", languageTag: "en-US" }],
}));
// Marks everything that goes through `t`, so an untranslated literal fails.
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => `[t] ${s[0]}`,
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

const workout = (weight: number, exerciseId = 100): EditableWorkout => ({
  completedAt: new Date("2026-10-01T08:00:00Z"),
  durationSeconds: 3600,
  notes: null,
  exercises: [
    {
      completed_exercise_id: 9000,
      exercise_id: exerciseId,
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
  ],
});

describe("useEditCompletedWorkoutMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    useEditCompletedWorkoutMutation(42, "lbs", "km");
  });

  it("applies only the changed values, converted to storage units", async () => {
    await capturedArgs.mutationFn({
      original: workout(100),
      edited: workout(220),
    });

    expect(applyHistoryEdits).toHaveBeenCalledWith(42, [
      {
        kind: "setValues",
        setId: 1001,
        values: { weight: expect.closeTo(99.79, 2) },
      },
    ]);
  });

  it("refreshes progression for the edited workout on success", () => {
    capturedArgs.onSuccess(undefined, {
      original: workout(100),
      edited: workout(105),
    });
    expect(refreshProgressionAfterHistoryChange).toHaveBeenCalledWith(
      expect.anything(),
      42,
    );
  });

  it("re-shares the workout, including exercises swapped out", () => {
    capturedArgs.onSuccess(undefined, {
      original: workout(100, 100),
      edited: workout(100, 300),
    });
    expect(syncCompletedWorkoutChanged).toHaveBeenCalledWith(42, [100]);
  });

  it("shows a translated alert on error", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    capturedArgs.onError(new Error("boom"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "[t] Error",
      expect.stringContaining("[t] "),
    );
  });

  it("invalidates the workout, history and stats keys once settled", () => {
    capturedArgs.onSettled();
    for (const queryKey of [
      ["completedWorkout", 42],
      ["completedWorkouts"],
      ["exerciseDetail"],
      ["exerciseHistory"],
      ["trackedExercises"],
      ["workoutSessionHistory"],
      ["globalExerciseHistoryForSession"],
    ]) {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
  });
});
