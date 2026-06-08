import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { CopyWorkoutModal } from "../CopyWorkoutModal";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      surface: "#fff",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
    },
  }),
  radii: { sm: 4, md: 8 },
}));
jest.mock("@/components/ThemedText", () => ({
  ThemedText: ({ children }: any) => children,
}));
jest.mock("react-native-paper", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) => (visible ? children : null),
    Button: ({ children, onPress, disabled, testID }: any) => (
      <TouchableOpacity
        onPress={disabled ? undefined : onPress}
        testID={testID}
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

const baseProps = {
  visible: true,
  defaultName: "Push Day",
  onConfirm: jest.fn(),
  onDismiss: jest.fn(),
  isPending: false,
};

beforeEach(() => jest.clearAllMocks());

describe("CopyWorkoutModal", () => {
  it("pre-fills the text input with defaultName", () => {
    const { getByDisplayValue } = render(<CopyWorkoutModal {...baseProps} />);
    expect(getByDisplayValue("Push Day")).toBeTruthy();
  });

  it("disables the Copy button when the name is empty", () => {
    const { UNSAFE_getByProps } = render(
      <CopyWorkoutModal {...baseProps} defaultName="" />,
    );
    expect(
      UNSAFE_getByProps({ testID: "copy-modal-confirm", disabled: true }),
    ).toBeTruthy();
  });

  it("enables the Copy button when the name has content", () => {
    const { UNSAFE_getByProps } = render(<CopyWorkoutModal {...baseProps} />);
    expect(
      UNSAFE_getByProps({ testID: "copy-modal-confirm", disabled: false }),
    ).toBeTruthy();
  });

  it("disables the Copy button when isPending is true", () => {
    const { UNSAFE_getByProps } = render(
      <CopyWorkoutModal {...baseProps} isPending={true} />,
    );
    expect(
      UNSAFE_getByProps({ testID: "copy-modal-confirm", disabled: true }),
    ).toBeTruthy();
  });

  it("calls onConfirm with trimmed name when Copy is pressed", () => {
    const onConfirm = jest.fn();
    const { getByDisplayValue, getByTestId } = render(
      <CopyWorkoutModal {...baseProps} onConfirm={onConfirm} />,
    );
    fireEvent.changeText(getByDisplayValue("Push Day"), "  Leg Day  ");
    fireEvent.press(getByTestId("copy-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("Leg Day");
  });

  it("calls onDismiss when Cancel is pressed", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <CopyWorkoutModal {...baseProps} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId("copy-modal-cancel"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("resets the name to defaultName when visible flips to true", () => {
    const { getByDisplayValue, rerender } = render(
      <CopyWorkoutModal {...baseProps} visible={false} />,
    );
    rerender(<CopyWorkoutModal {...baseProps} visible={true} defaultName="New Name" />);
    expect(getByDisplayValue("New Name")).toBeTruthy();
  });

  it("renders nothing when visible is false", () => {
    const { queryByTestId } = render(
      <CopyWorkoutModal {...baseProps} visible={false} />,
    );
    expect(queryByTestId("copy-modal-confirm")).toBeNull();
  });
});
