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
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "de", decimalSeparator: "," }],
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

describe("SetOptionsModal number entry on a comma device", () => {
  const renderDistance = (onSave = jest.fn(), distance = "") =>
    render(
      <SetOptionsModal
        visible
        onClose={jest.fn()}
        trackingType="distance"
        distanceUnit="km"
        initialValues={{ ...initialValues, distance }}
        defaultRepsMin={8}
        defaultRepsMax={12}
        saveLabel="Save"
        onSave={onSave}
      />,
    );

  it("saves a comma-typed target distance as a number", () => {
    const onSave = jest.fn();
    const { getByLabelText, getByText } = renderDistance(onSave);
    fireEvent.changeText(getByLabelText("Target distance in km"), "1,5");
    fireEvent.press(getByText("Save"));
    expect(onSave.mock.calls[0][0].distance).toBe(1.5);
  });

  it("shows the seeded distance with the device separator", () => {
    const { getByLabelText } = renderDistance(jest.fn(), "2.5");
    expect(getByLabelText("Target distance in km").props.value).toBe("2,5");
  });

  it("keeps only digits in the rep fields", () => {
    const onSave = jest.fn();
    const { getByLabelText, getByText } = render(
      <SetOptionsModal
        visible
        onClose={jest.fn()}
        trackingType="weight"
        initialValues={initialValues}
        defaultRepsMin={8}
        defaultRepsMax={12}
        showSetTypeOptions={false}
        saveLabel="Save"
        onSave={onSave}
      />,
    );
    fireEvent.changeText(getByLabelText("Min reps"), "6,5");
    fireEvent.press(getByText("Save"));
    expect(onSave.mock.calls[0][0].repsMin).toBe(65);
  });
});
