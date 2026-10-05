import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { UnitSettingItem } from "../UnitSettingItem";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const renderItem = (onPress = jest.fn()) =>
  render(
    <UnitSettingItem
      icon="weight"
      label="Weight unit"
      value="kg"
      onPress={onPress}
    />,
  );

describe("UnitSettingItem", () => {
  afterEach(() => {
    act(() => {
      useActiveWorkoutStore.setState({ activeWorkout: null, workout: null });
    });
  });

  it("opens the picker when no workout is running", () => {
    const onPress = jest.fn();
    const { getByRole, queryByText } = renderItem(onPress);
    const row = getByRole("button", { name: /Weight unit/ });
    expect(row).toBeEnabled();
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
    expect(queryByText(/Finish or cancel/)).toBeNull();
  });

  it("is locked with an explanation while a workout is in progress", () => {
    useActiveWorkoutStore.setState({
      activeWorkout: { planId: 1, workoutId: 2, name: "Push Day" },
      workout: { id: 2, name: "Push Day", exercises: [] },
    } as never);
    const onPress = jest.fn();
    const { getByRole, getByText } = renderItem(onPress);
    const row = getByRole("button", { name: /Weight unit/ });
    expect(row).toBeDisabled();
    fireEvent.press(row);
    expect(onPress).not.toHaveBeenCalled();
    getByText("Finish or cancel your workout to change units.");
  });
});
