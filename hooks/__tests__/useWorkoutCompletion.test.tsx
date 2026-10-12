import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkoutCompletion } from "../useWorkoutCompletion";
import {
  updatePlanWorkoutExercises,
  updateStandaloneWorkout,
} from "@/utils/database";

jest.mock("@/utils/database", () => ({
  updatePlanWorkoutExercises: jest.fn().mockResolvedValue(undefined),
  updateStandaloneWorkout: jest.fn().mockResolvedValue(undefined),
}));

const exercise = (id: number, sets = 3) =>
  ({
    id: id * 10,
    exercise_id: id,
    name: `Ex ${id}`,
    sets: Array.from({ length: sets }, () => ({ repsMin: 8, repsMax: 10 })),
  }) as any;
const original = { name: "Push", exercises: [exercise(1), exercise(2)] };
// More sets on one exercise, fewer on the other.
const changed = {
  name: "Push",
  exercises: [exercise(1, 2), exercise(2, 4)],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

const ask = jest.fn();

const complete = async (
  input: Parameters<ReturnType<typeof useWorkoutCompletion>>[0],
) => {
  const { result } = renderHook(() => useWorkoutCompletion(ask), { wrapper });
  let outcome: Awaited<ReturnType<ReturnType<typeof useWorkoutCompletion>>>;
  await act(async () => {
    outcome = await result.current(input);
  });
  return outcome!;
};

const planInput = {
  isQuickWorkout: false,
  planId: 1,
  workoutId: 2,
  workout: changed,
  originalWorkout: original,
};

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
    expect(ask).not.toHaveBeenCalled();
  });

  it("goes straight to the summary for an unchanged plan workout", async () => {
    const outcome = await complete({ ...planInput, workout: original });
    expect(outcome).toEqual({ next: "summary", updated: null });
    expect(ask).not.toHaveBeenCalled();
  });

  it("lists each change once and keeps the plan when the user says so", async () => {
    ask.mockResolvedValueOnce(null);
    const outcome = await complete(planInput);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith({
      isPlan: true,
      changes: [
        expect.objectContaining({ id: "modify:id:10", name: "Ex 1" }),
        expect.objectContaining({ id: "modify:id:20", name: "Ex 2" }),
      ],
    });
    expect(updatePlanWorkoutExercises).not.toHaveBeenCalled();
    expect(outcome).toEqual({ next: "summary", updated: null });
  });

  it("keeps the plan when no change is chosen", async () => {
    ask.mockResolvedValueOnce([]);
    const outcome = await complete(planInput);
    expect(updatePlanWorkoutExercises).not.toHaveBeenCalled();
    expect(outcome).toEqual({ next: "summary", updated: null });
  });

  it("updates the plan with every change when all are chosen", async () => {
    ask.mockResolvedValueOnce(["modify:id:10", "modify:id:20"]);
    const outcome = await complete(planInput);
    expect(updatePlanWorkoutExercises).toHaveBeenCalledWith(
      2,
      changed.exercises,
    );
    expect(outcome).toEqual({ next: "summary", updated: "plan" });
  });

  it("updates the plan with only the chosen changes", async () => {
    ask.mockResolvedValueOnce(["modify:id:20"]);
    await complete(planInput);
    expect(updatePlanWorkoutExercises).toHaveBeenCalledWith(2, [
      original.exercises[0],
      changed.exercises[1],
    ]);
  });

  it("updates a changed workout outside plans", async () => {
    ask.mockResolvedValueOnce(["modify:id:20"]);
    const outcome = await complete({
      ...planInput,
      planId: null,
      workoutId: 7,
    });
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ isPlan: false }),
    );
    expect(updateStandaloneWorkout).toHaveBeenCalledWith(7, "Push", [
      original.exercises[0],
      changed.exercises[1],
    ]);
    expect(outcome).toEqual({ next: "summary", updated: "workout" });
  });

  it("still reaches the summary when the plan update fails", async () => {
    (updatePlanWorkoutExercises as jest.Mock).mockRejectedValueOnce(
      new Error("db locked"),
    );
    ask.mockResolvedValueOnce(["modify:id:10"]);
    const outcome = await complete(planInput);
    expect(outcome).toEqual({
      next: "summary",
      updated: null,
      updateFailed: true,
    });
  });
});
