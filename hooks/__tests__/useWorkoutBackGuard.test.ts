import { renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useWorkoutBackGuard } from "../useWorkoutBackGuard";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));

let mockBeforeRemove: ((e: any) => void) | undefined;
const mockDispatch = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({
    addListener: (event: string, cb: (e: any) => void) => {
      if (event === "beforeRemove") mockBeforeRemove = cb;
      return () => {
        mockBeforeRemove = undefined;
      };
    },
    dispatch: mockDispatch,
  }),
}));

const makeEvent = () => ({
  preventDefault: jest.fn(),
  data: { action: { type: "GO_BACK" } },
});

const setInProgress = (inProgress: boolean) =>
  useActiveWorkoutStore.setState({
    workout: inProgress ? ({ name: "Push", exercises: [] } as any) : null,
    activeWorkout: inProgress
      ? ({ planId: 1, workoutId: 2, name: "Push" } as any)
      : null,
  });

describe("useWorkoutBackGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks before leaving a workout in progress", () => {
    setInProgress(true);
    renderHook(() => useWorkoutBackGuard({ current: false }));

    const e = makeEvent();
    mockBeforeRemove!(e);

    expect(e.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Leave workout?",
      "Your progress is saved. You can resume from the home screen.",
      expect.any(Array),
    );
  });

  it("continues the navigation when the user chooses Leave", () => {
    setInProgress(true);
    renderHook(() => useWorkoutBackGuard({ current: false }));

    const e = makeEvent();
    mockBeforeRemove!(e);
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(buttons.map((b: any) => b.text)).toEqual(["Stay", "Leave"]);
    buttons.find((b: any) => b.text === "Leave").onPress();

    expect(mockDispatch).toHaveBeenCalledWith(e.data.action);
  });

  it("does not prompt when no workout is in progress", () => {
    setInProgress(false);
    renderHook(() => useWorkoutBackGuard({ current: false }));

    const e = makeEvent();
    mockBeforeRemove!(e);

    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("does not prompt when leaving through Finish or Cancel", () => {
    setInProgress(true);
    renderHook(() => useWorkoutBackGuard({ current: true }));

    const e = makeEvent();
    mockBeforeRemove!(e);

    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
