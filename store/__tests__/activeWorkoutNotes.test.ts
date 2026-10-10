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
const exercise = (id: number, sets = 3) =>
  ({
    exercise_id: id,
    name: `Ex ${id}`,
    tracking_type: "weight",
    sets: Array.from({ length: sets }, (_, i) => set(8 + i)),
  }) as any;

const store = () => useActiveWorkoutStore.getState();

const seed = () => {
  act(() =>
    store().setWorkout(
      {
        id: 2,
        name: "Push",
        exercises: [exercise(1), exercise(2), exercise(3)],
      } as any,
      1,
      2,
      "Push",
    ),
  );
  act(() => {
    store().setSetNote(0, 1, "bar felt heavy");
    store().setSetNote(1, 2, "shoulder on rep 6");
    store().setSetNote(2, 0, "easy");
  });
};

const persistOptions = () =>
  (useActiveWorkoutStore as any).persist.getOptions() as {
    partialize: (state: any) => any;
  };

describe("session note", () => {
  beforeEach(seed);

  it("is stored and persisted for crash recovery", () => {
    act(() => store().setSessionNote("Slept badly"));

    expect(store().sessionNote).toBe("Slept badly");
    expect(persistOptions().partialize(store()).sessionNote).toBe(
      "Slept badly",
    );
  });

  it("starts empty for every new session and after clearing", () => {
    act(() => store().setSessionNote("Slept badly"));
    act(() => store().startQuickWorkout());
    expect(store().sessionNote).toBe("");
    expect(store().setNotes).toEqual({});

    act(() => store().setSessionNote("Quick one"));
    act(() => store().setSetNote(0, 0, "x"));
    act(() => store().clearPersistedStore());
    expect(store().sessionNote).toBe("");
    expect(store().setNotes).toEqual({});
  });

  it("is cleared by a restart", () => {
    act(() => store().setSessionNote("Slept badly"));
    act(() => store().restartWorkout());
    expect(store().sessionNote).toBe("");
    expect(store().setNotes).toEqual({});
  });
});

describe("set notes", () => {
  beforeEach(seed);

  it("are stored per exercise and set, and persisted", () => {
    expect(store().setNotes).toEqual({
      0: { 1: "bar felt heavy" },
      1: { 2: "shoulder on rep 6" },
      2: { 0: "easy" },
    });
    expect(persistOptions().partialize(store()).setNotes).toEqual(
      store().setNotes,
    );
  });

  it("drop the entry when the note is cleared", () => {
    act(() => store().setSetNote(0, 1, "   "));
    expect(store().setNotes[0]).toEqual({});
  });

  it("follow their exercises through a reorder", () => {
    const [a, b, c] = store().workout!.exercises;
    act(() => store().reorderExercises([c, a, b]));

    expect(store().setNotes).toEqual({
      0: { 0: "easy" },
      1: { 1: "bar felt heavy" },
      2: { 2: "shoulder on rep 6" },
    });
  });

  it("shift down when an exercise is removed", () => {
    act(() => store().deleteExercise(0));

    expect(store().setNotes).toEqual({
      0: { 2: "shoulder on rep 6" },
      1: { 0: "easy" },
    });
  });

  it("come back with an exercise restored by undo", () => {
    const before = store().setNotes;
    const snapshot = store().snapshotExercise(1)!;
    act(() => store().deleteExercise(1));
    act(() => store().restoreExercise(snapshot));

    expect(store().setNotes).toEqual(before);
  });

  it("stay on the right sets when a set is removed and restored", () => {
    act(() => store().setCurrentExerciseIndex(1));
    const snapshot = store().snapshotSet(1, 0)!;
    act(() => store().removeSet(0));
    expect(store().setNotes[1]).toEqual({ 1: "shoulder on rep 6" });

    act(() => store().restoreSet(snapshot));
    expect(store().setNotes[1]).toEqual({ 2: "shoulder on rep 6" });
  });

  it("go with the removed set", () => {
    act(() => store().setCurrentExerciseIndex(1));
    const snapshot = store().snapshotSet(1, 2)!;
    act(() => store().removeSet(2));
    expect(store().setNotes[1]).toEqual({});

    act(() => store().restoreSet(snapshot));
    expect(store().setNotes[1]).toEqual({ 2: "shoulder on rep 6" });
  });

  it("are cleared for a replaced exercise only", () => {
    act(() => store().replaceExercise(1, exercise(9)));

    expect(store().setNotes).toEqual({
      0: { 1: "bar felt heavy" },
      1: {},
      2: { 0: "easy" },
    });
  });

  it("shift up when a superset partner is inserted", () => {
    act(() => store().createSuperset(0, exercise(9)));

    expect(store().setNotes).toEqual({
      0: { 1: "bar felt heavy" },
      1: {},
      2: { 2: "shoulder on rep 6" },
      3: { 0: "easy" },
    });
  });

  it("are not copied onto an added set", () => {
    act(() => store().setCurrentExerciseIndex(1));
    act(() => store().addSet());
    act(() => store().addDropSet());

    expect(store().setNotes[1]).toEqual({ 2: "shoulder on rep 6" });
  });
});
