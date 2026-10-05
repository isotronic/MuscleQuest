import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import EditCompletedWorkoutScreen from "../(tabs)/(stats)/edit-history";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

const mockMutate = jest.fn();

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
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
  const { Pressable } = require("react-native");
  return {
    AppIconButton: ({ accessibilityLabel, onPress, onPressIn }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress ?? onPressIn}
      />
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
  set_duration: null,
  ...values,
});

const workout = {
  id: 42,
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
  beforeEach(() => mockMutate.mockClear());

  it("sends the loaded values as the original, untouched", () => {
    const { getAllByLabelText, getByLabelText } = render(
      <EditCompletedWorkoutScreen />,
    );
    fireEvent.changeText(getAllByLabelText("Reps, set 1")[0], "10");

    const { original, edited } = save(getByLabelText);
    expect(original).toEqual(workout.exercises);
    expect(edited[0].sets[0].reps).toBe(10);
    expect(edited[0].sets[1]).toEqual(workout.exercises[0].sets[1]);
    expect(edited[1]).toEqual(workout.exercises[1]);
  });

  it("reads a comma-typed weight as a decimal", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    fireEvent.changeText(getByLabelText("Weight in kg, set 1"), "62,5");

    expect(save(getByLabelText).edited[0].sets[0].weight).toBe(62.5);
  });

  it("shows stored decimals with the device separator", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    expect(getByLabelText("Distance in m, set 1").props.value).toBe("2,5");
  });

  it("reads a comma-typed distance as a decimal", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    fireEvent.changeText(getByLabelText("Distance in m, set 1"), "3,75");

    expect(save(getByLabelText).edited[1].sets[0].distance).toBe(3.75);
  });

  it("keeps a missing weight missing", () => {
    const { getByLabelText } = render(<EditCompletedWorkoutScreen />);
    expect(getByLabelText("Weight in kg, set 2").props.value).toBe("");
    expect(save(getByLabelText).edited[0].sets[1].weight).toBeNull();
  });

  it("keeps only digits in reps", () => {
    const { getAllByLabelText, getByLabelText } = render(
      <EditCompletedWorkoutScreen />,
    );
    fireEvent.changeText(getAllByLabelText("Reps, set 1")[0], "1,2");

    expect(save(getByLabelText).edited[0].sets[0].reps).toBe(12);
  });
});
