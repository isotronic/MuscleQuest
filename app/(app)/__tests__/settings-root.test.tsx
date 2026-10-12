import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import SettingsScreen from "../settings/index";

let mockParams: { section?: string } = {};

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => {
  const raw = (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v);
  return { t: raw, msg: (s: TemplateStringsArray) => ({ message: s[0] }) };
});
jest.mock("@lingui/react", () => {
  const translate = (d: { message: string }) => d.message;
  return { useLingui: () => ({ _: translate, i18n: { _: translate } }) };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock("@/components/settings/AccountCard", () => ({
  AccountCard: () => null,
}));

describe("Settings root", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it("lists the topic screens", () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText("Workout and rest timer"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/settings/workout",
      params: {},
    });
  });

  it("finds default rest time and opens its row", () => {
    const { getByLabelText, getByText, queryByText } = render(
      <SettingsScreen />,
    );
    fireEvent.changeText(getByLabelText("Search settings"), "default rest");
    // Results replace the topic list.
    expect(queryByText("About")).toBeNull();
    fireEvent.press(getByText("Default rest time"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/settings/workout",
      params: { highlight: "defaultRestTime" },
    });
  });

  it("says when nothing matches", () => {
    const { getByLabelText, getByText } = render(<SettingsScreen />);
    fireEvent.changeText(getByLabelText("Search settings"), "zzzzqq");
    expect(getByText("No settings match “zzzzqq”.")).toBeTruthy();
  });

  it("forwards the old progression section link", () => {
    mockParams = { section: "progression" };
    const { getByText } = render(<SettingsScreen />);
    expect(getByText("redirect:/(app)/settings/progression")).toBeTruthy();
  });
});
