import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ChangelogScreen from "../changelog";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce((out, part, i) => out + part + (i < v.length ? v[i] : ""), ""),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (x: unknown) => x, i18n: { locale: "en" } }),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#eee",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
    },
  }),
}));
jest.mock("@/components/ui", () => {
  const { Text } = require("react-native");
  return { AppIcon: ({ name }: any) => <Text>{name}</Text> };
});
jest.mock("react-native-paper", () => {
  const { View } = require("react-native");
  return { Divider: (props: any) => <View {...props} /> };
});
jest.mock("@/constants/WhatsNew", () => ({
  RELEASES: [
    { version: "1.0", date: "2026-01" },
    { version: "1.1", date: "2026-02" },
    { version: "1.2", date: "2026-03" },
  ],
  WHATS_NEW_ENTRIES: [
    { version: 1, release: "1.0", message: "\nOld title\n\nOld body.\n" },
    { version: 2, release: "1.1", message: "\nMiddle title\n\nMiddle body.\n" },
    { version: 3, release: "1.1", message: "\nNewer title\n\nNewer body.\n" },
  ],
}));

describe("ChangelogScreen", () => {
  it("shows releases with entries, newest first, and hides empty ones", () => {
    const { queryByText, getAllByText } = render(<ChangelogScreen />);
    expect(queryByText("Version 1.2")).toBeNull();
    const headers = getAllByText(/^Version /).map((n) => n.props.children);
    expect(headers).toEqual(["Version 1.1", "Version 1.0"]);
    expect(queryByText("February 2026")).not.toBeNull();
  });

  it("opens the latest release only, newest entry first", () => {
    const { queryByText, getAllByText } = render(<ChangelogScreen />);
    const titles = getAllByText(/title$/).map((n) => n.props.children);
    expect(titles).toEqual(["Newer title", "Middle title"]);
    expect(queryByText("Middle body.")).not.toBeNull();
    expect(queryByText("Old title")).toBeNull();
  });

  it("toggles a release when its header is pressed", () => {
    const { getByTestId, queryByText } = render(<ChangelogScreen />);
    fireEvent.press(getByTestId("changelog-release-header-1.0"));
    expect(queryByText("Old title")).not.toBeNull();
    fireEvent.press(getByTestId("changelog-release-header-1.1"));
    expect(queryByText("Newer title")).toBeNull();
  });
});
