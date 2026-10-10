import React from "react";
import { render } from "@testing-library/react-native";
import StandaloneWorkoutListItem from "../StandaloneWorkoutListItem";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  Plural: ({ value, one, other }: any) =>
    (value === 1 ? one : other).replace("#", String(value)),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce((acc, part, i) => acc + part + (i < v.length ? v[i] : ""), ""),
}));
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("@/hooks/useWorkoutDurationEstimate", () => ({
  useWorkoutDurationEstimate: () => ({ estimate: null }),
}));

const workout = (name: string) => ({ id: 1, name, exercises: [] }) as any;

describe("StandaloneWorkoutListItem", () => {
  it("shows the stored Quick Workout name through displayWorkoutName", () => {
    const { getByText, queryByText } = render(
      <StandaloneWorkoutListItem
        workout={workout("Quick Workout")}
        onPress={jest.fn()}
      />,
    );

    expect(getByText("Quick workout")).toBeTruthy();
    expect(queryByText("Quick Workout")).toBeNull();
  });

  it("shows a user-chosen name as written", () => {
    const { getByText } = render(
      <StandaloneWorkoutListItem
        workout={workout("Leg Day")}
        onPress={jest.fn()}
      />,
    );

    expect(getByText("Leg Day")).toBeTruthy();
  });
});
