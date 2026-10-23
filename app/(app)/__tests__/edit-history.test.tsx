import React from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import EditCompletedWorkoutScreen from "../(tabs)/(stats)/edit-history";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { WorkoutHistoryEditor } from "@/components/history/WorkoutHistoryEditor";

const mockMutate = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 48, left: 0, right: 0 }),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { locale: "en" } }),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "de", decimalSeparator: "," }],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
      danger: "#f00",
      card: "#eee",
      border: "#ccc",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});
jest.mock("@/components/ThemedView", () => {
  const { View } = require("react-native");
  return { ThemedView: (props: any) => <View {...props} /> };
});
jest.mock("react-native-paper", () => {
  const { View, Text, Pressable } = require("react-native");
  const Menu = ({ visible, anchor, children }: any) => (
    <View>
      {anchor}
      {visible ? children : null}
    </View>
  );
  const MenuItem = ({ title, onPress }: any) => (
    <Pressable accessibilityRole="menuitem" onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );
  Menu.Item = MenuItem;
  return { ActivityIndicator: () => null, Divider: () => null, Menu };
});
jest.mock("@/components/history/DatePickerModal", () => ({
  DatePickerModal: () => null,
}));
jest.mock("expo-router", () => {
  const { View } = require("react-native");
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => ({ id: "42" }),
    useFocusEffect: jest.fn(),
    Stack: {
      Screen: ({ options }: any) => <View>{options.headerRight()}</View>,
    },
  };
});
jest.mock("@/components/ui", () => {
  const { Pressable, Text } = require("react-native");
  return {
    AppIconButton: ({ accessibilityLabel, onPress, onPressIn }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress ?? onPressIn}
      />
    ),
    AppButton: ({ children, onPress, accessibilityLabel }: any) => (
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
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({
    data: { weightUnit: "kg", distanceUnit: "m" },
    isLoading: false,
    error: null,
  }),
}));
jest.mock("@/hooks/useEditCompletedWorkoutMutation", () => ({
  useEditCompletedWorkoutMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const set = (
  set_id: number,
  set_number: number,
  values: Partial<CompletedWorkout["exercises"][0]["sets"][0]> = {},
) => ({
  set_id,
  set_number,
  weight: 60,
  reps: 8,
  time: null,
  distance: null,
  is_warmup: false,
  is_drop_set: false,
  is_to_failure: false,
  set_duration: null,
  ...values,
});

const FINISHED = new Date(2026, 8, 30, 18, 15, 42);

const workout = {
  id: 42,
  date_completed: FINISHED.toISOString(),
  duration: 3725,
  notes: null,
  exercises: [
    {
      completed_exercise_id: 1,
      exercise_id: 100,
      exercise_name: "Bench Press",
      exercise_tracking_type: "weight",
      sets: [set(11, 1), set(12, 2, { weight: null })],
    },
    {
      completed_exercise_id: 2,
      exercise_id: 200,
      exercise_name: "Row",
      exercise_tracking_type: "distance",
      sets: [set(21, 1, { weight: null, reps: null, distance: 2.5 })],
    },
  ],
};
const mockWorkout = workout;
jest.mock("@/hooks/useCompletedWorkoutByIdQuery", () => ({
  useCompletedWorkoutByIdQuery: () => ({
    data: mockWorkout,
    isLoading: false,
    error: null,
  }),
}));

const save = (getByLabelText: (label: string) => any) => {
  fireEvent.press(getByLabelText("Save changes"));
  return mockMutate.mock.calls.at(-1)[0];
};

describe("EditCompletedWorkoutScreen", () => {
  beforeEach(() => {
    mockMutate.mockClear();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("sends the loaded values as the original, untouched", () => {
    const { getAllByLabelText, getByLabelText } = render(
      <EditCompletedWorkoutScreen />,
    );
    fireEvent.changeText(getAllByLabelText("Reps, set 1")[0], "10");

    const { original, edited } = save(getByLabelText);
    expect(original.exercises).toEqual(workout.exercises);
    expect(edited.exercises[0].sets[0].reps).toBe(10);
    expect(edited.exercises[0].sets[1]).toEqual(workout.exercises[0].sets[1]);
    expect(edited.exercises[1]).toEqual(workout.exercises[1]);
  });

  it("keeps the stored instant and duration when they are not touched", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    const { original, edited } = save(getByLabelText);
    expect(edited.completedAt).toBe(original.completedAt);
    expect(edited.durationSeconds).toBe(3725);
  });

  it("reads a comma-typed weight as a decimal", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    fireEvent.changeText(getByLabelText("Weight in kg, set 1"), "62,5");

    expect(save(getByLabelText).edited.exercises[0].sets[0].weight).toBe(62.5);
  });

  it("shows stored decimals with the device separator", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    expect(getByLabelText("Distance in m, set 1").props.value).toBe("2,5");
  });

  it("keeps a missing weight missing", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    expect(getByLabelText("Weight in kg, set 2").props.value).toBe("");
    expect(save(getByLabelText).edited.exercises[0].sets[1].weight).toBeNull();
  });

  it("adds a set prefilled from the last one", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    fireEvent.press(getByLabelText("Add set to Row"));

    const added = save(getByLabelText).edited.exercises[1].sets[1];
    expect(added).toMatchObject({ set_number: 2, distance: 2.5 });
    expect(added.set_id).toBeLessThan(0);
  });

  it("removes a set and renumbers the rest", () => {
    const { getAllByLabelText, getByLabelText } = render(
      <EditCompletedWorkoutScreen />,
    );
    fireEvent.press(getAllByLabelText("Remove set 1")[0]);

    const sets = save(getByLabelText).edited.exercises[0].sets;
    expect(sets).toEqual([
      expect.objectContaining({ set_id: 12, set_number: 1 }),
    ]);
  });

  it("marks a set as a warm-up from its set type menu", () => {
    const { getAllByLabelText, getByText, getByLabelText } = render(
      <EditCompletedWorkoutScreen />,
    );
    fireEvent.press(getAllByLabelText("Set type, set 1")[0]);
    fireEvent.press(getByText("Warm-up"));

    expect(save(getByLabelText).edited.exercises[0].sets[0].is_warmup).toBe(
      true,
    );
  });

  it("drops an exercise whose sets were all removed", () => {
    const { getAllByLabelText, getByLabelText } = render(
      <EditCompletedWorkoutScreen />,
    );
    fireEvent.press(getAllByLabelText("Remove set 1")[1]);

    expect(save(getByLabelText).edited.exercises).toHaveLength(1);
  });

  it("does not save a new set left empty", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    fireEvent.press(getByLabelText("Add set to Row"));
    fireEvent.changeText(getByLabelText("Distance in m, set 2"), "");

    expect(save(getByLabelText).edited.exercises[1].sets).toHaveLength(1);
  });

  it("refuses a duration whose minutes are over 59", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    fireEvent.changeText(getByLabelText("Duration, minutes"), "75");
    fireEvent.press(getByLabelText("Save changes"));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("refuses a finish time that has not happened yet", () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 30, 20, 0) });
    try {
      const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
      fireEvent.changeText(getByLabelText("Finished at, hours"), "23");
      fireEvent.press(getByLabelText("Save changes"));
      expect(mockMutate).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("WorkoutHistoryEditor bottom inset", () => {
  const initial = {
    exercises: [],
    completedAt: new Date(2026, 0, 5, 18, 0),
    durationSeconds: 0,
    notes: null,
  };
  const bottomPadding = (bottomInset?: boolean) => {
    const { UNSAFE_getByType } = render(
      <WorkoutHistoryEditor
        initial={initial}
        weightUnit="kg"
        distanceUnit="m"
        onSave={() => {}}
        saving={false}
        bottomInset={bottomInset}
      />,
    );
    return StyleSheet.flatten(
      UNSAFE_getByType(ScrollView).props.contentContainerStyle,
    ).paddingBottom;
  };

  it("keeps its end padding where a tab bar sits below it", () => {
    expect(bottomPadding()).toBe(48);
  });

  it("adds the navigation bar inset when asked", () => {
    expect(bottomPadding(true)).toBe(96);
  });
});
