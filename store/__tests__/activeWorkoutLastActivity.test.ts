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
const exercise = (id: number) => ({
  exercise_id: id,
  name: `Exercise ${id}`,
  tracking_type: "weight",
  sets: [set(), set()],
});
const workout = () => ({ id: 1, name: "Push", exercises: [exercise(1)] });

const persistOptions = () =>
  (useActiveWorkoutStore as any).persist.getOptions() as {
    partialize: (state: any) => any;
    onRehydrateStorage: () => (state: any) => void;
  };

const NOW = new Date("2026-09-01T12:00:00Z");

describe("activeWorkoutStore lastActivityAt", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-01T10:00:00Z"));
    useActiveWorkoutStore.getState().setWorkout(workout() as any, 1, 1, "Push");
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const lastActivityAt = () => useActiveWorkoutStore.getState().lastActivityAt;

  it("is null for a workout that has just started", () => {
    expect(lastActivityAt()).toBeNull();
  });

  it("is set when a set is completed", () => {
    useActiveWorkoutStore.getState().nextSet();
    expect(lastActivityAt()).toEqual(NOW);
  });

  it("is set when the last set of the workout is completed", () => {
    useActiveWorkoutStore.getState().nextSet();
    jest.setSystemTime(new Date("2026-09-01T12:05:00Z"));
    useActiveWorkoutStore.getState().nextSet();
    expect(lastActivityAt()).toEqual(new Date("2026-09-01T12:05:00Z"));
  });

  it("is set when a value is edited", () => {
    useActiveWorkoutStore.getState().updateWeightAndReps(0, 0, "60", "8");
    expect(lastActivityAt()).toEqual(NOW);
  });

  it("is set when an exercise is added", () => {
    useActiveWorkoutStore.getState().appendExercise(exercise(2) as any);
    expect(lastActivityAt()).toEqual(NOW);
  });

  it("is set when a superset partner is added", () => {
    useActiveWorkoutStore.getState().createSuperset(0, exercise(2) as any);
    expect(lastActivityAt()).toEqual(NOW);
  });

  it("is cleared by restarting or starting another workout", () => {
    useActiveWorkoutStore.getState().nextSet();
    useActiveWorkoutStore.getState().restartWorkout();
    expect(lastActivityAt()).toBeNull();

    useActiveWorkoutStore.getState().nextSet();
    useActiveWorkoutStore.getState().startQuickWorkout();
    expect(lastActivityAt()).toBeNull();
  });

  it("is persisted as an ISO string and rehydrated as a Date", () => {
    useActiveWorkoutStore.getState().nextSet();

    const persisted = persistOptions().partialize(
      useActiveWorkoutStore.getState(),
    );
    expect(persisted.lastActivityAt).toBe(NOW.toISOString());

    const rehydrated = JSON.parse(JSON.stringify(persisted));
    persistOptions().onRehydrateStorage()(rehydrated);
    expect(rehydrated.lastActivityAt).toEqual(NOW);
    expect(rehydrated.lastActivityAt).toBeInstanceOf(Date);
  });

  it("stays null through rehydration for a workout persisted before the field existed", () => {
    const persisted = persistOptions().partialize(
      useActiveWorkoutStore.getState(),
    );
    const legacy = JSON.parse(JSON.stringify(persisted));
    delete legacy.lastActivityAt;

    persistOptions().onRehydrateStorage()(legacy);

    expect(legacy.lastActivityAt ?? null).toBeNull();
    expect(legacy.startTime).toBeInstanceOf(Date);
  });
});
