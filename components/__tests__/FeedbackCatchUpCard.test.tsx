import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import FeedbackCatchUpCard from "../FeedbackCatchUpCard";
import ExerciseFeedbackCard from "../ExerciseFeedbackCard";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";

const mockMutate = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("@/hooks/useExerciseFeedbackMutation", () => ({
  useExerciseFeedbackMutation: () => ({ mutate: mockMutate }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111",
      cardSecondary: "#222",
      accent: "#0f0",
      accentBorder: "#0f04",
      surfaceHighlight: "#333",
      onAccent: "#000",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

const prompt = (id: number, name: string): FeedbackPrompt => ({
  userWorkoutExerciseId: id,
  exerciseName: name,
  performanceRatio: 1.0,
  exerciseContext: {
    exerciseId: id * 10,
    trackingType: "weight",
    equipment: "barbell",
    currentSets: [],
    recentWorkingWeight: 80,
  },
});

beforeEach(() => {
  mockMutate.mockClear();
  mockInvalidate.mockClear();
});

describe("FeedbackCatchUpCard", () => {
  it("writes the same payload as the live card", () => {
    const squat = prompt(1, "Squat");
    const live = jest.fn();
    const liveCard = render(
      <ExerciseFeedbackCard prompt={squat} onSubmit={live} />,
    );
    fireEvent.press(liveCard.getByText("About right"));
    liveCard.unmount();

    const { getByText } = render(<FeedbackCatchUpCard prompts={[squat]} />);
    fireEvent.press(getByText("About right"));

    expect(mockMutate).toHaveBeenCalledWith(
      {
        feedback: live.mock.calls[0][0],
        exerciseContext: squat.exerciseContext,
      },
      expect.anything(),
    );
    // The finished session was already cleared; nothing is written back.
    expect(useActiveWorkoutStore.getState().activeWorkout).toBeNull();
    expect(useActiveWorkoutStore.getState().feedbackSubmittedUweIds).toEqual(
      [],
    );
  });

  it("lists one row per exercise and drops a row once answered", () => {
    const { getByText, getAllByText, queryByText } = render(
      <FeedbackCatchUpCard prompts={[prompt(1, "Squat"), prompt(2, "Row")]} />,
    );
    expect(getByText("Help tune your next session")).toBeTruthy();
    expect(getByText("Squat: how did that feel?")).toBeTruthy();
    expect(getByText("Row: how did that feel?")).toBeTruthy();

    // Rows render in order; answer the first.
    fireEvent.press(getAllByText("Easy")[0]);

    expect(queryByText("Squat: how did that feel?")).toBeNull();
    expect(getByText("Row: how did that feel?")).toBeTruthy();
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
});
