import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { WorkoutBarChart } from "../WorkoutBarChart";
import { VolumeBarChart } from "../VolumeBarChart";
import BodyPartChart from "../BodyPartChart";
import { ExerciseProgressionChart } from "../ExerciseProgressionChart";
import { BodyMeasurementLineChart } from "../BodyMeasurementLineChart";
import { ExerciseCompactCard } from "@/components/stats/ExerciseCompactCard";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import type { TrackedExerciseWithSets } from "@/hooks/useTrackedExercisesQuery";

const mockChartProps: Record<string, any> = {};
jest.mock("react-native-gifted-charts", () => ({
  LineChart: (props: any) => ((mockChartProps.LineChart = props), null),
  BarChart: (props: any) => ((mockChartProps.BarChart = props), null),
  PieChart: (props: any) => ((mockChartProps.PieChart = props), null),
}));
const mockReducedMotion = jest.fn(() => false);
jest.mock("react-native-reanimated", () => ({
  useReducedMotion: () => mockReducedMotion(),
}));
jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  const Stub = (props: any) => <View {...props} />;
  return {
    __esModule: true,
    default: Stub,
    Svg: Stub,
    Defs: Stub,
    LinearGradient: Stub,
    Stop: Stub,
    Polygon: Stub,
    Polyline: Stub,
  };
});
jest.mock("react-native-sortables", () => ({
  __esModule: true,
  default: { Touchable: (props: any) => props.children },
}));
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));
jest.mock("@lingui/core/macro", () => ({
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));

// 2026-05-25 is a Monday; local noon keeps every bucket on the same day.
const FIXED_NOW = new Date(2026, 4, 25, 12, 0, 0);
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterEach(() => jest.useRealTimers());

const workout = (
  localDate: string,
  sets: { exercise_id: number; weight: number; reps: number }[],
): CompletedWorkout =>
  ({
    id: 1,
    local_date: localDate,
    date_completed: `${localDate}T10:00:00.000Z`,
    exercises: sets.map((s, i) => ({
      completed_exercise_id: i,
      exercise_id: s.exercise_id,
      exercise_name: "x",
      exercise_tracking_type: "weight",
      sets: [
        {
          set_id: i,
          set_number: 1,
          weight: s.weight,
          reps: s.reps,
          time: null,
          distance: null,
          is_warmup: 0,
        },
      ],
    })),
  }) as unknown as CompletedWorkout;

const workouts = [
  workout("2026-05-19", [{ exercise_id: 1, weight: 100, reps: 5 }]),
  workout("2026-05-21", [
    { exercise_id: 1, weight: 100, reps: 5 },
    { exercise_id: 2, weight: 50, reps: 10 },
  ]),
];

describe("chart text alternatives", () => {
  it("summarises workouts per period", () => {
    const { getByRole } = render(
      <WorkoutBarChart completedWorkouts={workouts} timeRange="30" />,
    );
    expect(
      getByRole("image", { name: /^Workouts, last 30 days: 2 in total/ }),
    ).toBeTruthy();
  });

  it("summarises volume per period with its unit", () => {
    const { getByRole } = render(
      <VolumeBarChart
        completedWorkouts={workouts}
        timeRange="30"
        weightUnit="kg"
      />,
    );
    expect(
      getByRole("image", {
        name: /^Volume, last 30 days: 1.5 tonnes in total/,
      }),
    ).toBeTruthy();
  });

  it("lists the training split and prints each share beside its colour", () => {
    const exercises = [
      { exercise_id: 1, body_part: "chest" },
      { exercise_id: 2, body_part: "back" },
    ] as any;
    const { getByRole, getByText } = render(
      <BodyPartChart completedWorkouts={workouts} exercises={exercises} />,
    );
    expect(
      getByRole("image", {
        name: "Training split by sets: chest 66.7%, back 33.3%.",
      }),
    ).toBeTruthy();
    // Colour is not the only way to tell slices apart.
    // The legend is hidden from screen readers, which hear the chart label.
    expect(
      getByText("chest 66.7%", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("describes an exercise's progress", () => {
    const exercise = {
      exercise_id: 1,
      name: "Bench Press",
      tracking_type: "weight",
      allTimePR: 110,
      completed_sets: [
        {
          date_completed: "2026-05-21",
          progressionMetric: 105,
          oneRepMax: 105,
          weight: 90,
          reps: 5,
        },
        {
          date_completed: "2026-05-05",
          progressionMetric: 95,
          oneRepMax: 95,
          weight: 80,
          reps: 5,
        },
      ],
    } as unknown as TrackedExerciseWithSets;
    const { getByRole } = render(
      <ExerciseProgressionChart
        exercise={exercise}
        timeRange="30"
        weightUnit="kg"
        distanceUnit="km"
      />,
    );
    expect(
      getByRole("image", {
        name: "Bench Press, estimated one-rep max, last 30 days: from 95 to 105 kg, trending up.",
      }),
    ).toBeTruthy();
  });

  it("describes a body measurement series", () => {
    const { getByRole } = render(
      <BodyMeasurementLineChart
        data={[
          {
            recorded_at: "2026-05-04T08:00:00.000Z",
            local_date: "2026-05-04",
            displayValue: 82,
          },
          {
            recorded_at: "2026-05-20T08:00:00.000Z",
            local_date: "2026-05-20",
            displayValue: 80.5,
          },
        ]}
        timeRange="30"
        unit="kg"
        metricLabel="Body Weight"
      />,
    );
    expect(
      getByRole("image", {
        name: "Body Weight, last 30 days: from 82 to 80.5 kg, holding steady.",
      }),
    ).toBeTruthy();
  });

  it("reads an exercise card as one sentence without the decorations", () => {
    const exercise = {
      exercise_id: 1,
      name: "Squat",
      tracking_type: "weight",
      allTimePR: 140,
      completed_sets: [
        { date_completed: "2026-05-22", progressionMetric: 140, weight: 120 },
        { date_completed: "2026-05-15", progressionMetric: 135, weight: 115 },
      ],
    } as unknown as TrackedExerciseWithSets;
    const { getByRole } = render(
      <ExerciseCompactCard
        exercise={exercise}
        weightUnit="kg"
        distanceUnit="km"
        onPress={jest.fn()}
      />,
    );
    const card = getByRole("button", { name: /^Squat, / });
    expect(card.props.accessibilityLabel).not.toContain("›");
    expect(card.props.accessibilityLabel).toContain("3 days ago");
  });

  it("can show the progression series as a table", () => {
    const exercise = {
      exercise_id: 1,
      name: "Bench Press",
      tracking_type: "weight",
      allTimePR: 110,
      completed_sets: [
        {
          date_completed: "2026-05-21",
          progressionMetric: 105,
          oneRepMax: 105,
        },
        { date_completed: "2026-05-05", progressionMetric: 95, oneRepMax: 95 },
      ],
    } as unknown as TrackedExerciseWithSets;
    const { getByRole, queryByRole, getByLabelText } = render(
      <ExerciseProgressionChart
        exercise={exercise}
        timeRange="30"
        weightUnit="kg"
        distanceUnit="km"
        showTableToggle
      />,
    );
    fireEvent.press(getByRole("button", { name: "Show as table" }));
    expect(queryByRole("image")).toBeNull();
    expect(getByLabelText("4 May: 95 kg")).toBeTruthy();
    expect(getByLabelText("18 May: 105 kg")).toBeTruthy();
    fireEvent.press(getByRole("button", { name: "Show as chart" }));
    expect(getByRole("image")).toBeTruthy();
  });

  it("offers no table toggle unless asked", () => {
    const exercise = {
      exercise_id: 1,
      name: "Bench Press",
      tracking_type: "weight",
      allTimePR: 110,
      completed_sets: [],
    } as unknown as TrackedExerciseWithSets;
    const { queryByRole } = render(
      <ExerciseProgressionChart
        exercise={exercise}
        timeRange="30"
        weightUnit="kg"
        distanceUnit="km"
      />,
    );
    expect(queryByRole("button", { name: "Show as table" })).toBeNull();
  });

  it("does not animate charts when the system asks for reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<WorkoutBarChart completedWorkouts={workouts} timeRange="30" />);
    expect(mockChartProps.BarChart.isAnimated).toBe(false);
    mockReducedMotion.mockReturnValue(false);
    render(<WorkoutBarChart completedWorkouts={workouts} timeRange="30" />);
    expect(mockChartProps.BarChart.isAnimated).toBe(true);
  });
});
