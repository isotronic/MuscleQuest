import { act } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "../activeWorkoutStore";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

const exercise = (exerciseId: number, id?: number) =>
  ({
    ...(id != null ? { id } : {}),
    exercise_id: exerciseId,
    name: `Ex ${exerciseId}`,
    tracking_type: "weight",
    sets: [{ repsMin: 8, repsMax: 10, restMinutes: 1, restSeconds: 0 }],
  }) as any;

const store = () => useActiveWorkoutStore.getState();

describe("replaceExercise", () => {
  beforeEach(() => {
    act(() => {
      store().setWorkout(
        { id: 2, name: "Push", exercises: [exercise(1, 11), exercise(2, 12)] },
        1,
        2,
        "Push",
      );
    });
  });

  it("marks the replacement with the row it replaced", () => {
    act(() => {
      store().replaceExercise(1, exercise(9));
    });
    const replacement = store().workout!.exercises[1];
    expect(replacement.id).toBeUndefined();
    expect(replacement.replacedFromId).toBe(12);
  });

  it("keeps the first row through a second replacement", () => {
    act(() => {
      store().replaceExercise(1, exercise(9));
    });
    act(() => {
      store().replaceExercise(1, exercise(8));
    });
    expect(store().workout!.exercises[1].replacedFromId).toBe(12);
  });

  it("leaves an exercise added in the session unmarked", () => {
    act(() => {
      store().appendExercise(exercise(7));
    });
    act(() => {
      store().replaceExercise(2, exercise(9));
    });
    expect(store().workout!.exercises[2]).not.toHaveProperty("replacedFromId");
  });
});
