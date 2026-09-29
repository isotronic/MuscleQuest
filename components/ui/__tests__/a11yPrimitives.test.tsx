import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { AppIconButton } from "../AppIconButton";
import { AppIcon } from "../AppIcon";
import { AppButton } from "../AppButton";
import { ThemedText } from "@/components/ThemedText";
import { AppSelect } from "../AppSelect";

describe("AppIconButton", () => {
  it("exposes its label and the button role", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <AppIconButton
        icon="plus"
        accessibilityLabel="Add set"
        onPress={onPress}
      />,
    );
    fireEvent.press(getByRole("button", { name: "Add set" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("exposes the disabled state", () => {
    const { getByRole } = render(
      <AppIconButton
        icon="chevron-left"
        accessibilityLabel="Previous set"
        onPress={jest.fn()}
        disabled
      />,
    );
    expect(getByRole("button", { name: "Previous set" })).toBeDisabled();
  });
});

describe("AppIcon", () => {
  it("is a labelled button when pressable", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <AppIcon
        set="mci"
        name="delete"
        onPress={onPress}
        accessibilityLabel="Delete set"
      />,
    );
    fireEvent.press(getByRole("button", { name: "Delete set" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("is hidden from screen readers when decorative", () => {
    const { queryByRole, getByTestId } = render(
      <AppIcon set="mci" name="fire" testID="deco" />,
    );
    expect(queryByRole("button")).toBeNull();
    const icon = getByTestId("deco", { includeHiddenElements: true });
    expect(icon).not.toBeVisible();
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});

describe("AppButton", () => {
  it("forwards an explicit label and hint", () => {
    const { getByRole } = render(
      <AppButton
        onPress={jest.fn()}
        accessibilityLabel="Delete workout"
        accessibilityHint="Deletes this workout from your history"
      >
        Delete
      </AppButton>,
    );
    const button = getByRole("button", { name: "Delete workout" });
    expect(button.props.accessibilityHint).toBe(
      "Deletes this workout from your history",
    );
  });
});

describe("ThemedText", () => {
  it("marks title and subtitle text as headers", () => {
    const { getByRole } = render(
      <>
        <ThemedText type="title">Workouts</ThemedText>
        <ThemedText type="subtitle">This week</ThemedText>
      </>,
    );
    expect(getByRole("header", { name: "Workouts" })).toBeTruthy();
    expect(getByRole("header", { name: "This week" })).toBeTruthy();
  });

  it("does not mark body text as a header", () => {
    const { queryByRole } = render(<ThemedText>Body</ThemedText>);
    expect(queryByRole("header")).toBeNull();
  });
});

describe("AppSelect", () => {
  const data = [
    { label: "All equipment", value: "all" },
    { label: "Barbell", value: "barbell" },
  ];

  it("speaks the field name with the current selection", () => {
    const { getByLabelText } = render(
      <AppSelect
        data={data}
        value="barbell"
        onChange={jest.fn()}
        accessibilityLabel="Equipment"
      />,
    );
    expect(getByLabelText("Equipment: Barbell")).toBeTruthy();
  });

  it("falls back to the placeholder when nothing is selected", () => {
    const { getByLabelText } = render(
      <AppSelect
        data={data}
        value={null}
        placeholder="All equipment"
        onChange={jest.fn()}
        accessibilityLabel="Equipment"
      />,
    );
    expect(getByLabelText("Equipment: All equipment")).toBeTruthy();
  });

  it("grows with the text size instead of clipping it", () => {
    const { StyleSheet } = require("react-native");
    const { getByLabelText } = render(
      <AppSelect
        data={data}
        value="barbell"
        onChange={jest.fn()}
        accessibilityLabel="Equipment"
      />,
    );
    // The library applies our style to a wrapper above the labelled element.
    let node: any = getByLabelText("Equipment: Barbell");
    const styles: any[] = [];
    while (node) {
      styles.push(StyleSheet.flatten(node.props.style) ?? {});
      node = node.parent;
    }
    expect(styles.some((s) => s.minHeight === 50)).toBe(true);
    expect(styles.some((s) => s.height === 50)).toBe(false);
  });
});
