import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import SessionSetInfo from "../SessionSetInfo";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => {
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaInsetsContext: {
      Consumer: ({ children }: any) => children(insets),
    },
  };
});
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: any) => <View {...props} /> };
});
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));
jest.mock("@/components/ProgressionSuggestionChip", () => () => null);
jest.mock("../ExerciseTimerModal", () => ({ ExerciseTimerModal: () => null }));

const baseProps = {
  exercise_id: 7,
  exerciseName: "Bench Press",
  animatedUrl: undefined,
  animatedImageLoading: false,
  animatedImageError: null,
  isLastSetOfLastExercise: false,
  isFirstSetOfFirstExercise: true,
  currentSetIndex: 1,
  totalSets: 4,
  weight: "80",
  reps: "8",
  time: "",
  weightIncrement: 2.5,
  buttonSize: 40,
  weightUnit: "kg",
  restMinutes: 1,
  restSeconds: 30,
  repsMin: 6,
  repsMax: 10,
  timeMin: undefined,
  currentSetCompleted: false,
  isWarmup: false,
  isDropSet: false,
  isToFailure: false,
  trackingType: "weight",
  distance: "",
  distanceUnit: "km",
  distanceMin: undefined,
  handleWeightInputChange: jest.fn(),
  handleWeightChange: jest.fn(),
  handleRepsInputChange: jest.fn(),
  handleRepsChange: jest.fn(),
  handleTimeInputChange: jest.fn(),
  handleDistanceInputChange: jest.fn(),
  handleDistanceChange: jest.fn(),
  handlePreviousSet: jest.fn(),
  handleNextSet: jest.fn(),
  handleCompleteSet: jest.fn(),
  removeSet: jest.fn(),
  addSet: jest.fn(),
  onAddDropSet: jest.fn(),
  onToggleSetType: jest.fn(),
};

describe("SessionSetInfo accessibility", () => {
  beforeEach(() => jest.clearAllMocks());

  it("labels the weight and reps inputs with the unit and set number", () => {
    const { getByLabelText } = render(<SessionSetInfo {...baseProps} />);
    expect(getByLabelText("Weight in kg, set 2")).toBeTruthy();
    expect(getByLabelText("Reps, set 2")).toBeTruthy();
  });

  it("labels the increment buttons with the step and unit", () => {
    const { getByRole } = render(<SessionSetInfo {...baseProps} />);
    fireEvent.press(getByRole("button", { name: "Increase weight by 2.5 kg" }));
    expect(baseProps.handleWeightChange).toHaveBeenCalledWith(2.5);
    fireEvent.press(getByRole("button", { name: "Decrease weight by 2.5 kg" }));
    expect(baseProps.handleWeightChange).toHaveBeenCalledWith(-2.5);
    fireEvent.press(getByRole("button", { name: "Increase reps by 1" }));
    expect(baseProps.handleRepsChange).toHaveBeenCalledWith(1);
    fireEvent.press(getByRole("button", { name: "Decrease reps by 1" }));
    expect(baseProps.handleRepsChange).toHaveBeenCalledWith(-1);
  });

  it("names the complete button after the set it completes", () => {
    const { getByRole } = render(<SessionSetInfo {...baseProps} />);
    fireEvent.press(getByRole("button", { name: "Complete set 2 of 4" }));
    expect(baseProps.handleCompleteSet).toHaveBeenCalled();
  });

  it("names the button as an update once the set is complete", () => {
    const { getByRole } = render(
      <SessionSetInfo {...baseProps} currentSetCompleted />,
    );
    expect(getByRole("button", { name: "Update set 2 of 4" })).toBeTruthy();
  });

  it("exposes the set navigation buttons and their disabled state", () => {
    const { getByRole } = render(<SessionSetInfo {...baseProps} />);
    expect(getByRole("button", { name: "Previous set" })).toBeDisabled();
    const next = getByRole("button", { name: "Next set" });
    expect(next).toBeEnabled();
    fireEvent.press(next);
    expect(baseProps.handleNextSet).toHaveBeenCalled();
  });

  it("labels the set menu and the exercise image", () => {
    const { getByRole } = render(<SessionSetInfo {...baseProps} />);
    expect(getByRole("button", { name: "Set options" })).toBeTruthy();
    expect(
      getByRole("button", { name: "Exercise details for Bench Press" }),
    ).toBeTruthy();
  });

  it("labels the assistance input for assisted exercises", () => {
    const { getByLabelText } = render(
      <SessionSetInfo {...baseProps} trackingType="assisted" />,
    );
    expect(getByLabelText("Assistance in kg, set 2")).toBeTruthy();
  });

  it("labels the distance input and its buttons", () => {
    const { getByLabelText, getByRole } = render(
      <SessionSetInfo {...baseProps} trackingType="distance" />,
    );
    expect(getByLabelText("Distance in km, set 2")).toBeTruthy();
    expect(
      getByRole("button", { name: "Increase distance by 1 km" }),
    ).toBeTruthy();
    expect(
      getByRole("button", { name: "Decrease distance by 1 km" }),
    ).toBeTruthy();
  });

  it("labels the time fields with the set number", () => {
    const { getByLabelText } = render(
      <SessionSetInfo {...baseProps} trackingType="time" time="1:30" />,
    );
    expect(getByLabelText("Time, set 2, minutes")).toBeTruthy();
    expect(getByLabelText("Time, set 2, seconds")).toBeTruthy();
  });

  it("lets the large complete button grow with the text size", () => {
    const { StyleSheet } = require("react-native");
    const { getByRole } = render(
      <SessionSetInfo {...baseProps} buttonSize={60} />,
    );
    // Paper puts the style on an outer wrapper; look up the tree for it.
    let node: any = getByRole("button", { name: "Complete set 2 of 4" });
    const styles: any[] = [];
    while (node) {
      styles.push(StyleSheet.flatten(node.props.style) ?? {});
      node = node.parent;
    }
    expect(styles.some((s) => s.minHeight === 55)).toBe(true);
    expect(styles.some((s) => s.height === 55)).toBe(false);
  });
});
