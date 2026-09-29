import React from "react";
import { render } from "@testing-library/react-native";
import { InsightsStrip } from "../InsightsStrip";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));

describe("InsightsStrip accessibility", () => {
  it("calls only pills that show a tooltip buttons", () => {
    const { getAllByRole, getByText } = render(
      <InsightsStrip
        workoutsPerWeek={3}
        biggestGainLabel="Bench Press"
        biggestGainValue="+10 kg"
        topBodyPart={null}
        streak={2}
        weightUnit="kg"
      />,
    );
    const buttons = getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent(/Best gain/);
    expect(getByText("3.0 workouts")).toBeTruthy();
  });
});
