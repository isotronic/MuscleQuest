import React from "react";
import { render } from "@testing-library/react-native";
import { SettingsModal } from "../SettingsModal";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));

const baseProps = {
  visible: true,
  onCancel: jest.fn(),
  onSave: jest.fn(),
  onChangeValue: jest.fn(),
};

describe("SettingsModal accessibility", () => {
  it("names each radio option and reports the chosen one", () => {
    const { getByRole } = render(
      <SettingsModal
        {...baseProps}
        settingKey="weightUnit"
        settingType="radio"
        options={["kg", "lbs"]}
        inputValue="lbs"
      />,
    );
    expect(getByRole("radio", { name: "lbs" })).toBeChecked();
    expect(getByRole("radio", { name: "kg" })).not.toBeChecked();
  });

  it("announces the reminder time fields as hours and minutes", () => {
    const { getByLabelText } = render(
      <SettingsModal
        {...baseProps}
        settingKey="reminderTime"
        settingType="reminderTime"
        inputValue={{ hours: 7, minutes: 30 }}
      />,
    );
    expect(getByLabelText("Reminder time, hours")).toBeTruthy();
    expect(getByLabelText("Reminder time, minutes")).toBeTruthy();
  });

  it("names the rest time fields", () => {
    const { getByLabelText } = render(
      <SettingsModal
        {...baseProps}
        settingKey="defaultRestTime"
        settingType="restTime"
        inputValue={{ minutes: 1, seconds: 30 }}
      />,
    );
    expect(getByLabelText("Rest time, minutes")).toBeTruthy();
    expect(getByLabelText("Rest time, seconds")).toBeTruthy();
  });
});
