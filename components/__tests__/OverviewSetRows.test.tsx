import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import {
  OverviewSetRows,
  SupersetRoundRows,
  setRowLabel,
} from "../workout/OverviewSetRows";

jest.mock("react-native-sortables", () => {
  const { Pressable } = require("react-native");
  return {
    __esModule: true,
    default: {
      Touchable: ({ onTap, children, ...props }: any) => (
        <Pressable onPress={onTap} {...props}>
          {children}
        </Pressable>
      ),
    },
  };
});
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce(
      (acc, part, i) => acc + part + (i < v.length ? String(v[i]) : ""),
      "",
    ),
  plural: (n: number, { one, other }: any) =>
    (n === 1 ? one : other).replace("#", String(n)),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/ThemedText", () => {
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
      onAccent: "#000",
      success: "#0f0",
      badgeWarmup: "#00f",
      badgeDrop: "#f0f",
      badgeFailure: "#f00",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));

const set = (extra: object = {}) => ({
  repsMin: 8,
  repsMax: 12,
  restMinutes: 1,
  restSeconds: 30,
  ...extra,
});
const bench = {
  exercise_id: 1,
  name: "Bench",
  tracking_type: "weight",
  sets: [set({ isWarmup: true }), set(), set({ isToFailure: true })],
} as any;

const values: Record<string, { weight: string; reps: string }> = {
  "0:0": { weight: "40", reps: "10" },
  "0:1": { weight: "60", reps: "8" },
  "0:2": { weight: "", reps: "" },
};

function renderRows(overrides: object = {}) {
  const props = {
    getValues: (e: number, s: number) => ({
      time: "",
      distance: "",
      ...values[`${e}:${s}`],
    }),
    completedSets: { 0: { 0: true } },
    sessionPRs: { 0: [1] },
    weightUnit: "kg",
    distanceUnit: "m",
    onOpenSet: jest.fn(),
    onCompleteSet: jest.fn(),
    ...overrides,
  };
  const screen = render(
    <OverviewSetRows exercise={bench} exerciseIndex={0} {...props} />,
  );
  return { screen, ...props };
}

describe("OverviewSetRows", () => {
  it("shows each set's values, markers and PR", () => {
    const { screen } = renderRows();
    expect(screen.getByText("40 kg × 10")).toBeTruthy();
    expect(screen.getByText("60 kg × 8")).toBeTruthy();
    expect(screen.getByText("–")).toBeTruthy();
    expect(screen.getByText("Warm-up")).toBeTruthy();
    expect(screen.getByText("To failure")).toBeTruthy();
    expect(screen.getByText("PR")).toBeTruthy();
  });

  it("labels a row for screen readers", () => {
    const { screen } = renderRows();
    expect(
      screen.getByLabelText(
        "Set 2, 60 kilograms, 8 reps, not completed, New personal record",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Set 1, 40 kilograms, 10 reps, completed, Warm-up"),
    ).toBeTruthy();
  });

  it("opens a set on tap and completes it from its check", () => {
    const { screen, onOpenSet, onCompleteSet } = renderRows();
    fireEvent.press(screen.getByText("60 kg × 8"));
    expect(onOpenSet).toHaveBeenCalledWith({ exerciseIndex: 0, setIndex: 1 });
    fireEvent.press(screen.getByLabelText("Complete set 2"));
    expect(onCompleteSet).toHaveBeenCalledWith({
      exerciseIndex: 0,
      setIndex: 1,
    });
  });

  it("does not complete a set twice", () => {
    const { screen, onCompleteSet } = renderRows();
    fireEvent.press(screen.getByLabelText("Complete set 1"));
    expect(onCompleteSet).not.toHaveBeenCalled();
  });
});

describe("SupersetRoundRows", () => {
  it("groups both exercises' sets by round", () => {
    const curl = {
      exercise_id: 2,
      name: "Curl",
      tracking_type: "weight",
      sets: [set(), set()],
    } as any;
    const pushdown = { ...curl, exercise_id: 3, name: "Push-down" };
    const onCompleteSet = jest.fn();
    const screen = render(
      <SupersetRoundRows
        exercises={[curl, pushdown]}
        exerciseIndices={[0, 1]}
        names={["Curl", "Push-down"]}
        getValues={(e) => ({
          weight: e === 0 ? "12" : "20",
          reps: e === 0 ? "15" : "12",
          time: "",
          distance: "",
        })}
        completedSets={{ 0: { 0: true } }}
        sessionPRs={{}}
        weightUnit="kg"
        distanceUnit="m"
        onOpenSet={jest.fn()}
        onCompleteSet={onCompleteSet}
      />,
    );
    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(screen.getByText("Round 2")).toBeTruthy();
    expect(screen.getAllByText("12 kg × 15")).toHaveLength(2);
    expect(screen.getAllByText("20 kg × 12")).toHaveLength(2);
    fireEvent.press(screen.getAllByLabelText("Complete set 1")[1]);
    expect(onCompleteSet).toHaveBeenCalledWith({
      exerciseIndex: 1,
      setIndex: 0,
    });
  });
});

describe("setRowLabel", () => {
  it("leaves out missing values", () => {
    expect(setRowLabel(3, undefined, false)).toBe("Set 3, not completed");
  });
});
