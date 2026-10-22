import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Onboarding, {
  shouldShowActivationCard,
  tipIndexForDay,
  TIPS,
} from "../Onboarding";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";

const mockPush = jest.fn();
const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));
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
jest.mock("@/components/ui/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/ui/AppIconButton", () => {
  const { Pressable } = require("react-native");
  return {
    AppIconButton: ({ onPress, accessibilityLabel }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
      />
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

    expect(mockRouterPush).toHaveBeenCalledWith(
      {
        pathname: "/(app)/(tabs)/(plans)/overview",
        params: { planId: "11" },
      },
      { withAnchor: true },
    );
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
    expect(getByText("Tips")).toBeTruthy();
  });

  it("shows one tip at a time and steps to the next", () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 12, 9) });
    try {
      const first = tipIndexForDay(new Date(), TIPS.length);
      const second = (first + 1) % TIPS.length;
      const { getByText, queryByText, getByLabelText } = render(<Onboarding />);

      expect(getByText(TIPS[first].title as any)).toBeTruthy();
      expect(queryByText(TIPS[second].title as any)).toBeNull();

      fireEvent.press(getByLabelText("Next tip"));
      expect(getByText(TIPS[second].title as any)).toBeTruthy();
      fireEvent.press(getByText(TIPS[second].link as any));
      expect(mockPush).toHaveBeenCalledWith(TIPS[second].route);
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not offer the settings card, since setup covers it", () => {
    const { queryByText } = render(<Onboarding />);
    expect(queryByText("Customise your settings")).toBeNull();
  });

  it("hides the tips from their close button, and leaves them out when off", () => {
    const onHideTips = jest.fn();
    const { getByLabelText, getByText, rerender, queryByText } = render(
      <Onboarding onHideTips={onHideTips} />,
    );
    fireEvent.press(getByLabelText("Hide tips"));
    expect(onHideTips).toHaveBeenCalled();

    rerender(<Onboarding showActivationCard showTips={false} />);
    expect(queryByText("Tips")).toBeNull();
    expect(getByText("Pick a plan to get started")).toBeTruthy();
  });

  it("no longer has a Hide / Show Onboarding card", () => {
    const { queryByText } = render(
      <Onboarding showActivationCard onQuickWorkout={jest.fn()} />,
    );
    expect(queryByText("Hide / Show Onboarding")).toBeNull();
  });
});

describe("tipIndexForDay", () => {
  it("keeps the tip all day and moves on the next day", () => {
    const morning = tipIndexForDay(new Date(2026, 9, 12, 0, 5), 6);
    expect(tipIndexForDay(new Date(2026, 9, 12, 23, 55), 6)).toBe(morning);
    expect(tipIndexForDay(new Date(2026, 9, 13, 0, 5), 6)).toBe(
      (morning + 1) % 6,
    );
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
