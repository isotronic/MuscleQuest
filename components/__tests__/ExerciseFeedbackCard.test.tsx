import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ExerciseFeedbackCard from "../ExerciseFeedbackCard";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";

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

const prompt = (performanceRatio: number): FeedbackPrompt => ({
  userWorkoutExerciseId: 5,
  exerciseName: "Bench press",
  performanceRatio,
  exerciseContext: {
    exerciseId: 50,
    trackingType: "weight",
    equipment: "barbell",
    currentSets: [],
    recentWorkingWeight: 100,
  },
});

describe("ExerciseFeedbackCard", () => {
  it("at or above target, one tap submits the effort with no pain", () => {
    const onSubmit = jest.fn();
    const { getByText, queryByText } = render(
      <ExerciseFeedbackCard prompt={prompt(1.0)} onSubmit={onSubmit} />,
    );
    expect(getByText("Bench press: how did that feel?")).toBeTruthy();
    // Pain options stay folded away until asked for.
    expect(queryByText("No pain")).toBeNull();

    fireEvent.press(getByText("Easy"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        userWorkoutExerciseId: 5,
        effortRating: "easy",
        painFlag: "none",
        performanceRatio: 1.0,
      }),
    );
  });

  it("Any pain? adds the pain choice to the effort tap", () => {
    const onSubmit = jest.fn();
    const { getByText, getByLabelText } = render(
      <ExerciseFeedbackCard prompt={prompt(1.2)} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByText("Any pain?"));
    fireEvent.press(getByText("Pain"));
    fireEvent.changeText(getByLabelText("Where did you feel it?"), "knee");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.press(getByText("Hard"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        effortRating: "hard",
        painFlag: "pain",
        notes: "knee",
      }),
    );
  });

  it("More lets About right hold the load", () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <ExerciseFeedbackCard prompt={prompt(1.0)} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByText("More"));
    fireEvent.press(getByText("Stay here"));
    fireEvent.press(getByText("About right"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        effortRating: "moderate",
        progressionIntent: "hold",
      }),
    );
  });

  it("below target asks only about pain and submits effort 'hard'", () => {
    const onSubmit = jest.fn();
    const { getByText, queryByText } = render(
      <ExerciseFeedbackCard prompt={prompt(0.8)} onSubmit={onSubmit} />,
    );
    expect(getByText("Bench press: any pain or discomfort?")).toBeTruthy();
    expect(queryByText("Easy")).toBeNull();
    expect(queryByText("About right")).toBeNull();

    fireEvent.press(getByText("No"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        effortRating: "hard",
        painFlag: "none",
        performanceRatio: 0.8,
      }),
    );
  });

  it("below target, Couldn't finish submits 'failed'", () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <ExerciseFeedbackCard prompt={prompt(0.6)} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByText("Couldn't finish"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ effortRating: "failed", painFlag: "none" }),
    );
  });

  it("Skip is offered only when the card can be skipped", () => {
    const onSkip = jest.fn();
    const { getByLabelText, rerender, queryByLabelText } = render(
      <ExerciseFeedbackCard
        prompt={prompt(1)}
        onSubmit={jest.fn()}
        onSkip={onSkip}
      />,
    );
    fireEvent.press(getByLabelText("Skip feedback for Bench press"));
    expect(onSkip).toHaveBeenCalled();

    rerender(<ExerciseFeedbackCard prompt={prompt(1)} onSubmit={jest.fn()} />);
    expect(queryByLabelText("Skip feedback for Bench press")).toBeNull();
  });

  it("a quick second tap does not submit twice", () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <ExerciseFeedbackCard prompt={prompt(1.0)} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByText("Easy"));
    fireEvent.press(getByText("Hard"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("a pain choice folded away again is not sent", () => {
    const onSubmit = jest.fn();
    const { getByText } = render(
      <ExerciseFeedbackCard prompt={prompt(1.0)} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByText("Any pain?"));
    fireEvent.press(getByText("Pain"));
    fireEvent.press(getByText("Any pain?"));
    fireEvent.press(getByText("Easy"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ painFlag: "none" }),
    );
  });
});
