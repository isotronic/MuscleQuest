import { renderHook } from "@testing-library/react-native";
import { useClearFinishedWorkout } from "../useClearFinishedWorkout";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

const seedWorkout = () =>
  useActiveWorkoutStore.setState({
    workout: { name: "Push", exercises: [] } as any,
    activeWorkout: { planId: 1, workoutId: 2, name: "Push" } as any,
  });

describe("useClearFinishedWorkout", () => {
  beforeEach(() => {
    seedWorkout();
  });

  it("clears the active workout store when the summary is shown fresh", () => {
    renderHook(() => useClearFinishedWorkout("true"));
    expect(useActiveWorkoutStore.getState().workout).toBeNull();
    expect(useActiveWorkoutStore.getState().activeWorkout).toBeNull();
  });

  it("leaves the store alone when viewing a past workout", () => {
    renderHook(() => useClearFinishedWorkout(undefined));
    expect(useActiveWorkoutStore.getState().workout).not.toBeNull();
  });
});
