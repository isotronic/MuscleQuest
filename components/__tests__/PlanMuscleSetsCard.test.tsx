import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PlanMuscleSetsCard } from "../PlanMuscleSetsCard";
import { MAJOR_MUSCLES } from "@/utils/plannedMuscleSets";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  msg: (s: TemplateStringsArray) => s[0],
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));
jest.mock("@/hooks/useMuscleSetsSettings", () => ({
  useMuscleSetsSettings: () => ({
    secondaryWeight: 0.5,
    target: { min: 10, max: 20 },
  }),
}));

const workout = (muscles: string[]) => ({
  exercises: muscles.map((target_muscle) => ({
    target_muscle,
    secondary_muscles: [],
    sets: [{}, {}, {}],
  })),
});

describe("PlanMuscleSetsCard", () => {
  it("names untrained major muscles while collapsed", () => {
    const { getByText, queryByText } = render(
      <PlanMuscleSetsCard
        workouts={[workout(["pectorals", "quads"])]}
        scheduledWorkoutIndices={[0, 0]}
      />,
    );

    expect(getByText("Weekly sets per muscle")).toBeTruthy();
    expect(getByText(/Not trained: Upper Back, Lats, Delts/)).toBeTruthy();
    // Bars stay hidden until the card is opened.
    expect(queryByText("Pectorals")).toBeNull();

    fireEvent.press(getByText("Weekly sets per muscle"));

    expect(getByText("Pectorals")).toBeTruthy();
    expect(getByText(/target of 10 to 20 sets/)).toBeTruthy();
  });

  it("shows one round and no target without a schedule", () => {
    const { getByText, queryByText } = render(
      <PlanMuscleSetsCard
        workouts={[workout([...MAJOR_MUSCLES])]}
        scheduledWorkoutIndices={[]}
      />,
    );

    expect(getByText("Every major muscle gets some work.")).toBeTruthy();
    fireEvent.press(getByText("Sets per muscle"));
    expect(getByText(/one round of the plan's workouts/)).toBeTruthy();
    expect(queryByText(/target of/)).toBeNull();
  });

  it("renders nothing for a plan without working sets", () => {
    const { toJSON } = render(
      <PlanMuscleSetsCard workouts={[]} scheduledWorkoutIndices={[]} />,
    );
    expect(toJSON()).toBeNull();
  });
});
