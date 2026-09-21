import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MeasurementQuickLogForm } from "../MeasurementQuickLogForm";
import type { BodyMetricDefinition } from "@/utils/database";

const WEIGHT: BodyMetricDefinition = {
  id: 1,
  key: "weight",
  label: "Body Weight",
  value_kind: "mass",
  is_builtin: true,
  is_active: true,
  is_deleted: false,
  sort_order: 0,
};
const WAIST: BodyMetricDefinition = {
  id: 2,
  key: "waist",
  label: "Waist",
  value_kind: "length",
  is_builtin: true,
  is_active: true,
  is_deleted: false,
  sort_order: 2,
};

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  msg: (s: TemplateStringsArray) => s[0],
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111",
      accent: "#0f0",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
      background: "#000",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

const units = { [WEIGHT.id]: "kg", [WAIST.id]: "cm" };

const renderForm = (
  props: Partial<React.ComponentProps<typeof MeasurementQuickLogForm>> = {},
) =>
  render(
    <MeasurementQuickLogForm
      metrics={[WEIGHT, WAIST]}
      initialValues={{ [WEIGHT.id]: "82.5", [WAIST.id]: "" }}
      units={units}
      isSubmitting={false}
      onSubmit={jest.fn()}
      {...props}
    />,
  );

describe("MeasurementQuickLogForm", () => {
  it("prefills each input from the latest reading", () => {
    const { getByTestId } = renderForm();

    expect(getByTestId("measurement-input-1").props.value).toBe("82.5");
    expect(getByTestId("measurement-input-2").props.value).toBe("");
  });

  it("submits what the user typed", () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderForm({ onSubmit });

    fireEvent.changeText(getByTestId("measurement-input-1"), "83.1");
    fireEvent.changeText(getByTestId("measurement-input-2"), "80");
    fireEvent.press(getByTestId("measurement-log-button"));

    expect(onSubmit).toHaveBeenCalledWith({ 1: "83.1", 2: "80" });
  });

  it("refuses to submit when the user clears every field", () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderForm({ onSubmit });

    fireEvent.changeText(getByTestId("measurement-input-1"), "");
    fireEvent.press(getByTestId("measurement-log-button"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses to submit twice while the first save is in flight", () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderForm({ onSubmit, isSubmitting: true });

    fireEvent.press(getByTestId("measurement-log-button"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows each metric's unit so the user knows what to type", () => {
    const { getByText } = renderForm();

    getByText("kg");
    getByText("cm");
  });

  // Inside a bottom sheet the inputs must be BottomSheetTextInput or the
  // keyboard misbehaves, so the host gets to supply the input component.
  it("renders the input component the host supplies", () => {
    const CustomInput = jest.fn(() => null);

    renderForm({ inputComponent: CustomInput as never });

    expect(CustomInput).toHaveBeenCalled();
  });
});
