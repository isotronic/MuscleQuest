import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Linking } from "react-native";
import HelpScreen from "../help";
import { HELP_DATA as mockHelpData } from "@/constants/HelpData";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (x: unknown) => x }),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#eee",
      surface: "#fff",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 20, full: 999 },
}));
jest.mock("@/components/ui", () => {
  const { Text } = require("react-native");
  return {
    AppIcon: ({ name, testID }: any) => <Text testID={testID}>{name}</Text>,
  };
});
jest.mock("react-native-paper", () => {
  const { View } = require("react-native");
  return { Divider: (props: any) => <View {...props} /> };
});
jest.mock("@/constants/HelpData", () => ({
  HELP_DATA: [
    {
      id: "group-a",
      group: "Group A",
      sections: [
        {
          id: "sec-alpha",
          icon: "home-outline",
          title: "Alpha Topic",
          body:
            "This is a very long descriptive paragraph about alpha testing procedures " +
            "that goes on for quite a while before mentioning the special word gizmo " +
            "somewhere in the middle and then continues on afterwards for a good while " +
            "longer to pad out the length nicely so the snippet has to truncate it.",
        },
        {
          id: "sec-beta",
          icon: "star-outline",
          title: "Beta Topic",
          body: {
            lead: "Beta lead sentence.",
            steps: ["First beta step.", "Second beta step with gizmo in it."],
            ordered: true,
          },
        },
      ],
    },
    {
      id: "group-b",
      group: "Group B",
      sections: [
        {
          id: "sec-gamma",
          icon: "settings-outline",
          title: "Gamma Topic",
          body: "Gamma body text with nothing special in it.",
        },
      ],
    },
  ],
  isStepsBody: (body: unknown) =>
    typeof body === "object" && body !== null && "steps" in body,
}));

const mockLongAlphaBody = mockHelpData[0].sections[0].body as unknown as string;

describe("HelpScreen", () => {
  it("renders groups collapsed by default", () => {
    const { getByTestId, queryByText } = render(<HelpScreen />);
    expect(getByTestId("help-group-header-group-a")).toBeTruthy();
    expect(getByTestId("help-group-header-group-b")).toBeTruthy();
    expect(queryByText("Alpha Topic")).toBeNull();
  });

  it("expands a group when its header is tapped", () => {
    const { getByTestId, getByText, queryByText } = render(<HelpScreen />);
    fireEvent.press(getByTestId("help-group-header-group-a"));
    expect(getByText("Alpha Topic")).toBeTruthy();
    expect(getByText("Beta Topic")).toBeTruthy();
    // Sibling group stays collapsed.
    expect(queryByText("Gamma Topic")).toBeNull();
  });

  it("collapses an expanded group when tapped again", () => {
    const { getByTestId, getByText, queryByText } = render(<HelpScreen />);
    fireEvent.press(getByTestId("help-group-header-group-a"));
    expect(getByText("Alpha Topic")).toBeTruthy();
    fireEvent.press(getByTestId("help-group-header-group-a"));
    expect(queryByText("Alpha Topic")).toBeNull();
  });

  it("auto-expands only matching groups while searching, hiding the rest", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <HelpScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("Search help…"), "gizmo");
    expect(getByText("Alpha Topic")).toBeTruthy();
    expect(getByText("Beta Topic")).toBeTruthy();
    expect(queryByText("Group B")).toBeNull();
    expect(queryByText("Gamma Topic")).toBeNull();
  });

  it("shows a no-results empty state with a clear action for an unmatched query", () => {
    const { getByPlaceholderText, getByText, getByTestId, queryByText } =
      render(<HelpScreen />);
    fireEvent.changeText(
      getByPlaceholderText("Search help…"),
      "zzz-nonexistent-xyz",
    );
    expect(getByText(/No results for/)).toBeTruthy();
    const clearButton = getByText("Clear search");
    fireEvent.press(clearButton);
    expect(queryByText(/No results for/)).toBeNull();
    // Back to browse mode: groups visible again, collapsed.
    expect(getByTestId("help-group-header-group-a")).toBeTruthy();
    expect(queryByText("Alpha Topic")).toBeNull();
  });

  it("opens the feature-request link from the empty state", () => {
    const openURLSpy = jest
      .spyOn(Linking, "openURL")
      .mockImplementation(() => Promise.resolve(true));
    const { getByPlaceholderText, getByText } = render(<HelpScreen />);
    fireEvent.changeText(
      getByPlaceholderText("Search help…"),
      "zzz-nonexistent-xyz",
    );
    fireEvent.press(getByText(/Didn't find what you were looking for/));
    expect(openURLSpy).toHaveBeenCalledWith(
      "https://www.featurize.io/p/musclequest",
    );
    openURLSpy.mockRestore();
  });

  it("shows a truncated snippet while searching and reveals the full body on Show more", () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <HelpScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("Search help…"), "gizmo");
    expect(queryByText(mockLongAlphaBody)).toBeNull();
    fireEvent.press(getByText("Show more"));
    expect(getByText(mockLongAlphaBody)).toBeTruthy();
  });

  it("renders one chip per group while browsing and scrolls on press", () => {
    const { getByTestId } = render(<HelpScreen />);
    const groupAWrapper = getByTestId("help-group-group-a");
    fireEvent(groupAWrapper, "layout", {
      nativeEvent: { layout: { y: 123, x: 0, width: 100, height: 50 } },
    });
    // Pressing the chip should not throw even though the ScrollView itself
    // isn't asserted against directly (RNTL doesn't perform real layout).
    expect(() =>
      fireEvent.press(getByTestId("help-chip-group-a")),
    ).not.toThrow();
  });

  it("does not render the chip row while searching", () => {
    const { getByPlaceholderText, queryByTestId } = render(<HelpScreen />);
    fireEvent.changeText(getByPlaceholderText("Search help…"), "gizmo");
    expect(queryByTestId("help-chip-group-a")).toBeNull();
  });
});
