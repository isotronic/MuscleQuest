import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PrivacySettings } from "../PrivacySettings";
import { AuthContext } from "@/context/AuthProvider";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/context/AuthProvider", () => {
  const { createContext } = require("react");
  return { AuthContext: createContext(null) };
});
const mockUpdatePrivacy = jest.fn();
jest.mock("@/hooks/usePrivacySettingsMutation", () => ({
  usePrivacySettingsMutation: () => ({ mutate: mockUpdatePrivacy }),
}));
// A stable object: the component copies it into state whenever it changes.
const mockSocialState = {
  privacySettings: {
    sharePlans: true,
    shareStandaloneWorkouts: false,
    shareCustomExercises: false,
    shareCompletedWorkouts: false,
    shareBodyMeasurements: false,
    shareStrengthProgress: false,
  },
  setPendingRevocation: jest.fn(),
};
jest.mock("@/store/socialStore", () => ({
  useSocialStore: () => mockSocialState,
}));
jest.mock("@/utils/sharing", () => ({
  bulkPublishAllPlans: jest.fn(() => Promise.resolve()),
  bulkPublishAllStandaloneWorkouts: jest.fn(() => Promise.resolve()),
  bulkPublishAllCustomExercises: jest.fn(() => Promise.resolve()),
  deleteAllSharedData: jest.fn(),
  SharedDataDeletionError: class extends Error {},
}));

const renderSettings = () =>
  render(
    <AuthContext.Provider value={{ uid: "u1" } as any}>
      <PrivacySettings hideDeleteSection />
    </AuthContext.Provider>,
  );

describe("PrivacySettings accessibility", () => {
  it("exposes each sharing row as one switch with its state", () => {
    const { getByRole } = renderSettings();
    expect(
      getByRole("switch", { name: /^Share plans with friends/ }),
    ).toBeChecked();
    expect(
      getByRole("switch", { name: /^Share completed workouts with friends/ }),
    ).not.toBeChecked();
  });

  it("toggles when the row is activated", () => {
    const { getByRole } = renderSettings();
    fireEvent.press(
      getByRole("switch", { name: /^Share completed workouts with friends/ }),
    );
    expect(mockUpdatePrivacy).toHaveBeenCalledWith({
      shareCompletedWorkouts: true,
    });
  });
});
