import { renderHook, act } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useRestTimerResync } from "../useRestTimerResync";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});

let appStateHandler: ((s: string) => void) | undefined;

describe("useRestTimerResync", () => {
  beforeEach(() => {
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, handler: any) => {
        appStateHandler = handler;
        return { remove: jest.fn() } as any;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useActiveWorkoutStore.setState({ timerRunning: false, timerExpiry: null });
  });

  it("restarts the countdown from the stored expiry when the app becomes active", () => {
    const expiry = new Date(Date.now() + 45_000);
    useActiveWorkoutStore.setState({ timerRunning: true, timerExpiry: expiry });
    const restart = jest.fn();
    renderHook(() => useRestTimerResync(restart));
    restart.mockClear();

    act(() => appStateHandler?.("active"));

    expect(restart).toHaveBeenCalledWith(expiry);
  });

  it("stops a timer that ran out while the app was in the background", () => {
    useActiveWorkoutStore.setState({
      timerRunning: true,
      timerExpiry: new Date(Date.now() - 5_000),
    });
    const restart = jest.fn();
    renderHook(() => useRestTimerResync(restart));

    act(() => appStateHandler?.("active"));

    expect(useActiveWorkoutStore.getState().timerRunning).toBe(false);
    expect(restart).not.toHaveBeenCalled();
  });

  it("resyncs when the screen regains focus", () => {
    const expiry = new Date(Date.now() + 30_000);
    useActiveWorkoutStore.setState({ timerRunning: true, timerExpiry: expiry });
    const restart = jest.fn();

    renderHook(() => useRestTimerResync(restart));

    expect(restart).toHaveBeenCalledWith(expiry);
  });

  it("does nothing when no rest timer is running", () => {
    const restart = jest.fn();
    renderHook(() => useRestTimerResync(restart));

    act(() => appStateHandler?.("active"));

    expect(restart).not.toHaveBeenCalled();
  });
});
