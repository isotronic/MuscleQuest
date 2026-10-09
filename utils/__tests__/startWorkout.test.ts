import { Alert } from "react-native";
import { router } from "expo-router";
import { confirmStartWorkout } from "../startWorkout";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

// Marks everything that goes through `t`, so an untranslated literal fails.
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => `[t] ${s[0]}`,
}));

const mockIsWorkoutInProgress = jest.fn();
let mockActivity: { startTime?: Date; lastActivityAt?: Date | null } = {};
jest.mock("@/store/activeWorkoutStore", () => ({
  useActiveWorkoutStore: {
    getState: () => ({
      isWorkoutInProgress: mockIsWorkoutInProgress,
      ...mockActivity,
    }),
  },
}));

describe("confirmStartWorkout", () => {
  let setLoading: jest.Mock;
  let onStart: jest.Mock;

  beforeEach(() => {
    setLoading = jest.fn();
    onStart = jest.fn();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("no workout in progress", () => {
    beforeEach(() => {
      mockIsWorkoutInProgress.mockReturnValue(false);
    });

    it("calls setLoading(true), then onStart, then navigates", async () => {
      const promise = confirmStartWorkout(setLoading, onStart);
      // Advance the 50ms delay
      jest.advanceTimersByTime(50);
      await promise;

      expect(setLoading).toHaveBeenCalledWith(true);
      expect(onStart).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith("/(app)/(workout)");
    });

    it("does not show an Alert", async () => {
      const promise = confirmStartWorkout(setLoading, onStart);
      jest.advanceTimersByTime(50);
      await promise;

      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("calls setLoading(false) after the final timeout", async () => {
      const promise = confirmStartWorkout(setLoading, onStart);
      jest.advanceTimersByTime(50);
      await promise;

      jest.advanceTimersByTime(500);
      expect(setLoading).toHaveBeenCalledWith(false);
    });

    it("calls setLoading(false) on error and does not navigate", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      onStart.mockImplementation(() => {
        throw new Error("start failed");
      });

      const promise = confirmStartWorkout(setLoading, onStart);
      jest.advanceTimersByTime(50);
      await promise;

      expect(router.push).not.toHaveBeenCalled();
      expect(setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe("workout already in progress", () => {
    beforeEach(() => {
      mockIsWorkoutInProgress.mockReturnValue(true);
    });

    it("shows an Alert with 3 buttons and does not call onStart", async () => {
      await confirmStartWorkout(setLoading, onStart);

      expect(Alert.alert).toHaveBeenCalledTimes(1);
      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      expect(buttons).toHaveLength(3);
      expect(onStart).not.toHaveBeenCalled();
    });

    it("translates the alert title, message and buttons", async () => {
      await confirmStartWorkout(setLoading, onStart);

      const [title, message, buttons] = (Alert.alert as jest.Mock).mock
        .calls[0];
      expect(title).toBe("[t] Workout In Progress");
      expect(message).toBe(
        "[t] You already have a workout running. Continue it or start a new one?",
      );
      expect(buttons.map((b: { text: string }) => b.text)).toEqual([
        "[t] Cancel",
        "[t] Continue Workout",
        "[t] Start New",
      ]);
    });

    it("Cancel button does nothing", async () => {
      await confirmStartWorkout(setLoading, onStart);

      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      const cancelBtn = buttons.find(
        (b: { text: string }) => b.text === "[t] Cancel",
      );
      // Cancel button has no onPress handler (style: "cancel")
      expect(cancelBtn.onPress).toBeUndefined();
    });

    it("Continue Workout button navigates to workout", async () => {
      await confirmStartWorkout(setLoading, onStart);

      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      const continueBtn = buttons.find(
        (b: { text: string }) => b.text === "[t] Continue Workout",
      );
      continueBtn.onPress();

      expect(router.push).toHaveBeenCalledWith("/(app)/(workout)");
      expect(onStart).not.toHaveBeenCalled();
    });

    it("Continue Workout asks first when the workout was left for hours", async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockActivity = { startTime: dayAgo, lastActivityAt: dayAgo };
      await confirmStartWorkout(setLoading, onStart);

      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      buttons
        .find((b: { text: string }) => b.text === "[t] Continue Workout")
        .onPress();

      expect(router.push).not.toHaveBeenCalled();
      expect(useStaleWorkoutPromptStore.getState().visible).toBe(true);
      mockActivity = {};
    });

    it("Start New button calls onStart and navigates", async () => {
      await confirmStartWorkout(setLoading, onStart);

      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      const newBtn = buttons.find(
        (b: { text: string }) => b.text === "[t] Start New",
      );

      const doStartPromise = newBtn.onPress();
      jest.advanceTimersByTime(50);
      await doStartPromise;

      expect(onStart).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith("/(app)/(workout)");
    });
  });
});
