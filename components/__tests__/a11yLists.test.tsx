import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ExerciseItem from "../ExerciseItem";
import ExerciseSortChips from "../ExerciseSortChips";
import { TimeRangeSelector } from "../stats/TimeRangeSelector";
import type { Exercise } from "@/utils/database";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: any) => <View {...props} /> };
});
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));

const exercise = {
  exercise_id: 3,
  name: "Bench Press",
  body_part: "chest",
  equipment: "barbell",
  image: null,
} as unknown as Exercise;

describe("ExerciseItem", () => {
  it("is a button named after the exercise, body part and equipment", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ExerciseItem
        item={exercise}
        selected={false}
        onSelect={jest.fn()}
        onPress={onPress}
      />,
    );
    fireEvent.press(
      getByRole("button", { name: "Bench Press, chest, barbell" }),
    );
    expect(onPress).toHaveBeenCalledWith(exercise);
  });

  it("exposes a labelled checkbox with its checked state", () => {
    const onSelect = jest.fn();
    const { getByRole } = render(
      <ExerciseItem
        item={exercise}
        selected
        onSelect={onSelect}
        onPress={jest.fn()}
      />,
    );
    const checkbox = getByRole("checkbox", { name: "Select Bench Press" });
    expect(checkbox).toBeChecked();
    fireEvent.press(checkbox);
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});

describe("ExerciseSortChips", () => {
  it("marks only the active chip as selected", () => {
    const { getByRole } = render(
      <ExerciseSortChips sortMode="recent" onSortModeChange={jest.fn()} />,
    );
    expect(getByRole("button", { name: "Recent" })).toBeSelected();
    expect(getByRole("button", { name: "Default" })).not.toBeSelected();
  });
});

describe("TimeRangeSelector", () => {
  it("speaks full range names and marks the selected one", () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <TimeRangeSelector selected="90" onChange={onChange} />,
    );
    expect(getByRole("button", { name: "Last 90 days" })).toBeSelected();
    const year = getByRole("button", { name: "Last year" });
    expect(year).not.toBeSelected();
    fireEvent.press(year);
    expect(onChange).toHaveBeenCalledWith("365");
  });
});
