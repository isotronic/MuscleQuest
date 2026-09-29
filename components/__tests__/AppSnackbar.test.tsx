import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { AppSnackbar } from "../AppSnackbar";
import { useSnackbarStore, showSnackbar } from "@/store/snackbarStore";

jest.mock("react-native-paper", () => {
  const { Text, Pressable, View } = require("react-native");
  return {
    Portal: ({ children }: any) => children,
    Snackbar: ({ visible, children, action, onDismiss, duration }: any) =>
      visible ? (
        <View testID="snackbar" accessibilityHint={String(duration)}>
          <Text>{children}</Text>
          {action && (
            <Pressable testID="snackbar-action" onPress={action.onPress}>
              <Text>{action.label}</Text>
            </Pressable>
          )}
          <Pressable testID="snackbar-dismiss" onPress={onDismiss} />
        </View>
      ) : null,
  };
});

describe("AppSnackbar", () => {
  beforeEach(() => {
    useSnackbarStore.setState({ current: null });
  });

  it("renders nothing when there is no message", () => {
    const { queryByTestId } = render(<AppSnackbar />);
    expect(queryByTestId("snackbar")).toBeNull();
  });

  it("shows the current message and runs its action", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId, queryByTestId } = render(<AppSnackbar />);

    act(() => {
      showSnackbar("Workout deleted", {
        action: { label: "Undo", onPress },
      });
    });
    expect(getByText("Workout deleted")).toBeTruthy();

    fireEvent.press(getByTestId("snackbar-action"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(queryByTestId("snackbar")).toBeNull();
  });

  it("closes through the store when Paper dismisses it", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<AppSnackbar />);
    act(() => {
      showSnackbar("Backup complete.", { onClose });
    });

    fireEvent.press(getByTestId("snackbar-dismiss"));

    expect(onClose).toHaveBeenCalledWith(false);
  });
});
