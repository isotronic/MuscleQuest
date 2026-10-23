import React from "react";
import { render } from "@testing-library/react-native";
import { SettingRow, SettingsScroll } from "../SettingRow";

let mockQuery: Record<string, unknown> = {};
const mockRefetch = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ highlight: "defaultRestTime" }),
  router: { replace: jest.fn() },
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ ...mockQuery, refetch: mockRefetch }),
}));

const rowStyle = (node: any) => {
  // The animated wrapper around the row's touchable.
  let current = node;
  while (current && !current.props.onLayout) current = current.parent;
  return current?.props.style;
};

beforeEach(() => {
  mockQuery = { data: {}, isLoading: false, isError: false };
});

describe("SettingRow", () => {
  it("highlights the row a search result opened, and no other", () => {
    const { getByText } = render(
      <SettingsScroll>
        <SettingRow id="defaultRestTime" icon="clock" title="Rest" />
        <SettingRow id="defaultSets" icon="numeric" title="Sets" />
      </SettingsScroll>,
    );
    expect(rowStyle(getByText("Rest"))).toEqual(
      expect.objectContaining({ backgroundColor: expect.anything() }),
    );
    expect(rowStyle(getByText("Sets"))).toBeFalsy();
  });

  it("shows a spinner instead of empty values while settings load", () => {
    mockQuery = { isLoading: true };
    const { queryByText, getByTestId } = render(
      <SettingsScroll>
        <SettingRow icon="numeric" title="Sets" />
      </SettingsScroll>,
    );
    expect(queryByText("Sets")).toBeNull();
    expect(getByTestId("settings-loading")).toBeTruthy();
  });

  it("offers a retry when settings fail to load", () => {
    mockQuery = { isError: true };
    const { getByText, queryByText } = render(
      <SettingsScroll>
        <SettingRow icon="numeric" title="Sets" />
      </SettingsScroll>,
    );
    expect(queryByText("Sets")).toBeNull();
    expect(getByText("Your settings could not be loaded.")).toBeTruthy();
  });
});
