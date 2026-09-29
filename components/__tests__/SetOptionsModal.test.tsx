import React from "react";
import { Modal } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { SetOptionsModal } from "../SetOptionsModal";

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
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));

const initialValues = {
  repsMin: "8",
  repsMax: "12",
  restTotalSeconds: 90,
  timeSeconds: 0,
  distance: "",
  isWarmup: true,
  isDropSet: false,
  isToFailure: false,
};

const renderModal = (onClose = jest.fn()) =>
  render(
    <SetOptionsModal
      visible
      onClose={onClose}
      trackingType="weight"
      initialValues={initialValues}
      defaultRepsMin={8}
      defaultRepsMax={12}
      showSetTypeOptions
      showApplyToAll
      saveLabel="Save"
      onSave={jest.fn()}
    />,
  );

describe("SetOptionsModal accessibility", () => {
  it("closes on the Android back gesture", () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = renderModal(onClose);
    UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onClose).toHaveBeenCalled();
  });

  it("labels each set type checkbox and reports its state", () => {
    const { getByRole } = renderModal();
    const warmup = getByRole("checkbox", { name: "Warm-up set" });
    expect(warmup).toBeChecked();
    expect(getByRole("checkbox", { name: "Drop set" })).not.toBeChecked();
    expect(getByRole("checkbox", { name: "To failure" })).not.toBeChecked();
    fireEvent.press(warmup);
    expect(getByRole("checkbox", { name: "Warm-up set" })).not.toBeChecked();
  });

  it("labels the rest time fields", () => {
    const { getByLabelText } = renderModal();
    expect(getByLabelText("Rest time, minutes")).toBeTruthy();
    expect(getByLabelText("Rest time, seconds")).toBeTruthy();
  });
});
