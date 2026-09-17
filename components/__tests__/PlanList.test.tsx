import React from "react";
import { render } from "@testing-library/react-native";
import { PlanList } from "../PlanList";
import type { Plan } from "@/hooks/useAllPlansQuery";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      contentSecondary: "#888",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/ui", () => ({
  AppIcon: () => null,
}));

const capturedListItemProps: any[] = [];
jest.mock("../TrainingPlanListItem", () => ({
  __esModule: true,
  default: (props: any) => {
    capturedListItemProps.push(props);
    return null;
  },
}));

const capturedCardProps: any[] = [];
jest.mock("../TrainingPlanCard", () => ({
  __esModule: true,
  default: (props: any) => {
    capturedCardProps.push(props);
    return null;
  },
}));

const plan = (id: number): Plan => ({
  id,
  name: `Plan ${id}`,
  image_url: "",
  is_active: 0,
  app_plan_id: null,
  workouts: [],
});

beforeEach(() => {
  capturedListItemProps.length = 0;
  capturedCardProps.length = 0;
});

describe("PlanList published badge", () => {
  it("shows the badge for a published plan in list view without needing a bulk-share flag", () => {
    render(
      <PlanList
        title="Your training plans"
        data={[plan(1), plan(2)]}
        onPressItem={() => {}}
        viewMode="list"
        publishedPlanIds={["1"]}
      />,
    );

    expect(capturedListItemProps[0].isPublished).toBe(true);
    expect(capturedListItemProps[1].isPublished).toBe(false);
  });

  it("shows the badge for a published plan in grid view without needing a bulk-share flag", () => {
    render(
      <PlanList
        title="Your training plans"
        data={[plan(1), plan(2)]}
        onPressItem={() => {}}
        viewMode="grid"
        publishedPlanIds={["2"]}
      />,
    );

    expect(capturedCardProps[0].isPublished).toBe(false);
    expect(capturedCardProps[1].isPublished).toBe(true);
  });

  it("does not show the badge when publishedPlanIds is absent", () => {
    render(
      <PlanList
        title="Your training plans"
        data={[plan(1)]}
        onPressItem={() => {}}
        viewMode="list"
      />,
    );

    expect(capturedListItemProps[0].isPublished).toBe(false);
  });
});
