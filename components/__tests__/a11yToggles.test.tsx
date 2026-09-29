import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Collapsible } from "../Collapsible";
import PlanScheduleEditor from "../PlanScheduleEditor";
import { Provider as PaperProvider } from "react-native-paper";
import WeekDays from "../WeekDays";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  Plural: () => null,
}));

describe("Collapsible", () => {
  it("reports whether it is expanded", () => {
    const { getByRole } = render(
      <Collapsible title="Details">
        <></>
      </Collapsible>,
    );
    const heading = getByRole("button", { name: "Details" });
    expect(heading).not.toBeExpanded();
    fireEvent.press(heading);
    expect(getByRole("button", { name: "Details" })).toBeExpanded();
  });
});

describe("PlanScheduleEditor", () => {
  const workouts = [{ name: "Push" }, { name: "" }] as any;

  it("names each day tile with the full day and its workout", () => {
    // Paper's Portal needs its Provider.
    const { getByRole } = render(
      <PaperProvider>
        <PlanScheduleEditor
          workouts={workouts}
          weeklyGoal={2}
          schedule={{ 0: 0, 2: 1 }}
          onChange={jest.fn()}
        />
      </PaperProvider>,
    );
    expect(getByRole("button", { name: "Monday: Push" })).toBeTruthy();
    expect(getByRole("button", { name: "Wednesday: Workout 2" })).toBeTruthy();
    expect(getByRole("button", { name: "Tuesday: Rest" })).toBeTruthy();
  });
});

describe("WeekDays", () => {
  it("caps text scaling inside the fixed-size day circles", () => {
    const { getByText } = render(<WeekDays />);
    const today = String(new Date().getDate());
    expect(getByText(today).props.maxFontSizeMultiplier).toBeGreaterThan(1);
  });
});
