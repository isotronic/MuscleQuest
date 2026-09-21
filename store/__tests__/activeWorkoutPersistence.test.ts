// activeWorkoutPersistence.test.ts
//
// The persisted payload is written on every set(), including each keystroke in
// a weight or reps field, so it must stay small and must not carry the workout
// history arrays.
import { useActiveWorkoutStore } from "../activeWorkoutStore";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

type PersistOptions = {
  version?: number;
  partialize?: (state: any) => any;
  migrate?: (persistedState: unknown, version: number) => any;
};

const persistOptions = () =>
  (useActiveWorkoutStore as any).persist.getOptions() as PersistOptions;

const historyEntry = (): CompletedWorkout =>
  ({
    id: 1,
    workout_name: "Push",
    date_completed: "2026-01-01",
    duration: "1:00:00",
    total_sets_completed: 20,
    exercises: Array.from({ length: 8 }, (_, e) => ({
      exercise_id: e + 1,
      exercise_name: `Exercise ${e + 1}`,
      // The image blob is the reason this payload is expensive to serialise.
      exercise_image: "x".repeat(4000),
      sets: Array.from({ length: 4 }, (_, s) => ({
        set_number: s + 1,
        weight: 60,
        reps: 8,
      })),
    })),
  }) as unknown as CompletedWorkout;

const buildWorkout = (exerciseCount: number) => ({
  id: 1,
  name: "Push",
  exercises: Array.from({ length: exerciseCount }, (_, i) => ({
    exercise_id: i + 1,
    name: `Exercise ${i + 1}`,
    sets: Array.from({ length: 4 }, () => ({
      isWarmup: false,
      repsMin: 8,
      repsMax: 12,
      restMinutes: 2,
      restSeconds: 0,
    })),
  })),
});

describe("activeWorkoutStore persistence", () => {
  beforeEach(() => {
    useActiveWorkoutStore.setState({
      activeWorkout: { planId: 1, workoutId: 1, name: "Push" },
      workout: buildWorkout(10) as any,
      originalWorkout: buildWorkout(10) as any,
      previousWorkoutData: [historyEntry()],
      globalHistoryData: [historyEntry(), historyEntry()],
      weightAndReps: { 0: { 0: { weight: "60", reps: "8" } } },
      startTime: new Date("2026-01-01T10:00:00Z"),
      timerExpiry: new Date("2026-01-01T10:02:00Z"),
      currentSetStartedAt: null,
    });
  });

  describe("partialize", () => {
    it("omits the history arrays that are reloaded from SQLite", () => {
      const persisted = persistOptions().partialize!(
        useActiveWorkoutStore.getState(),
      );

      expect(persisted).not.toHaveProperty("previousWorkoutData");
      expect(persisted).not.toHaveProperty("globalHistoryData");
    });

    it("keeps the in-progress session state that cannot be rebuilt", () => {
      const persisted = persistOptions().partialize!(
        useActiveWorkoutStore.getState(),
      );

      expect(persisted.weightAndReps).toEqual({
        0: { 0: { weight: "60", reps: "8" } },
      });
      expect(persisted.activeWorkout).toEqual({
        planId: 1,
        workoutId: 1,
        name: "Push",
      });
      expect(persisted.workout).toBeTruthy();
      expect(persisted.originalWorkout).toBeTruthy();
    });

    it("serialises the date fields as ISO strings", () => {
      const persisted = persistOptions().partialize!(
        useActiveWorkoutStore.getState(),
      );

      expect(persisted.startTime).toBe("2026-01-01T10:00:00.000Z");
      expect(persisted.timerExpiry).toBe("2026-01-01T10:02:00.000Z");
      expect(persisted.currentSetStartedAt).toBeNull();
    });

    it("does not persist store actions", () => {
      const persisted = persistOptions().partialize!(
        useActiveWorkoutStore.getState(),
      );

      const functionKeys = Object.entries(persisted)
        .filter(([, v]) => typeof v === "function")
        .map(([k]) => k);
      expect(functionKeys).toEqual([]);
    });

    it("stays under 50 KB for a 10-exercise workout", () => {
      const persisted = persistOptions().partialize!(
        useActiveWorkoutStore.getState(),
      );

      const bytes = JSON.stringify(persisted).length;
      expect(bytes).toBeLessThan(50 * 1024);
    });
  });

  describe("migrate", () => {
    const v0Payload = {
      activeWorkout: { planId: 1, workoutId: 1, name: "Push" },
      weightAndReps: { 0: { 0: { weight: "60", reps: "8" } } },
      previousWorkoutData: [historyEntry()],
      globalHistoryData: [historyEntry()],
    };

    it("drops the history keys from a v0 payload", () => {
      const migrated = persistOptions().migrate!(v0Payload, 0);

      expect(migrated).not.toHaveProperty("previousWorkoutData");
      expect(migrated).not.toHaveProperty("globalHistoryData");
    });

    it("keeps weightAndReps when migrating from v0", () => {
      const migrated = persistOptions().migrate!(v0Payload, 0);

      expect(migrated.weightAndReps).toEqual({
        0: { 0: { weight: "60", reps: "8" } },
      });
      expect(migrated.activeWorkout).toEqual(v0Payload.activeWorkout);
    });

    it("also strips a payload too old to carry a version", () => {
      // zustand only reads a version it wrote, so a payload from before the
      // store had one arrives as undefined rather than 0.
      const migrated = persistOptions().migrate!(
        v0Payload,
        undefined as unknown as number,
      );

      expect(migrated).not.toHaveProperty("previousWorkoutData");
      expect(migrated).not.toHaveProperty("globalHistoryData");
      expect(migrated.weightAndReps).toEqual(v0Payload.weightAndReps);
    });

    it("passes through a payload that is not an object", () => {
      expect(persistOptions().migrate!(null, 0)).toBeNull();
    });

    it("is declared at version 1", () => {
      expect(persistOptions().version).toBe(1);
    });
  });
});
