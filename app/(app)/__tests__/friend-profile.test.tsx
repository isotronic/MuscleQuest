import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import FriendProfileScreen from "../friend-profile";

import { useFriendSharedPlansQuery } from "@/hooks/useFriendSharedPlansQuery";
import { useFriendSharedStandaloneWorkoutsQuery } from "@/hooks/useFriendSharedStandaloneWorkoutsQuery";
import { useFriendSharedCustomExercisesQuery } from "@/hooks/useFriendSharedCustomExercisesQuery";
import { useFriendSharedCompletedWorkoutsQuery } from "@/hooks/useFriendSharedCompletedWorkoutsQuery";
import { useFriendSharedMeasurementsQuery } from "@/hooks/useFriendSharedMeasurementsQuery";
import { useFriendSharedStrengthQuery } from "@/hooks/useFriendSharedStrengthQuery";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useFriendCompletedWorkoutCountQuery } from "@/hooks/useFriendCompletedWorkoutCountQuery";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  plural: (n: number, opts: Record<string, string>) =>
    (n === 1 ? opts.one : opts.other).replace("#", String(n)),
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/utils/relativeTime", () => ({
  formatTimeAgo: () => "vor einiger Zeit",
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ friendUid: "friend-1" }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("react-native-paper", () => {
  const { View } = require("react-native");
  return {
    Avatar: {
      Image: (props: any) => <View {...props} />,
      Text: (props: any) => <View {...props} />,
    },
  };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      surface: "#fff",
      card: "#eee",
      accentBorder: "#ddd",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
      accentSubtle: "#fee",
      danger: "#c00",
    },
    borders: { divider: "#eee" },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 20, full: 999 },
}));
jest.mock("@/components/ui", () => {
  const { Text } = require("react-native");
  return {
    AppText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
    AppIcon: () => null,
  };
});
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext({ uid: "me" }) };
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: () => ({ friends: [] }),
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { weightUnit: "kg" } }),
}));
jest.mock("@/hooks/useImportPlanMutation", () => ({
  useImportPlanMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/hooks/useImportStandaloneWorkoutMutation", () => ({
  useImportStandaloneWorkoutMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));
jest.mock("@/hooks/useImportCustomExerciseMutation", () => ({
  useImportCustomExerciseMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

const loadedEmpty = { data: [], isLoading: false, isError: false };
jest.mock("@/hooks/useFriendSharedStandaloneWorkoutsQuery", () => ({
  useFriendSharedStandaloneWorkoutsQuery: jest.fn(),
}));
jest.mock("@/hooks/useFriendSharedCustomExercisesQuery", () => ({
  useFriendSharedCustomExercisesQuery: jest.fn(),
}));
jest.mock("@/hooks/useFriendSharedCompletedWorkoutsQuery", () => ({
  useFriendSharedCompletedWorkoutsQuery: jest.fn(),
}));
jest.mock("@/hooks/useFriendCompletedWorkoutCountQuery", () => ({
  useFriendCompletedWorkoutCountQuery: jest.fn(() => ({
    data: undefined,
    refetch: jest.fn(),
  })),
}));
jest.mock("@/hooks/useFriendSharedMeasurementsQuery", () => ({
  useFriendSharedMeasurementsQuery: jest.fn(),
}));
jest.mock("@/hooks/useFriendSharedStrengthQuery", () => ({
  useFriendSharedStrengthQuery: jest.fn(),
}));
jest.mock("@/hooks/useIsOnline", () => ({ useIsOnline: jest.fn(() => true) }));
jest.mock("@/hooks/useFriendSharedPlansQuery", () => ({
  useFriendSharedPlansQuery: jest.fn(),
}));

describe("FriendProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useFriendSharedStandaloneWorkoutsQuery as jest.Mock).mockReturnValue(
      loadedEmpty,
    );
    (useFriendSharedCustomExercisesQuery as jest.Mock).mockReturnValue(
      loadedEmpty,
    );
    (useFriendSharedCompletedWorkoutsQuery as jest.Mock).mockReturnValue(
      loadedEmpty,
    );
    (useFriendSharedMeasurementsQuery as jest.Mock).mockReturnValue(
      loadedEmpty,
    );
    (useFriendSharedStrengthQuery as jest.Mock).mockReturnValue(loadedEmpty);
  });

  it("shows an error message instead of a silent empty state when the plans query fails", () => {
    (useFriendSharedPlansQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    const { getByText, getByTestId, queryByText } = render(
      <FriendProfileScreen />,
    );
    fireEvent.press(getByTestId("section-toggle-plans"));

    expect(queryByText("No plans shared yet")).toBeNull();
    expect(getByText("Couldn't load plans")).toBeTruthy();
  });

  it("shows the empty state (not an error) when the plans query genuinely has no data", () => {
    (useFriendSharedPlansQuery as jest.Mock).mockReturnValue(loadedEmpty);

    const { getByText, getByTestId } = render(<FriendProfileScreen />);
    fireEvent.press(getByTestId("section-toggle-plans"));

    expect(getByText("No plans shared yet")).toBeTruthy();
  });

  it("shows the offline banner while offline", () => {
    (useFriendSharedPlansQuery as jest.Mock).mockReturnValue(loadedEmpty);
    (useIsOnline as jest.Mock).mockReturnValueOnce(false);

    const { getByText } = render(<FriendProfileScreen />);

    expect(
      getByText(
        "You're offline. Friends and shared content will load when you reconnect. Training and logging still work.",
      ),
    ).toBeTruthy();
  });

  it("refetches every shared-content query on pull-to-refresh", async () => {
    const refetches = Array.from({ length: 6 }, () =>
      jest.fn().mockResolvedValue(undefined),
    );
    [
      useFriendSharedPlansQuery,
      useFriendSharedStandaloneWorkoutsQuery,
      useFriendSharedCustomExercisesQuery,
      useFriendSharedCompletedWorkoutsQuery,
      useFriendSharedMeasurementsQuery,
      useFriendSharedStrengthQuery,
    ].forEach((hook, i) =>
      (hook as jest.Mock).mockReturnValue({
        ...loadedEmpty,
        refetch: refetches[i],
      }),
    );

    const { getByTestId } = render(<FriendProfileScreen />);
    await act(async () => {
      await getByTestId(
        "friend-profile-scroll",
      ).props.refreshControl.props.onRefresh();
    });

    refetches.forEach((refetch) => expect(refetch).toHaveBeenCalledTimes(1));
  });

  // The list only holds the recent workouts, so the stat needs the total.
  it("shows the server count of shared workouts", () => {
    (useFriendSharedPlansQuery as jest.Mock).mockReturnValue(loadedEmpty);
    (useFriendCompletedWorkoutCountQuery as jest.Mock).mockReturnValue({
      data: 137,
      refetch: jest.fn(),
    });

    const { getByText } = render(<FriendProfileScreen />);

    expect(getByText("137")).toBeTruthy();
  });

  describe("collapsible sections", () => {
    const timestamp = { toDate: () => new Date(2026, 0, 15, 12) };
    const plan = {
      localPlanId: 1,
      name: "Push Pull Legs",
      updatedAt: timestamp,
    };

    beforeEach(() => {
      (useFriendSharedPlansQuery as jest.Mock).mockReturnValue({
        ...loadedEmpty,
        data: [plan],
      });
    });

    it("starts with every section collapsed and shows the item count", () => {
      const { getByText, getByTestId, queryByText } = render(
        <FriendProfileScreen />,
      );

      expect(getByText("Plans (1)")).toBeTruthy();
      expect(queryByText("Push Pull Legs")).toBeNull();
      expect(queryByText("No strength data shared yet")).toBeNull();
      expect(
        getByTestId("section-toggle-plans").props.accessibilityState,
      ).toEqual({ expanded: false });
    });

    it("expands a section on tap and collapses it again, leaving others closed", () => {
      const { getByText, getByTestId, queryByText } = render(
        <FriendProfileScreen />,
      );

      fireEvent.press(getByTestId("section-toggle-plans"));
      expect(getByText("Push Pull Legs")).toBeTruthy();
      expect(
        getByTestId("section-toggle-plans").props.accessibilityState,
      ).toEqual({ expanded: true });
      expect(queryByText("No strength data shared yet")).toBeNull();

      fireEvent.press(getByTestId("section-toggle-plans"));
      expect(queryByText("Push Pull Legs")).toBeNull();
    });

    it("omits the count while a section is still loading", () => {
      (useFriendSharedPlansQuery as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      const { getByText } = render(<FriendProfileScreen />);

      expect(getByText("Plans")).toBeTruthy();
    });
  });

  describe("completed workout names", () => {
    const timestamp = { toDate: () => new Date(2026, 0, 15, 12) };
    const completed = (overrides: Record<string, unknown>) => ({
      localWorkoutId: 1,
      planName: "My Plan",
      workoutName: "Leg Day",
      dateCompleted: timestamp,
      ...overrides,
    });
    const renderActivity = (workout: Record<string, unknown>) => {
      (useFriendSharedPlansQuery as jest.Mock).mockReturnValue(loadedEmpty);
      (useFriendSharedCompletedWorkoutsQuery as jest.Mock).mockReturnValue({
        ...loadedEmpty,
        data: [workout],
      });
      const utils = render(<FriendProfileScreen />);
      fireEvent.press(utils.getByTestId("section-toggle-activity"));
      return utils;
    };

    it("shows the workout and plan name when both are present", () => {
      const { getByText } = renderActivity(completed({}));

      expect(getByText("Leg Day")).toBeTruthy();
      expect(getByText("My Plan · vor einiger Zeit")).toBeTruthy();
    });

    it("falls back to Quick workout when the workout has no name", () => {
      const { getByText } = renderActivity(completed({ workoutName: null }));

      expect(getByText("Quick workout")).toBeTruthy();
    });

    it("drops the plan name and separator when there is no plan", () => {
      const { getByText, queryByText } = renderActivity(
        completed({ planName: null, workoutName: null }),
      );

      expect(getByText("vor einiger Zeit")).toBeTruthy();
      expect(queryByText(/·/)).toBeNull();
    });
  });
});
