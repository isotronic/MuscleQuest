import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Onboarding, { shouldShowActivationCard } from "../Onboarding";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
  msg: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (d: unknown) => d }),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  Plural: ({ value, one, other }: any) =>
    (value === 1 ? one : other).replace("#", String(value)),
}));
jest.mock("react-native-paper", () => {
  const { View, Text, Pressable } = require("react-native");
  const Card = ({ children }: any) => <View>{children}</View>;
  const CardContent = ({ children }: any) => <View>{children}</View>;
  Card.Content = CardContent;
  return {
    Card,
    Text,
    Button: ({ children, onPress }: any) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("../ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111",
      cardSecondary: "#222",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
      accent: "#fc0",
      accentBorder: "#fc04",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
jest.mock("@/hooks/useAllPlansQuery", () => ({ useAllPlansQuery: jest.fn() }));

const plan = (id: number, appId: number, name: string, days: number) => ({
  id,
  app_plan_id: appId,
  name,
  workouts: Array.from({ length: days }, (_, i) => ({ name: `Day ${i}` })),
});

describe("Onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAllPlansQuery as jest.Mock).mockReturnValue({
      data: {
        userPlans: [],
        appPlans: [
          plan(11, 1, "3-Day Full Body", 3),
          plan(12, 2, "4-Day Upper/Lower Split", 4),
          plan(13, 3, "5-Day Bro Split", 5),
          plan(15, 5, "Bodyweight (3 Days)", 3),
        ],
      },
    });
  });

  it("starts with a pick-a-plan card listing three beginner plans", () => {
    const { getByText, queryByText } = render(
      <Onboarding showActivationCard onQuickWorkout={jest.fn()} />,
    );

    expect(getByText("Pick a plan to get started")).toBeTruthy();
    expect(getByText("3-Day Full Body")).toBeTruthy();
    expect(getByText("4-Day Upper/Lower Split")).toBeTruthy();
    expect(getByText("Bodyweight (3 Days)")).toBeTruthy();
    expect(queryByText("5-Day Bro Split")).toBeNull();
    expect(getByText("4 days per week")).toBeTruthy();
  });

  it("opens the plan overview when a plan is tapped", () => {
    const { getByText } = render(
      <Onboarding showActivationCard onQuickWorkout={jest.fn()} />,
    );

    fireEvent.press(getByText("3-Day Full Body"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(plans)/overview",
      params: { planId: "11" },
    });
  });

  it("offers a quick workout instead", () => {
    const onQuickWorkout = jest.fn();
    const { getByText } = render(
      <Onboarding showActivationCard onQuickWorkout={onQuickWorkout} />,
    );

    fireEvent.press(getByText("Or start a quick workout"));

    expect(onQuickWorkout).toHaveBeenCalled();
  });

  it("leaves out the activation card once the user has trained", () => {
    const { queryByText, getByText } = render(
      <Onboarding showActivationCard={false} onQuickWorkout={jest.fn()} />,
    );

    expect(queryByText("Pick a plan to get started")).toBeNull();
    expect(getByText("Welcome to MuscleQuest")).toBeTruthy();
  });

  it("no longer has a Hide / Show Onboarding card", () => {
    const { queryByText } = render(
      <Onboarding showActivationCard onQuickWorkout={jest.fn()} />,
    );
    expect(queryByText("Hide / Show Onboarding")).toBeNull();
  });
});

describe("shouldShowActivationCard", () => {
  it("shows for a new user with no active plan and no workouts", () => {
    expect(shouldShowActivationCard(false, false)).toBe(true);
  });

  it("hides after one completed workout, even without an active plan", () => {
    expect(shouldShowActivationCard(false, true)).toBe(false);
  });

  it("hides while an active plan is set", () => {
    expect(shouldShowActivationCard(true, false)).toBe(false);
  });

  it("waits for workout history to load before showing", () => {
    expect(shouldShowActivationCard(false, undefined)).toBe(false);
  });
});
