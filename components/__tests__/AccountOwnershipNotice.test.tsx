import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { AccountOwnershipNotice } from "../AccountOwnershipNotice";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { claimLocalData } from "@/utils/accountOwnership";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
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
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ onPress, children, testID }: any) => (
      <Pressable testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/utils/accountOwnership", () => ({
  claimLocalData: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));

const bob = { uid: "bob" } as any;

beforeEach(() => jest.clearAllMocks());

it("shows nothing while the account owns the data", () => {
  useAccountOwnershipStore.setState({
    resolvedFor: "bob",
    ownedByCurrentUser: true,
  });
  const { queryByTestId } = render(<AccountOwnershipNotice user={bob} />);
  expect(queryByTestId("ownership-notice")).toBeNull();
});

it("shows nothing when signed out", () => {
  const { queryByTestId } = render(<AccountOwnershipNotice user={null} />);
  expect(queryByTestId("ownership-notice")).toBeNull();
});

it("offers to use the data with this account while paused", async () => {
  useAccountOwnershipStore.setState({
    resolvedFor: "bob",
    ownedByCurrentUser: false,
  });
  const { getByTestId } = render(<AccountOwnershipNotice user={bob} />);

  await act(async () => {
    fireEvent.press(getByTestId("ownership-notice-claim"));
  });

  expect(claimLocalData).toHaveBeenCalledWith("bob");
});
