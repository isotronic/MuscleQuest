import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import LoginScreen from "../login";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#000",
      card: "#111",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
      accent: "#0f0",
    },
  }),
}));
jest.mock("@/components/ThemedView", () => {
  const { View } = require("react-native");
  return { ThemedView: (props: any) => <View {...props} /> };
});
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/ui", () => ({ AppImage: () => null }));
jest.mock("@/assets/images/icon.png", () => 1);
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  }),
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ onPress, disabled, loading, children, testID }: any) => (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls signIn once when the Google button is pressed twice", async () => {
    let resolveSignIn: (v: { idToken: string }) => void = () => {};
    (GoogleSignin.signIn as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const { getByTestId } = render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(getByTestId("login-google"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("login-google"));
    });

    expect(GoogleSignin.signIn).toHaveBeenCalledTimes(1);
    await act(async () => resolveSignIn({ idToken: "tok" }));
  });

  it("disables both buttons while signing in", async () => {
    (GoogleSignin.signIn as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );
    const { getByTestId } = render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(getByTestId("login-google"));
    });

    expect(getByTestId("login-google").props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    expect(getByTestId("login-skip").props.accessibilityState.disabled).toBe(
      true,
    );
  });
});
