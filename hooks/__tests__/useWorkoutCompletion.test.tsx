import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useWorkoutCompletion,
  hasStructuralChanges,
} from "../useWorkoutCompletion";
import {
  updatePlanWorkoutExercises,
  updateStandaloneWorkout,
} from "@/utils/database";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/utils/database", () => ({
  updatePlanWorkoutExercises: jest.fn().mockResolvedValue(undefined),
  updateStandaloneWorkout: jest.fn().mockResolvedValue(undefined),
}));

const exercise = (id: number, sets = 3) =>
  ({
    exercise_id: id,
    name: `Ex ${id}`,
    sets: Array.from({ length: sets }, () => ({ repsMin: 8, repsMax: 10 })),
  }) as any;
const original = { name: "Push", exercises: [exercise(1), exercise(2)] };
const changed = { name: "Push", exercises: [exercise(1), exercise(2, 4)] };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

/** Answers the next Alert by pressing the button with this label. */
const answerAlertWith = (label: string) =>
  (Alert.alert as jest.Mock).mockImplementationOnce(
    (_title, _message, buttons: any[]) =>
      buttons.find((b) => b.text === label).onPress(),
  );

const complete = async (
  input: Parameters<ReturnType<typeof useWorkoutCompletion>>[0],
) => {
  const { result } = renderHook(() => useWorkoutCompletion(), { wrapper });
  let outcome: Awaited<ReturnType<ReturnType<typeof useWorkoutCompletion>>>;
  await act(async () => {
    outcome = await result.current(input);
  });
  return outcome!;
};

describe("hasStructuralChanges", () => {
  it("is false for the same exercises and sets", () => {
    expect(hasStructuralChanges(original, { ...original })).toBe(false);
  });

  it("is true when a set was added", () => {
    expect(hasStructuralChanges(changed, original)).toBe(true);
  });
});

describe("useWorkoutCompletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends a quick workout to the save-as-template prompt", async () => {
    const outcome = await complete({
      isQuickWorkout: true,
      planId: null,
      workoutId: null,
      workout: changed,
      originalWorkout: null,
    });
    expect(outcome).toEqual({ next: "quickSave", updated: null });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("goes straight to the summary for an unchanged plan workout", async () => {
    const outcome = await complete({
      isQuickWorkout: false,
      planId: 1,
      workoutId: 2,
      workout: original,
      originalWorkout: original,
    });
    expect(outcome).toEqual({ next: "summary", updated: null });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("asks once and keeps the plan when the user says so", async () => {
    answerAlertWith("Keep plan as is");
    const outcome = await complete({
      isQuickWorkout: false,
      planId: 1,
      workoutId: 2,
      workout: changed,
      originalWorkout: original,
    });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Update your plan?",
      "You changed this workout. Apply those changes to future sessions?",
      expect.any(Array),
      expect.anything(),
    );
    expect(updatePlanWorkoutExercises).not.toHaveBeenCalled();
    expect(outcome).toEqual({ next: "summary", updated: null });
  });

  it("updates the plan after a single confirmation", async () => {
    answerAlertWith("Update plan");
    const outcome = await complete({
      isQuickWorkout: false,
      planId: 1,
      workoutId: 2,
      workout: changed,
      originalWorkout: original,
    });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(updatePlanWorkoutExercises).toHaveBeenCalledWith(
      2,
      changed.exercises,
    );
    expect(outcome).toEqual({ next: "summary", updated: "plan" });
  });

  it("updates a changed standalone workout after a single confirmation", async () => {
    answerAlertWith("Update workout");
    const outcome = await complete({
      isQuickWorkout: false,
      planId: null,
      workoutId: 7,
      workout: changed,
      originalWorkout: original,
    });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(updateStandaloneWorkout).toHaveBeenCalledWith(
      7,
      "Push",
      changed.exercises,
    );
    expect(outcome).toEqual({ next: "summary", updated: "workout" });
  });

  it("still reaches the summary when the plan update fails", async () => {
    (updatePlanWorkoutExercises as jest.Mock).mockRejectedValueOnce(
      new Error("db locked"),
    );
    answerAlertWith("Update plan");
    const outcome = await complete({
      isQuickWorkout: false,
      planId: 1,
      workoutId: 2,
      workout: changed,
      originalWorkout: original,
    });
    expect(outcome).toEqual({
      next: "summary",
      updated: null,
      updateFailed: true,
    });
  });
});
