import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Vibration } from "react-native";
import { router } from "expo-router";
import ExerciseListScreen from "../exercise-list";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { listRows } from "@/utils/listLogging";

jest.mock(
  "react-native/Libraries/Components/Keyboard/KeyboardAvoidingView",
  () => {
    const { View } = jest.requireActual("react-native");
    return { __esModule: true, default: View };
  },
);

const mockParams = { exerciseIndex: "0" };
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  Stack: { Screen: () => null },
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce(
      (acc, part, i) => acc + part + (i < v.length ? String(v[i]) : ""),
      "",
    ),
  plural: (n: number, { one, other }: any) =>
    (n === 1 ? one : other).replace("#", String(n)),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => "#888" }),
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/ThemedView", () => {
  const { View } = require("react-native");
  return { ThemedView: (props: any) => <View {...props} /> };
});
jest.mock("@/components/ui/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/ui/AppIconButton", () => {
  const { Pressable } = require("react-native");
  return {
    AppIconButton: ({ onPress, disabled, ...props }: any) => (
      <Pressable onPress={disabled ? undefined : onPress} {...props} />
    ),
  };
});
const mockFocus = jest.fn();
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = require("react-native");
  const Menu = ({ visible, anchor, children }: any) => (
    <View>
      {anchor}
      {visible ? children : null}
    </View>
  );
  Menu.Item = function MenuItem({ title, onPress }: any) {
    return (
      <Pressable accessibilityRole="menuitem" onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  };
  return {
    Menu,
    Button: ({ children, onPress, accessibilityLabel }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/WorkoutTimer", () => () => null);
jest.mock("@/components/Cues", () => ({ Cues: () => null }));
jest.mock("@/components/ui", () => {
  const { Pressable } = require("react-native");
  return {
    AppIcon: () => null,
    AppIconButton: ({ onPress, ...props }: any) => (
      <Pressable onPress={onPress} {...props} />
    ),
  };
});
jest.mock("@/components/NoteSheet", () => ({ NoteSheet: () => null }));
jest.mock("@/components/SessionSetOptionsModal", () => ({
  SessionSetOptionsModal: () => null,
}));
jest.mock("@/components/PlateCalculatorModal", () => ({
  PlateCalculatorModal: () => null,
}));
const mockShowSnackbar = jest.fn();
jest.mock("@/store/snackbarStore", () => ({
  showSnackbar: (...args: unknown[]) => mockShowSnackbar(...args),
}));
jest.mock("@/hooks/useAnimatedImageQuery", () => ({
  useAnimatedImageQuery: () => ({ data: null, error: null, isLoading: false }),
}));
jest.mock("@/components/workout/ExerciseSessionHeader", () => {
  const { Text } = require("react-native");
  return {
    ExerciseSessionHeader: ({ exerciseName, repsMin, repsMax }: any) => (
      <Text>{`${exerciseName} header ${repsMin}-${repsMax}`}</Text>
    ),
  };
});
jest.mock("@/components/TimeInput", () => {
  const { useImperativeHandle } = jest.requireActual("react");
  return {
    TimeInput: ({ ref, accessibilityLabel }: any) => {
      useImperativeHandle(ref, () => ({
        focus: () => mockFocus(accessibilityLabel),
        blur: jest.fn(),
      }));
      return null;
    },
  };
});
jest.mock("@/components/RestTimerOverlay", () => () => null);
jest.mock("@/components/workout/QueuedFeedbackCard", () => ({
  QueuedFeedbackCard: () => null,
  useHasQueuedFeedback: () => false,
}));
jest.mock("@/hooks/useRestTimerControls", () => ({
  useRestTimerControls: () => ({
    timerRunning: false,
    minutes: 0,
    seconds: 0,
    increment: 15,
    buttonSize: 40,
    animStyle: {},
    adjust: jest.fn(),
    skip: jest.fn(),
  }),
}));
jest.mock("@/hooks/useKeepScreenOn", () => () => {});
jest.mock("@/hooks/useWorkoutImmersiveMode", () => ({
  useWorkoutImmersiveMode: () => {},
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { weightUnit: "kg", distanceUnit: "m" } }),
}));
jest.mock("@/hooks/useProgressionSettingsQuery", () => ({
  useProgressionSettingsQuery: () => ({ enabled: false }),
}));
jest.mock("@/hooks/useDeloadWeekQuery", () => ({
  useDeloadWeekQuery: () => ({ isCurrentWeekDeload: false }),
}));
jest.mock("@/hooks/useSessionPRs", () => ({
  useSessionPRs: () => ({ prs: {}, prsWithSetCompleted: () => ({}) }),
}));
jest.mock("@/utils/restNotification", () => ({
  cancelRestNotifications: jest.fn(() => Promise.resolve()),
  startRestNotification: jest.fn(() =>
    Promise.resolve({ showPermissionHint: false, showExactAlarmHint: false }),
  ),
}));

const set = () => ({
  repsMin: 8,
  repsMax: 12,
  restMinutes: 1,
  restSeconds: 0,
});
const exercise = (id: number, name: string, sets: number, extra = {}) => ({
  id: id * 10,
  exercise_id: id,
  name,
  tracking_type: "weight",
  sets: Array.from({ length: sets }, set),
  ...extra,
});

const start = (exercises: unknown[]) =>
  useActiveWorkoutStore
    .getState()
    .setWorkout({ id: 1, name: "Push", exercises } as any, 1, 1, "Push");
const store = () => useActiveWorkoutStore.getState();

describe("listRows", () => {
  it("lists one exercise's sets in order", () => {
    expect(listRows([3], [2])).toEqual([
      { exerciseIndex: 2, setIndex: 0 },
      { exerciseIndex: 2, setIndex: 1 },
      { exerciseIndex: 2, setIndex: 2 },
    ]);
  });

  it("interleaves a superset by round, uneven counts included", () => {
    expect(listRows([2, 1], [0, 1])).toEqual([
      { exerciseIndex: 0, setIndex: 0 },
      { exerciseIndex: 1, setIndex: 0 },
      { exerciseIndex: 0, setIndex: 1 },
    ]);
  });
});

describe("ExerciseListScreen", () => {
  beforeEach(() => {
    jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
    mockParams.exerciseIndex = "0";
    start([exercise(1, "Bench", 3)]);
  });

  it("starts timing the first set on opening, unless resting", () => {
    expect(store().currentSetStartedAt).toBeNull();
    render(<ExerciseListScreen />);
    expect(store().currentSetStartedAt).not.toBeNull();

    start([exercise(1, "Bench", 3)]);
    store().startTimer(new Date(Date.now() + 60_000));
    render(<ExerciseListScreen />);
    expect(store().currentSetStartedAt).toBeNull();
  });

  it("renders one row per set", () => {
    const screen = render(<ExerciseListScreen />);
    expect(screen.getAllByLabelText(/^Weight in kg, set \d$/)).toHaveLength(3);
    expect(screen.getAllByLabelText(/^Reps, set \d$/)).toHaveLength(3);
  });

  it("completes a row with the typed values and keeps the store in sync", () => {
    const screen = render(<ExerciseListScreen />);
    fireEvent.changeText(screen.getByLabelText("Weight in kg, set 1"), "60");
    fireEvent.changeText(screen.getByLabelText("Reps, set 1"), "8");
    act(() => {
      fireEvent.press(
        screen.getByLabelText("Set 1, 60 kilograms, 8 reps, not completed"),
      );
    });
    expect(store().completedSets[0]).toEqual({ 0: true });
    expect(store().weightAndReps[0][0]).toMatchObject({
      weight: "60",
      reps: "8",
    });
    // The next row is pre-filled from the one just done.
    expect(screen.getByLabelText("Weight in kg, set 2").props.value).toBe("60");
    expect(
      screen.getByLabelText("Set 1, 60 kilograms, 8 reps, completed"),
    ).toBeTruthy();
    expect(store().timerRunning).toBe(true);
  });

  it("moves focus to the next row's time field", () => {
    start([exercise(1, "Plank", 2, { tracking_type: "time" })]);
    store().updateWeightAndReps(0, 0, undefined, undefined, "45");
    const screen = render(<ExerciseListScreen />);
    act(() => {
      fireEvent.press(screen.getByLabelText(/^Set 1, .*not completed$/));
    });
    expect(store().completedSets[0]).toEqual({ 0: true });
    expect(mockFocus).toHaveBeenCalledWith("Time, set 2");
  });

  it("keeps a done set's check enabled, and pressing it again does nothing", () => {
    store().updateWeightAndReps(0, 0, "60", "8");
    store().completeSetAt(0, 0);
    const screen = render(<ExerciseListScreen />);
    const check = screen.getByLabelText(
      "Set 1, 60 kilograms, 8 reps, completed",
    );
    expect(check.props.disabled).toBeFalsy();
    fireEvent.press(check);
    expect(store().completedSets[0]).toEqual({ 0: true });
  });

  it("labels a set's flags", () => {
    store().updateSetType(0, 1, "isWarmup", true);
    store().setSetNote(0, 2, "Felt heavy");
    const screen = render(<ExerciseListScreen />);
    expect(screen.getByText("Warm-up")).toBeTruthy();
    expect(screen.getByLabelText("Set note: Felt heavy. Edit")).toBeTruthy();
  });

  it("changes a set from its menu, with undo for a delete", () => {
    const screen = render(<ExerciseListScreen />);
    fireEvent.press(screen.getByLabelText("Options for set 2"));
    fireEvent.press(screen.getByText("To Failure"));
    expect(store().workout!.exercises[0].sets[1].isToFailure).toBe(true);

    fireEvent.press(screen.getByLabelText("Options for set 3"));
    fireEvent.press(screen.getByText("Delete Set"));
    expect(store().workout!.exercises[0].sets).toHaveLength(2);
    const undo = mockShowSnackbar.mock.calls[0][1].action.onPress;
    act(() => undo());
    expect(store().workout!.exercises[0].sets).toHaveLength(3);

    fireEvent.press(screen.getByLabelText("Options for set 1"));
    fireEvent.press(screen.getByText("Add Set"));
    expect(store().workout!.exercises[0].sets).toHaveLength(4);
  });

  it("shows the exercise's header with its working set's targets", () => {
    const screen = render(<ExerciseListScreen />);
    expect(screen.getByText("Bench header 8-12")).toBeTruthy();
  });

  it("moves to the next exercise, then back to the overview from the last", () => {
    start([exercise(1, "Bench", 1), exercise(2, "Row", 1)]);
    const screen = render(<ExerciseListScreen />);
    expect(screen.queryByText("Previous")).toBeNull();
    fireEvent.press(screen.getByText("Next: Row"));
    expect(router.setParams).toHaveBeenCalledWith({ exerciseIndex: "1" });

    mockParams.exerciseIndex = "1";
    screen.rerender(<ExerciseListScreen />);
    expect(store().currentExerciseIndex).toBe(1);
    fireEvent.press(screen.getByLabelText("Previous exercise: Bench"));
    expect(router.setParams).toHaveBeenLastCalledWith({ exerciseIndex: "0" });
    fireEvent.press(screen.getByText("Back to overview"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a superset's rows interleaved by round", () => {
    start([
      exercise(1, "Curl", 2, { supersetGroupId: "s" }),
      exercise(2, "Push-down", 2, { supersetGroupId: "s" }),
    ]);
    mockParams.exerciseIndex = "1";
    const screen = render(<ExerciseListScreen />);
    const titles = screen
      .getAllByText(/^(Curl|Push-down)$/)
      .map((n) => n.props.children);
    expect(titles).toEqual(["Curl", "Push-down", "Curl", "Push-down"]);
  });
});
