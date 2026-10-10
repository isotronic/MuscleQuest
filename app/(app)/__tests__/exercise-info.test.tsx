import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ExerciseInfoScreen from "../exercise-info";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray) => ({ id: s.join("") }),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (m: { id: string }) => m.id }),
}));

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
// Renders the header buttons so the pin toggle can be pressed.
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  router: { push: (...args: unknown[]) => mockPush(...args) },
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => any } }) =>
      options.headerRight ? options.headerRight() : null,
  },
}));

jest.mock("@/components/exercise/ExerciseProgressTab", () => {
  const { Text } = require("react-native");
  return { ExerciseProgressTab: () => <Text>progress-tab</Text> };
});
jest.mock("@/components/Cues", () => ({ Cues: () => null }));
jest.mock("@/components/ui", () => {
  const { Pressable, Text } = require("react-native");
  return {
    AppIcon: () => null,
    AppImage: () => null,
    AppIconButton: ({ accessibilityLabel, onPress, onPressIn }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress ?? onPressIn}
      >
        <Text>{accessibilityLabel}</Text>
      </Pressable>
    ),
  };
});

jest.mock("@/hooks/useExerciseInfoQuery", () => ({
  useExerciseInfoQuery: () => ({
    data: {
      exercise_id: 5,
      app_exercise_id: 12,
      name: "Bench Press",
      target_muscle: "pectorals",
      equipment: "barbell",
      secondary_muscles: "[]",
      description: "[]",
      favorite: 0,
    },
    isLoading: false,
    error: null,
  }),
}));
jest.mock("@/hooks/useAnimatedImageQuery", () => ({
  useAnimatedImageQuery: () => ({ data: null, isLoading: false }),
}));
jest.mock("@/hooks/useToggleFavoriteExerciseMutation", () => ({
  useToggleFavoriteExerciseMutation: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { weightUnit: "kg" } }),
}));

let mockSections: any[] = [];
jest.mock("@/hooks/useExerciseHistoryQuery", () => ({
  useExerciseHistoryQuery: () => ({
    data: { sections: mockSections, trackingType: "weight", chartSets: [] },
    isLoading: false,
    isError: false,
  }),
}));

let mockPinned = false;
const mockSetPinned = jest.fn();
jest.mock("@/hooks/useIsExercisePinnedQuery", () => ({
  useIsExercisePinnedQuery: () => ({ data: mockPinned }),
}));
jest.mock("@/hooks/usePinExerciseMutation", () => ({
  usePinExerciseMutation: () => ({ mutate: mockSetPinned, isPending: false }),
}));

const session = {
  date: "Oct 1, 2026",
  workout_name: "Push",
  workout_id: 42,
  data: [
    {
      id: 1,
      set_number: 1,
      weight: 100,
      reps: 5,
      time: null,
      distance: null,
      hist_bw_kg: null,
      is_warmup: false,
      is_pr: true,
      note: null,
    },
  ],
};

describe("ExerciseInfoScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { exercise_id: "5" };
    mockSections = [session];
    mockPinned = false;
  });

  it("opens on Progress when the exercise has history", () => {
    const { getByText, queryByText } = render(<ExerciseInfoScreen />);
    expect(getByText("progress-tab")).toBeTruthy();
    expect(queryByText("Equipment: barbell")).toBeNull();
  });

  it("opens on About when the exercise has no history", () => {
    mockSections = [];
    const { getByText, queryByText } = render(<ExerciseInfoScreen />);
    expect(queryByText("progress-tab")).toBeNull();
    expect(getByText("Bench Press")).toBeTruthy();
  });

  it("honours the tab param", () => {
    mockParams = { exercise_id: "5", tab: "history" };
    const { getByText, queryByText } = render(<ExerciseInfoScreen />);
    expect(queryByText("progress-tab")).toBeNull();
    expect(getByText("100 kg × 5")).toBeTruthy();
  });

  it("ignores an unknown tab param", () => {
    mockParams = { exercise_id: "5", tab: "nope" };
    const { getByText } = render(<ExerciseInfoScreen />);
    expect(getByText("progress-tab")).toBeTruthy();
  });

  it("switches tabs and opens a session's workout from History", () => {
    const { getByText, getByRole } = render(<ExerciseInfoScreen />);
    fireEvent.press(getByRole("tab", { name: "History" }));
    fireEvent.press(getByText("Oct 1, 2026"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(workout)/workout-summary",
      params: { completedWorkoutId: "42" },
    });
  });

  it("pins and unpins from the header", () => {
    const view = render(<ExerciseInfoScreen />);
    fireEvent.press(view.getByRole("button", { name: "Pin to Stats" }));
    expect(mockSetPinned).toHaveBeenCalledWith({
      exerciseId: 5,
      pinned: true,
    });

    mockPinned = true;
    view.rerender(<ExerciseInfoScreen />);
    fireEvent.press(view.getByRole("button", { name: "Unpin from Stats" }));
    expect(mockSetPinned).toHaveBeenLastCalledWith({
      exerciseId: 5,
      pinned: false,
    });
  });
});
