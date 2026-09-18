// End-to-end check that a pounds user's weights survive the kg-only
// progression engine: display input -> engine -> prefill -> save.
import { act } from "@testing-library/react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkoutStore } from "../activeWorkoutStore";
import { useSaveCompletedWorkoutMutation } from "@/hooks/useSaveCompletedWorkoutMutation";
import { saveCompletedWorkout } from "@/utils/database";
import { evaluateProgression } from "@/utils/progressionEngine";
import { displayToKg } from "@/utils/weightUnits";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(null),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({})),
}));
jest.mock("@/utils/sharing", () => ({
  pushCompletedWorkout: jest.fn(() => Promise.resolve()),
  pushStrengthPRs: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/database", () => ({
  saveCompletedWorkout: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const workingSet = {
  isWarmup: false,
  repsMin: 8,
  repsMax: 12,
  restMinutes: 2,
  restSeconds: 0,
  time: undefined,
};

describe("progression unit boundary (lbs)", () => {
  it("logs 225lbs, suggests about 230lbs, and stores about 104kg", async () => {
    // Post-set feedback: the 225lbs input is converted before the engine.
    const recentWorkingWeight = displayToKg(225, "lbs");
    expect(recentWorkingWeight).toBeCloseTo(102.06, 2);

    const result = evaluateProgression({
      userWorkoutExerciseId: 55,
      exerciseId: 700,
      trackingType: "weight",
      equipment: "barbell",
      currentSets: [workingSet],
      recentWorkingWeight,
      latestFeedback: {
        userWorkoutExerciseId: 55,
        effortRating: "easy",
        painFlag: "none",
        performanceRatio: 1.0,
      },
      priorFeedbackHistory: [],
      recoveryRating: null,
      consecutiveDirectionCount: 1,
      discomfortStreakCount: 0,
      userIncrements: {
        barbellKg: 2.5,
        dumbbellKg: 2.0,
        cableKg: 2.5,
        machineKg: 2.5,
      },
      completedRepsPerSet: [12],
    });
    expect(result.action).toBe("increase_load");
    expect(result.suggestedWeight).toBe(104.6);

    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Unit Boundary Workout",
          exercises: [
            {
              id: 55,
              exercise_id: 700,
              name: "Bench Press",
              tracking_type: "weight",
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "barbell",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
              sets: [workingSet],
            },
          ],
        },
        previousWorkoutData: null,
        weightAndReps: {},
        suggestedWeightPrefills: {},
      });
      useActiveWorkoutStore.getState().loadProgressionSuggestions(
        [
          {
            userWorkoutExerciseId: 55,
            suggestionAction: result.action,
            suggestedWeight: result.suggestedWeight,
            isApplied: true,
          },
        ],
        "lbs",
        5,
      );
    });

    const prefill = parseFloat(
      useActiveWorkoutStore.getState().weightAndReps[0][0]?.weight ?? "",
    );
    // 104.6kg is 230.6lbs, rounded to the 5lb plate step.
    expect(prefill).toBe(230);

    let capturedArgs: any;
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: jest.fn(),
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    (saveCompletedWorkout as jest.Mock).mockResolvedValue(1);
    useSaveCompletedWorkoutMutation("lbs", "m");

    await capturedArgs.mutationFn({
      planId: 1,
      workoutId: 2,
      duration: 3600,
      totalSetsCompleted: 1,
      exercises: [
        {
          exercise_id: 700,
          sets: [
            {
              set_number: 1,
              weight: prefill,
              reps: 10,
              time: null,
              distance: null,
            },
          ],
        },
      ],
    });

    const savedExercises = (saveCompletedWorkout as jest.Mock).mock.calls[0][5];
    expect(savedExercises[0].sets[0].weight).toBeCloseTo(104.33, 2);
  });
});
