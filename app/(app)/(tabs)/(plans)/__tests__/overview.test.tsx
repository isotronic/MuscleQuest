import React from "react";
import { render } from "@testing-library/react-native";
import PlanOverviewScreen from "../overview";
import { usePlanQuery } from "@/hooks/usePlanQuery";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce((acc, part, i) => acc + part + (i < v.length ? v[i] : ""), ""),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ planId: "7" }),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    Button: ({ children, onPress }: any) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Snackbar: () => null,
    Portal: ({ children }: any) => children,
    Modal: () => null,
    Switch: () => null,
    ActivityIndicator: () => <View />,
  };
});
jest.mock("@/components/ui", () => ({
  AppImage: () => null,
  AppIcon: () => null,
  AppIconButton: () => null,
}));
jest.mock("@/components/WeeklyScheduleDisplay", () => () => null);
jest.mock("@/components/Cues", () => ({ Cues: () => null }));
jest.mock("@/components/CopyWorkoutModal", () => ({
  CopyWorkoutModal: () => null,
}));
jest.mock("@/constants/PlanImages", () => ({ planImageSource: () => null }));
jest.mock("@/context/AuthProvider", () => ({
  AuthContext: require("react").createContext(null),
}));
jest.mock("@/utils/sharing", () => ({
  SharedDocTooLargeError: class extends Error {},
}));
jest.mock("@/hooks/usePlanQuery", () => ({ usePlanQuery: jest.fn() }));
jest.mock("@/hooks/usePlanScheduleQuery", () => ({
  usePlanScheduleQuery: () => ({ data: [] }),
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: {} }),
}));
const mutation = () => ({ mutate: jest.fn(), isPending: false });
jest.mock("@/hooks/useDeletePlanMutation", () => ({
  useDeletePlanMutation: () => mutation(),
}));
jest.mock("@/hooks/useSetActivePlanMutation", () => ({
  useSetActivePlanMutation: () => mutation(),
}));
jest.mock("@/hooks/useProgressionSettingsQuery", () => ({
  useProgressionSettingsQuery: () => ({ enabled: false }),
}));
jest.mock("@/hooks/useDeloadWeekQuery", () => ({
  useDeloadWeekQuery: () => ({ isCurrentWeekDeload: false }),
}));
jest.mock("@/hooks/useDeloadWeekMutation", () => ({
  useDeloadWeekMutation: () => mutation(),
}));
jest.mock("@/hooks/usePlanPublishMutation", () => ({
  usePlanPublishMutation: () => ({ ...mutation(), isError: false }),
}));
jest.mock("@/hooks/useCreateStandaloneWorkout", () => ({
  useCreateStandaloneWorkout: () => mutation(),
}));
jest.mock("@/hooks/useDuplicatePlanMutation", () => ({
  useDuplicatePlanMutation: () => mutation(),
}));
jest.mock("@/hooks/useWorkoutDurationEstimate", () => ({
  useWorkoutDurationEstimate: () => ({ estimate: null }),
}));
jest.mock("@/store/socialStore", () => ({
  useSocialStore: () => ({ publishedPlanIds: [] }),
}));

const withPlan = (is_active: number | boolean) =>
  (usePlanQuery as jest.Mock).mockReturnValue({
    data: { id: 7, name: "Push Pull", app_plan_id: 3, is_active, workouts: [] },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });

describe("PlanOverviewScreen", () => {
  it("offers Set as active plan for an inactive plan", () => {
    withPlan(0);
    const { getByText, queryByText } = render(<PlanOverviewScreen />);

    expect(getByText("Set as active plan")).toBeTruthy();
    expect(queryByText("Active plan")).toBeNull();
  });

  it.each([1, true])("shows the Active plan chip when is_active is %p", (v) => {
    withPlan(v);
    const { getByText, queryByText } = render(<PlanOverviewScreen />);

    expect(getByText("Active plan")).toBeTruthy();
    expect(queryByText("Set as active plan")).toBeNull();
  });

  it("shows the error state instead of a raw message", () => {
    (usePlanQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("SQLITE_BUSY"),
      refetch: jest.fn(),
    });
    const { getByText, queryByText } = render(<PlanOverviewScreen />);

    expect(getByText("Something went wrong loading this.")).toBeTruthy();
    expect(queryByText(/SQLITE_BUSY/)).toBeNull();
  });
});
