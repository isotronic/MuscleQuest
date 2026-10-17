import { router } from "expo-router";
import { useActiveWorkoutStore } from "../activeWorkoutStore";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

const set = () => ({
  isWarmup: false,
  repsMin: 8,
  repsMax: 12,
  restMinutes: 2,
  restSeconds: 0,
});
const exercise = (id: number, trackingType = "weight", sets = 3) => ({
  exercise_id: id,
  name: `Exercise ${id}`,
  tracking_type: trackingType,
  sets: Array.from({ length: sets }, set),
});

const start = (exercises: unknown[]) =>
  useActiveWorkoutStore
    .getState()
    .setWorkout({ id: 1, name: "Push", exercises } as any, 1, 1, "Push");

const state = () => useActiveWorkoutStore.getState();

describe("activeWorkoutStore completeSetAt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    start([exercise(1), exercise(2)]);
  });

  it("marks the set done without moving to another exercise or screen", () => {
    state().completeSetAt(1, 0);
    expect(state().completedSets[1]).toEqual({ 0: true });
    expect(state().currentExerciseIndex).toBe(0);
    expect(state().lastActivityAt).not.toBeNull();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("does not leave the overview when the last set of the workout is done", () => {
    start([exercise(1, "weight", 1)]);
    state().completeSetAt(0, 0);
    expect(state().completedSets[0]).toEqual({ 0: true });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("carries the weight forward to the next set", () => {
    state().updateWeightAndReps(0, 0, "60", "8");
    state().completeSetAt(0, 0);
    expect(state().weightAndReps[0][1]).toMatchObject({ weight: "60" });
  });

  it("keeps a value already typed into the next set", () => {
    state().updateWeightAndReps(0, 0, "60", "8");
    state().updateWeightAndReps(0, 1, "65", "6");
    state().completeSetAt(0, 0);
    expect(state().weightAndReps[0][1]).toMatchObject({
      weight: "65",
      reps: "6",
    });
  });

  it("keeps a time already typed into the next set", () => {
    start([exercise(1, "time")]);
    state().updateWeightAndReps(0, 1, undefined, undefined, "45");
    state().completeSetAt(0, 0);
    expect(state().weightAndReps[0][1]).toMatchObject({ time: "45" });
  });

  it("moves the exercise's current set past a set done out of order", () => {
    state().completeSetAt(0, 0);
    expect(state().currentSetIndices[0]).toBe(1);
    state().completeSetAt(0, 2);
    expect(state().currentSetIndices[0]).toBe(1);
    state().completeSetAt(0, 1);
    // All done: the pointer stays put.
    expect(state().completedSets[0]).toEqual({ 0: true, 1: true, 2: true });
  });

  it("wraps to an earlier open set when the later ones are done", () => {
    state().setCurrentSetIndex(0, 2);
    state().completeSetAt(0, 2);
    expect(state().currentSetIndices[0]).toBe(0);
  });

  it("ignores a set that does not exist", () => {
    state().completeSetAt(0, 9);
    state().completeSetAt(7, 0);
    expect(state().completedSets).toEqual({});
  });
});
