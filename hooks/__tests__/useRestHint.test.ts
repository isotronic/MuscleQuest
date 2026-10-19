import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useRestHintStore } from "@/store/restHintStore";
import { useRestHint } from "../useRestHint";
import {
  exactAlarmsAllowed,
  scheduleRestNotificationWithCancellation,
} from "@/utils/restNotification";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/modules/exact-alarm", () => ({
  openExactAlarmSettings: jest.fn(),
}));
jest.mock("@/utils/restNotification", () => ({
  exactAlarmsAllowed: jest.fn(() => false),
  scheduleRestNotificationWithCancellation: jest.fn(),
}));

describe("useRestHint", () => {
  let appStateListener: ((state: string) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = undefined;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appStateListener = listener as (state: string) => void;
        return { remove: jest.fn() } as any;
      });
    useActiveWorkoutStore.setState({
      timerRunning: true,
      timerExpiry: new Date(Date.now() + 60_000),
    });
  });

  afterEach(() => {
    act(() => {
      useRestHintStore.getState().clearRestHints();
      useActiveWorkoutStore.setState({
        timerRunning: false,
        timerExpiry: null,
      });
    });
  });

  it("offers to allow alarms when a rest's alert would be late", () => {
    const { result } = renderHook(() => useRestHint());
    expect(result.current.hint).toBeUndefined();

    act(() =>
      useRestHintStore
        .getState()
        .showRestHints({ showPermissionHint: false, showExactAlarmHint: true }),
    );

    expect(result.current.hint).toContain("may arrive late");
    expect(result.current.hintAction?.label).toBe("Allow alarms");
  });

  it("clears the hint when the rest ends", () => {
    const { result } = renderHook(() => useRestHint());
    act(() =>
      useRestHintStore
        .getState()
        .showRestHints({ showPermissionHint: false, showExactAlarmHint: true }),
    );

    act(() => useActiveWorkoutStore.setState({ timerRunning: false }));

    expect(result.current.hint).toBeUndefined();
  });

  it("reschedules the running rest once alarms are allowed", () => {
    const { result } = renderHook(() => useRestHint());
    act(() =>
      useRestHintStore
        .getState()
        .showRestHints({ showPermissionHint: false, showExactAlarmHint: true }),
    );
    (exactAlarmsAllowed as jest.Mock).mockReturnValue(true);

    act(() => appStateListener?.("active"));

    expect(scheduleRestNotificationWithCancellation).toHaveBeenCalledTimes(1);
    expect(result.current.hint).toBeUndefined();
  });
});
