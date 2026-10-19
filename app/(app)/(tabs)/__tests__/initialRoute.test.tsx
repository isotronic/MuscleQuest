import React from "react";
import { Text } from "react-native";
import { router, Slot } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";

jest.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({ colors: {} }),
}));

// "/" matches both the home tab and the plans group's index, and expo-router
// ranks a group's initialRouteName (or anchor) first, so the plans layout
// must not set one or the app opens on Plans.
const plansSettings =
  jest.requireActual("../(plans)/_layout").unstable_settings;

const routes = {
  // Slots stand in for the navigators: the ranking happens in path matching.
  "(app)/(tabs)/_layout": () => <Slot />,
  "(app)/(tabs)/index": () => <Text>Home screen</Text>,
  "(app)/(tabs)/(plans)/_layout": {
    default: () => <Slot />,
    ...(plansSettings ? { unstable_settings: plansSettings } : {}),
  },
  "(app)/(tabs)/(plans)/index": () => <Text>Plans screen</Text>,
  "(app)/(tabs)/(plans)/overview": () => <Text>Overview screen</Text>,
  "get-started": () => <Text>Get started</Text>,
};

describe("tabs initial route", () => {
  it("opens on home, not the plans list", () => {
    renderRouter(routes, { initialUrl: "/" });
    expect(screen.getByText("Home screen")).toBeTruthy();
  });

  it("puts the plans list under an overview opened from Get started", () => {
    renderRouter(routes, { initialUrl: "/get-started" });
    act(() => {
      router.replace("/(app)/(tabs)/(plans)");
      router.push({
        pathname: "/(app)/(tabs)/(plans)/overview",
        params: { planId: "1" },
      });
    });
    expect(screen.getByText("Overview screen")).toBeTruthy();
    act(() => router.back());
    expect(screen.getByText("Plans screen")).toBeTruthy();
  });
});
