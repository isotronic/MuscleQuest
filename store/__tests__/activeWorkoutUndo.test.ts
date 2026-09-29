import { act } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "../activeWorkoutStore";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

const set = (repsMin: number) => ({
  isWarmup: false,
  repsMin,
  repsMax: repsMin + 2,
  restMinutes: 1,
  restSeconds: 0,
});
const exercise = (id: number, sets = 2) =>
  ({
    exercise_id: id,
    name: `Ex ${id}`,
    sets: Array.from({ length: sets }, (_, i) => set(8 + i)),
  }) as any;

const seed = () =>
  useActiveWorkoutStore.setState({
    workout: {
      name: "Push",
      exercises: [exercise(1), exercise(2), exercise(3)],
    } as any,
    activeWorkout: { planId: 1, workoutId: 2, name: "Push" } as any,
    currentExerciseIndex: 2,
    currentSetIndices: { 0: 1, 1: 1, 2: 0 },
    completedSets: { 0: { 0: true }, 1: { 0: true, 1: true } },
    weightAndReps: {
      0: { 0: { weight: "50", reps: "8" } },
      1: { 0: { weight: "60", reps: "10" }, 1: { weight: "62.5", reps: "9" } },
      2: { 0: { weight: "20", reps: "12" } },
    } as any,
    setDurations: { 1: { 0: 40, 1: 45 } },
    suggestedWeightPrefills: {},
    appendedExerciseIndices: [],
  });

describe("undo removing an exercise", () => {
  beforeEach(seed);

  it("restores the exercise and its entered values at the same index", () => {
    const store = useActiveWorkoutStore.getState();
    const before = useActiveWorkoutStore.getState();
    const snapshot = store.snapshotExercise(1)!;

    act(() => store.deleteExercise(1));
    expect(useActiveWorkoutStore.getState().workout!.exercises).toHaveLength(2);

    act(() => useActiveWorkoutStore.getState().restoreExercise(snapshot));

    const after = useActiveWorkoutStore.getState();
    expect(after.workout!.exercises.map((e) => e.exercise_id)).toEqual([
      1, 2, 3,
    ]);
    expect(after.weightAndReps).toEqual(before.weightAndReps);
    expect(after.completedSets).toEqual(before.completedSets);
    expect(after.setDurations).toEqual(before.setDurations);
    expect(after.currentSetIndices).toEqual(before.currentSetIndices);
    expect(after.currentExerciseIndex).toBe(2);
  });

  it("keeps changes made to other exercises in the meantime", () => {
    const snapshot = useActiveWorkoutStore.getState().snapshotExercise(0)!;
    act(() => useActiveWorkoutStore.getState().deleteExercise(0));
    // Exercise 3 (now at index 1) gets a value while the snackbar is up.
    act(() =>
      useActiveWorkoutStore.getState().updateWeightAndReps(1, 1, "22.5", "10"),
    );

    act(() => useActiveWorkoutStore.getState().restoreExercise(snapshot));

    const after = useActiveWorkoutStore.getState();
    expect(after.workout!.exercises.map((e) => e.exercise_id)).toEqual([
      1, 2, 3,
    ]);
    expect(after.weightAndReps[0]).toEqual({ 0: { weight: "50", reps: "8" } });
    expect(after.weightAndReps[2][1]).toEqual(
      expect.objectContaining({ weight: "22.5", reps: "10" }),
    );
  });
});

describe("undo removing a set", () => {
  beforeEach(() => {
    seed();
    useActiveWorkoutStore.setState({ currentExerciseIndex: 1 });
  });

  it("puts the set and its values back at the same position", () => {
    const before = useActiveWorkoutStore.getState();
    const snapshot = before.snapshotSet(1, 0)!;

    act(() => useActiveWorkoutStore.getState().removeSet(0));
    expect(
      useActiveWorkoutStore.getState().workout!.exercises[1].sets,
    ).toHaveLength(1);

    act(() => useActiveWorkoutStore.getState().restoreSet(snapshot));

    const after = useActiveWorkoutStore.getState();
    expect(after.workout!.exercises[1].sets).toEqual(
      before.workout!.exercises[1].sets,
    );
    expect(after.weightAndReps[1]).toEqual(before.weightAndReps[1]);
    expect(after.completedSets[1]).toEqual(before.completedSets[1]);
    expect(after.setDurations[1]).toEqual(before.setDurations[1]);
  });

  it("points back at the restored set when it was the current one", () => {
    useActiveWorkoutStore.setState({
      completedSets: { 0: { 0: true }, 1: {} },
      currentSetIndices: { 0: 1, 1: 0, 2: 0 },
    });
    const snapshot = useActiveWorkoutStore.getState().snapshotSet(1, 0)!;

    act(() => useActiveWorkoutStore.getState().removeSet(0));
    act(() => useActiveWorkoutStore.getState().restoreSet(snapshot));

    expect(useActiveWorkoutStore.getState().currentSetIndices[1]).toBe(0);
  });

  it("does nothing if the exercise is no longer where it was", () => {
    const snapshot = useActiveWorkoutStore.getState().snapshotSet(1, 0)!;
    act(() => useActiveWorkoutStore.getState().removeSet(0));
    act(() => useActiveWorkoutStore.getState().deleteExercise(1));
    const before = useActiveWorkoutStore.getState().workout;

    act(() => useActiveWorkoutStore.getState().restoreSet(snapshot));

    expect(useActiveWorkoutStore.getState().workout).toBe(before);
  });
});
