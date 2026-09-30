import React from "react";
import { Modal } from "react-native";
import { render } from "@testing-library/react-native";
import { PlateCalculatorModal } from "../PlateCalculatorModal";

// Its keyboard listeners cannot unsubscribe from the mocked event emitter.
jest.mock(
  "react-native/Libraries/Components/Keyboard/KeyboardAvoidingView",
  () => {
    const { View } = jest.requireActual("react-native");
    return { __esModule: true, default: View };
  },
);
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { plateCalcBarKg: "20" } }),
}));
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: jest.fn() }),
}));

const renderModal = (onClose = jest.fn()) =>
  render(
    <PlateCalculatorModal
      visible
      onClose={onClose}
      targetWeight="60"
      weightUnit="kg"
    />,
  );

describe("PlateCalculatorModal accessibility", () => {
  it("closes on the Android back gesture", () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = renderModal(onClose);
    UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onClose).toHaveBeenCalled();
  });

  it("exposes the title as a header", () => {
    const { getByRole } = renderModal();
    expect(getByRole("header", { name: "Plate Calculator" })).toBeTruthy();
  });

  it("marks the chosen bar weight as selected", () => {
    const { getByRole } = renderModal();
    expect(getByRole("button", { name: "20 kg bar" })).toBeSelected();
    expect(
      getByRole("button", { name: "Custom bar weight" }),
    ).not.toBeSelected();
  });

  it("reads each plate row as one phrase", () => {
    const { getByLabelText } = renderModal();
    expect(getByLabelText("1 × 20 kg per side")).toBeTruthy();
  });

  it("keeps the dialog's controls reachable on iOS", () => {
    // An accessible ancestor would merge every field into one VoiceOver stop.
    // Reported as short strings: printing test instances exhausts memory.
    const { UNSAFE_root } = renderModal();
    const grouped = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessible === true &&
        node.findAll(
          (child) =>
            child !== node &&
            typeof child.type === "string" &&
            child.props.accessibilityRole != null,
        ).length > 0,
    ).map((node) => `${String(node.type)} ${node.props.testID ?? ""}`);
    expect(grouped).toEqual([]);
  });
});
