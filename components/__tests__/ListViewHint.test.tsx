import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ListViewHint } from "../workout/ListViewHint";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ children, onPress }: any) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#888" }) }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
let mockSettings: Record<string, string> = {};
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: mockSettings }),
}));
const mockUpdate = jest.fn();
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: mockUpdate }),
}));
let mockHasCompleted: boolean | undefined = true;
jest.mock("@/hooks/useWorkoutSummariesQuery", () => ({
  useHasCompletedWorkoutQuery: () => ({ data: mockHasCompleted }),
}));
const mockSnackbar = jest.fn();
jest.mock("@/store/snackbarStore", () => ({
  showSnackbar: (...args: unknown[]) => mockSnackbar(...args),
}));

const PROMPT =
  "Prefer to see all of an exercise's sets at once? Try list view.";

describe("ListViewHint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = {};
    mockHasCompleted = true;
  });

  it("waits for the second session", () => {
    mockHasCompleted = false;
    expect(render(<ListViewHint />).queryByText(PROMPT)).toBeNull();
    mockHasCompleted = undefined;
    expect(render(<ListViewHint />).queryByText(PROMPT)).toBeNull();
  });

  it("is gone once answered or once list view is on", () => {
    mockSettings = { listViewHintSeen: "true" };
    expect(render(<ListViewHint />).queryByText(PROMPT)).toBeNull();
    mockSettings = { loggingStyle: "list" };
    expect(render(<ListViewHint />).queryByText(PROMPT)).toBeNull();
  });

  it("turns on list view and retires itself", () => {
    const screen = render(<ListViewHint />);
    fireEvent.press(screen.getByText("Try list view"));
    expect(mockUpdate).toHaveBeenCalledWith({
      key: "loggingStyle",
      value: "list",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      key: "listViewHintSeen",
      value: "true",
    });
    expect(mockSnackbar).toHaveBeenCalled();
  });

  it("keeps one set at a time and retires itself", () => {
    const screen = render(<ListViewHint />);
    fireEvent.press(screen.getByText("Keep one set at a time"));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      key: "listViewHintSeen",
      value: "true",
    });
  });
});
