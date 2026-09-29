import { renderHook } from "@testing-library/react-native";
import { useClearFinishedWorkout } from "../useClearFinishedWorkout";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { cancelRestNotifications } from "@/utils/restNotification";

jest.mock("@/utils/restNotification", () => ({
  cancelRestNotifications: jest.fn().mockResolvedValue(undefined),
}));

const seedWorkout = () =>
  useActiveWorkoutStore.setState({
    workout: { name: "Push", exercises: [] } as any,
    activeWorkout: { planId: 1, workoutId: 2, name: "Push" } as any,
  });

describe("useClearFinishedWorkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedWorkout();
  });

  it("clears the active workout store when the summary is shown fresh", () => {
    renderHook(() => useClearFinishedWorkout("true"));
    expect(useActiveWorkoutStore.getState().workout).toBeNull();
    expect(useActiveWorkoutStore.getState().activeWorkout).toBeNull();
  });

  it("cancels a pending rest notification for the finished session", () => {
    renderHook(() => useClearFinishedWorkout("true"));
    expect(cancelRestNotifications).toHaveBeenCalled();
  });

  it("leaves the store alone when viewing a past workout", () => {
    renderHook(() => useClearFinishedWorkout(undefined));
    expect(useActiveWorkoutStore.getState().workout).not.toBeNull();
    expect(cancelRestNotifications).not.toHaveBeenCalled();
  });
});
