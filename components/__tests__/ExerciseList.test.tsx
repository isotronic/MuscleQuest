import React from "react";
import { render } from "@testing-library/react-native";
import ExerciseList from "../ExerciseList";
import type { Exercise } from "@/utils/database";

const mockListProps: any[] = [];

jest.mock("@shopify/flash-list", () => ({
  FlashList: (props: any) => {
    mockListProps.push(props);
    return null;
  },
}));
jest.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
jest.mock("../ExerciseItem", () => "ExerciseItem");

const exercise = (id: number) =>
  ({ exercise_id: id, name: `Exercise ${id}` }) as Exercise;

const exercises = {
  favoriteExercises: [exercise(1)],
  activePlanExercises: [],
  otherExercises: [exercise(2), exercise(3)],
};
const noSelection: number[] = [];

const lastProps = () => mockListProps[mockListProps.length - 1];
const renderRow = (id: number) => {
  const row = lastProps().data.find(
    (entry: any) => entry.type === "exercise" && entry.item.exercise_id === id,
  );
  return lastProps().renderItem({ item: row });
};

beforeEach(() => {
  mockListProps.length = 0;
});

describe("ExerciseList", () => {
  it("keeps the same list data across an unrelated parent re-render", () => {
    const { rerender } = render(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );
    const first = lastProps().data;

    // New callback identities, as an inline arrow in the parent produces.
    rerender(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );

    expect(mockListProps.length).toBe(2);
    expect(lastProps().data).toBe(first);
  });

  it("rebuilds the list data when the exercises change", () => {
    const { rerender } = render(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );
    const first = lastProps().data;

    rerender(
      <ExerciseList
        exercises={{ ...exercises, otherExercises: [exercise(2)] }}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );

    expect(lastProps().data).not.toBe(first);
    expect(lastProps().data.map((entry: any) => entry.type)).toEqual([
      "title",
      "exercise",
      "title",
      "exercise",
    ]);
  });

  it("hands rows the same callbacks when the parent passes new ones", () => {
    const { rerender } = render(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );
    const before = renderRow(2).props;

    rerender(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );
    const after = renderRow(2).props;

    expect(after.onSelect).toBe(before.onSelect);
    expect(after.onPress).toBe(before.onPress);
  });

  it("calls the parent's latest callbacks", () => {
    const firstSelect = jest.fn();
    const latestSelect = jest.fn();
    const latestPress = jest.fn();
    const { rerender } = render(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={firstSelect}
        onPressItem={() => {}}
      />,
    );
    rerender(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={latestSelect}
        onPressItem={latestPress}
      />,
    );

    const row = renderRow(2).props;
    row.onSelect(2);
    row.onPress(exercise(2));

    expect(firstSelect).not.toHaveBeenCalled();
    expect(latestSelect).toHaveBeenCalledWith(2);
    expect(latestPress).toHaveBeenCalledWith(exercise(2));
  });

  it("marks only the selected exercises", () => {
    render(
      <ExerciseList
        exercises={exercises}
        selectedExercises={[3]}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );

    expect(renderRow(3).props.selected).toBe(true);
    expect(renderRow(2).props.selected).toBe(false);
  });

  it("recycles title and exercise rows separately", () => {
    render(
      <ExerciseList
        exercises={exercises}
        selectedExercises={noSelection}
        onSelect={() => {}}
        onPressItem={() => {}}
      />,
    );
    const { data, getItemType } = lastProps();

    expect(getItemType(data[0])).toBe("title");
    expect(getItemType(data[1])).toBe("exercise");
  });
});
