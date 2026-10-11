import { act } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "../activeWorkoutStore";
import { QUICK_WORKOUT_NAME } from "@/constants/quickWorkout";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

const store = () => useActiveWorkoutStore.getState();

const exercise = (id: number, sets: number) =>
  ({
    exercise_id: id,
    name: `Ex ${id}`,
    tracking_type: "weight",
    sets: Array.from({ length: sets }, (_, i) => ({
      repsMin: 8,
      repsMax: 12,
      restMinutes: 1,
      restSeconds: 0,
      isWarmup: i === 0,
    })),
  }) as any;

describe("startQuickWorkoutFrom", () => {
  it("starts a quick workout holding the given exercises", () => {
    // A finished plan session in the store first, to show nothing carries over.
    act(() =>
      store().setWorkout(
        { id: 2, name: "Push", exercises: [exercise(9, 2)] } as any,
        1,
        2,
        "Push",
      ),
    );
    act(() => store().setSessionNote("old"));

    const exercises = [exercise(1, 3), exercise(2, 1)];
    act(() => store().startQuickWorkoutFrom(exercises));

    expect(store().isQuickWorkout).toBe(true);
    expect(store().activeWorkout).toEqual({
      planId: null,
      workoutId: null,
      name: QUICK_WORKOUT_NAME,
    });
    expect(store().workout?.exercises.map((e) => e.sets.length)).toEqual([
      3, 1,
    ]);
    expect(store().workout?.exercises[0].sets[0].isWarmup).toBe(true);
    expect(store().originalWorkout?.exercises).toHaveLength(2);
    expect(store().sessionNote).toBe("");
    expect(store().completedSets).toEqual({});
    expect(store().isWorkoutInProgress()).toBe(true);
  });

  it("does not share the caller's objects", () => {
    const exercises = [exercise(1, 1)];
    act(() => store().startQuickWorkoutFrom(exercises));
    exercises[0].sets.push({});
    expect(store().workout?.exercises[0].sets).toHaveLength(1);
  });
});
