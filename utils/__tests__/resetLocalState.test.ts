import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  resetLocalSessionState,
  resetLocalSessionStateAfterHydration,
} from "../resetLocalState";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useWorkoutStore } from "@/store/workoutStore";
import { useSocialStore } from "@/store/socialStore";
import { cancelRestNotifications } from "@/utils/restNotification";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("@/utils/restNotification", () => ({
  cancelRestNotifications: jest.fn().mockResolvedValue(undefined),
}));

describe("resetLocalSessionState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActiveWorkoutStore.setState({
      activeWorkout: { planId: 1, workoutId: 2, name: "Push" },
      workout: { id: 2, name: "Push", exercises: [] } as any,
      savedCompletedWorkoutId: 9,
    });
    useWorkoutStore.setState({
      workouts: [{ name: "Draft" } as any],
      drafts: { "plan:1": {} as any },
    });
    useSocialStore.setState({
      publishedPlanIds: ["1"],
      publishedWorkoutIds: ["2"],
    });
  });

  it("discards the in-progress workout and its rest alerts", async () => {
    await expect(resetLocalSessionState()).resolves.toBe(true);

    const active = useActiveWorkoutStore.getState();
    expect(active.activeWorkout).toBeNull();
    expect(active.workout).toBeNull();
    expect(active.savedCompletedWorkoutId).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "active-workout-store",
    );
    expect(cancelRestNotifications).toHaveBeenCalled();
  });

  it("drops plan editor drafts that point at the replaced database", async () => {
    await resetLocalSessionState();

    expect(useWorkoutStore.getState().drafts).toEqual({});
    expect(useWorkoutStore.getState().workouts).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("workout-draft-store");
  });

  it("forgets published ids so the listeners repopulate them", async () => {
    await resetLocalSessionState();

    expect(useSocialStore.getState().publishedPlanIds).toBeNull();
    expect(useSocialStore.getState().publishedWorkoutIds).toBeNull();
  });

  it("never throws, so the reload after a swap always runs", async () => {
    jest
      .spyOn(useWorkoutStore.persist, "clearStorage")
      .mockRejectedValueOnce(new Error("storage full") as never);

    // Reports the failure so startup can retry, without throwing.
    await expect(resetLocalSessionState()).resolves.toBe(false);
    // Later steps still ran.
    expect(useSocialStore.getState().publishedPlanIds).toBeNull();
  });

  it("waits until the persisted workout is removed from storage", async () => {
    let finishRemoval!: () => void;
    const clearStorage = jest
      .spyOn(useActiveWorkoutStore.persist, "clearStorage")
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishRemoval = resolve;
        }) as never,
      );
    let done = false;

    const reset = resetLocalSessionState().then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(clearStorage).toHaveBeenCalled();
    expect(done).toBe(false);
    finishRemoval();
    await reset;
    expect(done).toBe(true);
  });

  it("at startup, loads the persisted stores before clearing them", async () => {
    const order: string[] = [];
    jest
      .spyOn(useActiveWorkoutStore.persist, "rehydrate")
      .mockImplementationOnce(async () => {
        order.push("rehydrate");
      });
    jest
      .spyOn(useActiveWorkoutStore.persist, "clearStorage")
      .mockImplementationOnce(() => {
        order.push("clear");
      });

    await resetLocalSessionStateAfterHydration();

    expect(order).toEqual(["rehydrate", "clear"]);
    expect(useActiveWorkoutStore.getState().activeWorkout).toBeNull();
  });

  it("at startup, waits for every store to load even when one load fails", async () => {
    let finishSlowLoad!: () => void;
    jest
      .spyOn(useActiveWorkoutStore.persist, "rehydrate")
      .mockRejectedValueOnce(new Error("bad json") as never);
    jest.spyOn(useWorkoutStore.persist, "rehydrate").mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSlowLoad = resolve;
      }) as never,
    );
    const clearStorage = jest.spyOn(
      useActiveWorkoutStore.persist,
      "clearStorage",
    );

    const reset = resetLocalSessionStateAfterHydration();
    await new Promise((r) => setTimeout(r, 0));

    // A late load would bring back what the reset cleared.
    expect(clearStorage).not.toHaveBeenCalled();
    finishSlowLoad();
    await expect(reset).resolves.toBe(false);
    expect(clearStorage).toHaveBeenCalled();
  });
});
