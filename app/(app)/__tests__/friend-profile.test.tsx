import React from "react";
import { render } from "@testing-library/react-native";
import FriendProfileScreen from "../friend-profile";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  plural: (n: number, opts: Record<string, string>) =>
    (n === 1 ? opts.one : opts.other).replace("#", String(n)),
}));
jest.mock("date-fns", () => ({
  formatDistanceToNow: () => "some time ago",
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
jest.mock("@/hooks/useFriendSharedMeasurementsQuery", () => ({
  useFriendSharedMeasurementsQuery: jest.fn(),
}));
jest.mock("@/hooks/useFriendSharedStrengthQuery", () => ({
  useFriendSharedStrengthQuery: jest.fn(),
}));
jest.mock("@/hooks/useFriendSharedPlansQuery", () => ({
  useFriendSharedPlansQuery: jest.fn(),
}));

import { useFriendSharedPlansQuery } from "@/hooks/useFriendSharedPlansQuery";
import { useFriendSharedStandaloneWorkoutsQuery } from "@/hooks/useFriendSharedStandaloneWorkoutsQuery";
import { useFriendSharedCustomExercisesQuery } from "@/hooks/useFriendSharedCustomExercisesQuery";
import { useFriendSharedCompletedWorkoutsQuery } from "@/hooks/useFriendSharedCompletedWorkoutsQuery";
import { useFriendSharedMeasurementsQuery } from "@/hooks/useFriendSharedMeasurementsQuery";
import { useFriendSharedStrengthQuery } from "@/hooks/useFriendSharedStrengthQuery";

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

    const { getByText, queryByText } = render(<FriendProfileScreen />);

    expect(queryByText("No plans shared yet")).toBeNull();
    expect(getByText("Couldn't load plans")).toBeTruthy();
  });

  it("shows the empty state (not an error) when the plans query genuinely has no data", () => {
    (useFriendSharedPlansQuery as jest.Mock).mockReturnValue(loadedEmpty);

    const { getByText } = render(<FriendProfileScreen />);

    expect(getByText("No plans shared yet")).toBeTruthy();
  });
});
