import React from "react";
import { render } from "@testing-library/react-native";
import ProgressionSuggestionChip from "../ProgressionSuggestionChip";

jest.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), ""),
}));
const mockSettings: { plateInventoryLbs?: string } = {};
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: mockSettings }),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      accentSubtle: "#eef",
      accent: "#00f",
      dangerMuted: "#fee",
      danger: "#f00",
    },
  }),
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

describe("ProgressionSuggestionChip", () => {
  it("renders a kg suggestion in lbs for a pounds user", () => {
    const { getByText } = render(
      <ProgressionSuggestionChip
        action="increase_load"
        suggestedWeight={102.06}
        weightUnit="lbs"
      />,
    );
    getByText("225lbs suggested");
  });

  it("rounds a pounds suggestion to the smallest stocked plate pair", () => {
    mockSettings.plateInventoryLbs = JSON.stringify([
      { weight: 45, pairs: 2 },
      { weight: 2.5, pairs: 0 },
      { weight: 1.25, pairs: 1 },
    ]);
    // 103kg is 227.08lbs; one pair of 1.25s makes a 2.5lb step (the
    // default rack's 5lb step would give 225).
    const { getByText } = render(
      <ProgressionSuggestionChip
        action="increase_load"
        suggestedWeight={103}
        weightUnit="lbs"
      />,
    );
    getByText("227.5lbs suggested");
    delete mockSettings.plateInventoryLbs;
  });

  it("renders a kg suggestion unchanged for a kg user", () => {
    const { getByText } = render(
      <ProgressionSuggestionChip
        action="reduce_load"
        suggestedWeight={102.06}
        weightUnit="kg"
      />,
    );
    getByText("Reduce to 102.1kg");
  });
});
