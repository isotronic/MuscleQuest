import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import TodayCard from "../home/TodayCard";
import type { TodayHero } from "@/utils/homeToday";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce(
      (acc, part, i) => acc + part + (i < v.length ? String(v[i]) : ""),
      "",
    ),
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
  const { Text, Pressable } = require("react-native");
  return {
    Button: ({ children, onPress, accessibilityLabel }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/components/ui/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/home/WorkoutDurationInfo", () => {
  const { Text } = require("react-native");
  return {
    WorkoutDurationInfo: ({ exercises }: any) => (
      <Text>{`${exercises.length} Exercises`}</Text>
    ),
  };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
      accent: "#fc0",
      accentSubtle: "#fc02",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));

const pullA = { id: 2, name: "Pull A", exercises: [{}, {}, {}] as any[] };

const workoutHero = (
  over: Partial<Extract<TodayHero, { kind: "workout" }>>,
): Extract<TodayHero, { kind: "workout" }> => ({
  kind: "workout",
  workout: pullA,
  workoutIndex: 1,
  restDay: false,
  scheduledToday: false,
  nextDow: null,
  lastDoneDaysAgo: null,
  ...over,
});

function renderCard(hero: Exclude<TodayHero, { kind: "done" }>) {
  const props = {
    onStart: jest.fn(),
    onOpen: jest.fn(),
    onBrowsePlans: jest.fn(),
  };
  const screen = render(
    <TodayCard
      hero={hero}
      planName="PPL"
      countUnilateralDouble={false}
      {...props}
    />,
  );
  return { screen, ...props };
}

describe("TodayCard", () => {
  it("shows today's scheduled workout with its details", () => {
    const { screen } = renderCard(
      workoutHero({ scheduledToday: true, lastDoneDaysAgo: 5 }),
    );
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Pull A")).toBeTruthy();
    expect(screen.getByText("3 Exercises")).toBeTruthy();
    expect(screen.getByText("Last done 5 days ago")).toBeTruthy();
  });

  it("names the next day on a rest day", () => {
    const { screen } = renderCard(workoutHero({ restDay: true, nextDow: 3 }));
    expect(screen.getByText("Rest day, next on Thursday")).toBeTruthy();
    expect(screen.getByText("Pull A")).toBeTruthy();
  });

  it("shows the next workout in rotation", () => {
    const { screen } = renderCard(workoutHero({ lastDoneDaysAgo: 1 }));
    expect(screen.getByText("Next up")).toBeTruthy();
    expect(screen.getByText("Last done yesterday")).toBeTruthy();
  });

  it("starts and opens the workout", () => {
    const { screen, onStart, onOpen } = renderCard(workoutHero({}));
    fireEvent.press(screen.getByLabelText("Start Pull A"));
    expect(onStart).toHaveBeenCalledWith(pullA, 1);
    fireEvent.press(screen.getByText("Pull A"));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("asks to pick a plan when there is none", () => {
    const { screen, onBrowsePlans } = renderCard({ kind: "noPlan" });
    expect(
      screen.getByText("Pick a plan or start a quick workout."),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("Explore plans"));
    expect(onBrowsePlans).toHaveBeenCalled();
  });
});
