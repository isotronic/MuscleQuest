import React from "react";
import { Alert } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { StartupRecoveryScreen } from "../StartupRecoveryScreen";
import { hasRestoreToUndo } from "@/utils/restoreRollback";
import { undoLastRestoreAndReload } from "@/utils/startup";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/components/ThemedView", () => {
  const { View } = jest.requireActual("react-native");
  return { ThemedView: View };
});
jest.mock("@/components/ThemedText", () => {
  const { Text } = jest.requireActual("react-native");
  return { ThemedText: Text };
});
jest.mock("@/components/ui", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    AppButton: ({
      children,
      onPress,
    }: {
      children: React.ReactNode;
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/utils/restoreRollback", () => ({
  hasRestoreToUndo: jest.fn(() => false),
}));
jest.mock("@/utils/startup", () => ({
  DATABASE_RESTORED_KEY: "databaseRestored",
  resetStartupFailureCount: jest.fn(),
  undoLastRestoreAndReload: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/clearUserData", () => ({
  clearDatabaseAndReinitialize: jest.fn(),
}));

const error = new Error("no such column");

describe("StartupRecoveryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("offers no undo when no restore is awaiting its first boot", () => {
    (hasRestoreToUndo as jest.Mock).mockReturnValue(false);
    const { queryByText } = render(<StartupRecoveryScreen error={error} />);
    expect(queryByText("Undo last restore")).toBeNull();
  });

  it("offers to undo the last restore when its originals are kept", async () => {
    (hasRestoreToUndo as jest.Mock).mockReturnValue(true);
    const { getByText } = render(<StartupRecoveryScreen error={error} />);

    fireEvent.press(getByText("Undo last restore"));

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirm = buttons.find(
      (b: { text: string }) => b.text === "Undo restore",
    );
    await confirm.onPress();
    expect(undoLastRestoreAndReload).toHaveBeenCalled();
  });
});
