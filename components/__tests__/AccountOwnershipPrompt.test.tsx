import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { AccountOwnershipPrompt } from "../AccountOwnershipPrompt";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import {
  claimLocalData,
  dismissOwnershipPrompt,
} from "@/utils/accountOwnership";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#fff",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
      modalBackdrop: "#0008",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});
jest.mock("react-native-paper", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) =>
      visible ? <View>{children}</View> : null,
    Button: ({ onPress, children, testID }: any) => (
      <Pressable testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/utils/accountOwnership", () => ({
  claimLocalData: jest.fn().mockResolvedValue(undefined),
  dismissOwnershipPrompt: jest.fn(),
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));
jest.mock("@/context/AuthProvider", () => {
  const { createContext } = require("react");
  return { AuthContext: createContext({ uid: "bob" }) };
});

describe("AccountOwnershipPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAccountOwnershipStore.setState({ promptVisible: true });
  });

  it("renders nothing unless asked", () => {
    useAccountOwnershipStore.setState({ promptVisible: false });
    const { queryByText } = render(<AccountOwnershipPrompt />);

    expect(queryByText("Use this device's data with this account?")).toBeNull();
  });

  it("asks whether to use the data with the signed-in account", () => {
    const { getByText } = render(<AccountOwnershipPrompt />);

    expect(getByText("Use this device's data with this account?")).toBeTruthy();
  });

  it("hands the data to the signed-in account", async () => {
    const { getByTestId } = render(<AccountOwnershipPrompt />);

    await act(async () => {
      fireEvent.press(getByTestId("ownership-claim"));
    });

    expect(claimLocalData).toHaveBeenCalledWith("bob");
  });

  it("keeps things paused on Not now", () => {
    const { getByTestId } = render(<AccountOwnershipPrompt />);

    fireEvent.press(getByTestId("ownership-not-now"));

    expect(dismissOwnershipPrompt).toHaveBeenCalled();
    expect(claimLocalData).not.toHaveBeenCalled();
  });
});
