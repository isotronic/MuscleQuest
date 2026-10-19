import { renderHook, act } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useRestTimerControls } from "../useRestTimerControls";

let mockOnExpire: (() => void) | undefined;
jest.mock("react-timer-hook", () => ({
  useTimer: (options: { onExpire: () => void }) => {
    mockOnExpire = options.onExpire;
    return { seconds: 0, minutes: 0, restart: jest.fn(), pause: jest.fn() };
  },
}));
// Focused, then blurred at once: the screen is under another one.
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useFocusEffect: (cb: () => () => void) =>
      useEffect(() => {
        cb()();
      }, [cb]),
  };
});
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (v: number) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  withTiming: (v: number) => v,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({
    data: { restTimerSound: "true", restTimerVibration: "true" },
  }),
}));
jest.mock("@/hooks/useRestTimerResync", () => ({
  useRestTimerResync: jest.fn(),
}));
jest.mock("@/hooks/usePauseWhenRestEndsEarly", () => ({
  usePauseWhenRestEndsEarly: jest.fn(),
}));
const mockPlaySound = jest.fn();
const mockVibrate = jest.fn();
jest.mock("@/store/soundStore", () => ({
  useSoundStore: () => ({
    playSound: mockPlaySound,
    triggerVibration: mockVibrate,
  }),
}));
const mockRestEndedInApp = jest.fn();
jest.mock("@/utils/restNotification", () => ({
  cancelRestNotifications: jest.fn(),
  restEndedInApp: () => mockRestEndedInApp(),
  scheduleRestNotificationWithCancellation: jest.fn(),
}));

describe("useRestTimerControls", () => {
  afterEach(() => {
    useActiveWorkoutStore.setState({
      timerRunning: false,
      timerExpiry: null,
      currentSetStartedAt: null,
    });
  });

  it("starts timing the next set when a rest ends off screen, without the cue", () => {
    useActiveWorkoutStore.setState({
      timerRunning: true,
      timerExpiry: new Date(Date.now() + 1_000),
      currentSetStartedAt: null,
    });
    renderHook(() => useRestTimerControls());

    act(() => mockOnExpire?.());

    const store = useActiveWorkoutStore.getState();
    expect(store.timerRunning).toBe(false);
    expect(store.currentSetStartedAt).not.toBeNull();
    expect(mockPlaySound).not.toHaveBeenCalled();
    expect(mockVibrate).not.toHaveBeenCalled();
    // Off screen, the notification is still the alert.
    expect(mockRestEndedInApp).not.toHaveBeenCalled();
  });

  it("keeps a set start that is already set", () => {
    const startedAt = new Date(Date.now() - 30_000);
    useActiveWorkoutStore.setState({
      timerRunning: true,
      currentSetStartedAt: startedAt,
    });
    renderHook(() => useRestTimerControls());

    act(() => mockOnExpire?.());

    expect(useActiveWorkoutStore.getState().currentSetStartedAt).toEqual(
      startedAt,
    );
  });
});
