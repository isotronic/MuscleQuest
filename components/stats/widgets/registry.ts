import type React from "react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import type { WidgetConfigs, WidgetId } from "@/utils/statsLayout";
import { TARGET_SET_OPTIONS } from "@/utils/statsLayout";
import { InsightsWidget } from "./InsightsWidget";
import { SummaryWidget } from "./SummaryWidget";
import { HistoryWidget } from "./HistoryWidget";
import { RecentPRsWidget } from "./RecentPRsWidget";
import { HeatmapWidget } from "./HeatmapWidget";
import { TrendWidget } from "./TrendWidget";
import { SplitWidget } from "./SplitWidget";
import { MuscleSetsWidget } from "./MuscleSetsWidget";
import { TrackedExercisesWidget } from "./TrackedExercisesWidget";
import { MeasurementsWidget } from "./MeasurementsWidget";

export interface FieldOption {
  value: string;
  label: MessageDescriptor;
}

/** One control on a widget's settings screen. */
export type EditorField<K extends WidgetId = WidgetId> = {
  key: keyof WidgetConfigs[K] & string;
  label: MessageDescriptor;
  description?: MessageDescriptor;
  /** Hidden while it would have no effect. */
  visibleWhen?: (config: WidgetConfigs[K]) => boolean;
} & (
  | { kind: "select"; options: FieldOption[] }
  | { kind: "multi"; options: FieldOption[] }
  | { kind: "switch" }
  | { kind: "number"; options: readonly number[] }
  /** The user's body metrics, loaded on the settings screen. */
  | { kind: "metricKeys" }
);

interface WidgetDefinition<K extends WidgetId> {
  title: MessageDescriptor;
  description: MessageDescriptor;
  Component: React.ComponentType<{ config: WidgetConfigs[K] }>;
  fields: EditorField<K>[];
}

const RANGE_FIELD = {
  key: "range",
  kind: "select",
  label: msg`Time range`,
  description: msg`Pin a range for this section, or follow the selector at the top.`,
  options: [
    { value: "global", label: msg`Same as screen` },
    { value: "30", label: msg`Last 30 days` },
    { value: "90", label: msg`Last 90 days` },
    { value: "365", label: msg`Last year` },
    { value: "0", label: msg`All time` },
  ],
} as const;

const GROUPING_OPTIONS: FieldOption[] = [
  { value: "bodyPart", label: msg`Body part` },
  { value: "muscle", label: msg`Target muscle` },
];

const TREND_FIELDS: EditorField<"trendA">[] = [
  {
    key: "metric",
    kind: "select",
    label: msg`Show`,
    options: [
      { value: "workouts", label: msg`Workouts` },
      { value: "volume", label: msg`Volume` },
      { value: "sets", label: msg`Sets` },
      { value: "reps", label: msg`Reps` },
      { value: "duration", label: msg`Training time` },
    ],
  },
  { ...RANGE_FIELD, options: [...RANGE_FIELD.options] },
];

export const WIDGETS: { [K in WidgetId]: WidgetDefinition<K> } = {
  insights: {
    title: msg`Insights`,
    description: msg`Highlights such as your streak and best gain`,
    Component: InsightsWidget,
    fields: [
      {
        key: "pills",
        kind: "multi",
        label: msg`Show`,
        options: [
          { value: "perWeek", label: msg`Workouts per week` },
          { value: "bestGain", label: msg`Best gain` },
          { value: "mostTrained", label: msg`Most trained` },
          { value: "streak", label: msg`Week streak` },
        ],
      },
    ],
  },
  summary: {
    title: msg`Summary`,
    description: msg`Totals compared with the previous period`,
    Component: SummaryWidget,
    fields: [
      {
        key: "tiles",
        kind: "multi",
        label: msg`Tiles`,
        options: [
          { value: "workouts", label: msg`Workouts` },
          { value: "volume", label: msg`Volume` },
          { value: "totalTime", label: msg`Total time` },
          { value: "avgDuration", label: msg`Average duration` },
          { value: "sets", label: msg`Sets` },
          { value: "reps", label: msg`Reps` },
          { value: "trainingDays", label: msg`Training days` },
          { value: "avgSets", label: msg`Average sets per workout` },
        ],
      },
    ],
  },
  history: {
    title: msg`Workout History`,
    description: msg`Recent workouts and the calendar`,
    Component: HistoryWidget,
    fields: [
      {
        key: "limit",
        kind: "select",
        label: msg`Workouts shown`,
        options: [
          { value: "all", label: msg`All in the period` },
          { value: "5", label: msg`Latest 5` },
          { value: "10", label: msg`Latest 10` },
        ],
      },
    ],
  },
  recentPRs: {
    title: msg`Recent PRs`,
    description: msg`New personal records`,
    Component: RecentPRsWidget,
    fields: [
      {
        key: "scope",
        kind: "select",
        label: msg`Exercises`,
        options: [
          { value: "all", label: msg`All exercises` },
          { value: "tracked", label: msg`Pinned exercises only` },
        ],
      },
      {
        key: "limit",
        kind: "select",
        label: msg`Records shown`,
        options: [
          { value: "5", label: msg`5` },
          { value: "10", label: msg`10` },
        ],
      },
      { ...RANGE_FIELD, options: [...RANGE_FIELD.options] },
    ],
  },
  heatmap: {
    title: msg`Consistency`,
    description: msg`Every training day at a glance`,
    Component: HeatmapWidget,
    fields: [
      {
        key: "intensity",
        kind: "select",
        label: msg`Shade days by`,
        options: [
          { value: "presence", label: msg`Trained or not` },
          { value: "sets", label: msg`Sets` },
          { value: "volume", label: msg`Volume` },
        ],
      },
      { ...RANGE_FIELD, options: [...RANGE_FIELD.options] },
    ],
  },
  trendA: {
    title: msg`Trend chart 1`,
    description: msg`A weekly chart of the metric you pick`,
    Component: TrendWidget,
    fields: TREND_FIELDS,
  },
  trendB: {
    title: msg`Trend chart 2`,
    description: msg`A weekly chart of the metric you pick`,
    Component: TrendWidget,
    fields: TREND_FIELDS as EditorField<"trendB">[],
  },
  split: {
    title: msg`Training Split`,
    description: msg`How your training is shared out`,
    Component: SplitWidget,
    fields: [
      {
        key: "groupBy",
        kind: "select",
        label: msg`Group by`,
        options: GROUPING_OPTIONS,
      },
      {
        key: "measure",
        kind: "select",
        label: msg`Measure`,
        options: [
          { value: "sets", label: msg`Sets` },
          { value: "volume", label: msg`Volume` },
        ],
      },
      { ...RANGE_FIELD, options: [...RANGE_FIELD.options] },
    ],
  },
  muscleSets: {
    title: msg`Sets per Muscle / Week`,
    description: msg`Weekly working sets against a target range`,
    Component: MuscleSetsWidget,
    fields: [
      {
        key: "groupBy",
        kind: "select",
        label: msg`Group by`,
        options: GROUPING_OPTIONS,
      },
      {
        key: "secondaryHalf",
        kind: "switch",
        label: msg`Count secondary muscles`,
        description: msg`Each set counts as half a set for the exercise's secondary muscles.`,
        visibleWhen: (config) => config.groupBy === "muscle",
      },
      {
        key: "showTarget",
        kind: "switch",
        label: msg`Show target range`,
        description: msg`10 to 20 hard sets per muscle a week is a common range for muscle growth.`,
      },
      {
        key: "targetMin",
        kind: "number",
        label: msg`Target minimum`,
        options: TARGET_SET_OPTIONS,
        visibleWhen: (config) => config.showTarget,
      },
      {
        key: "targetMax",
        kind: "number",
        label: msg`Target maximum`,
        options: TARGET_SET_OPTIONS,
        visibleWhen: (config) => config.showTarget,
      },
      { ...RANGE_FIELD, options: [...RANGE_FIELD.options] },
    ],
  },
  tracked: {
    title: msg`Pinned exercises`,
    description: msg`Your chosen lifts and their best`,
    Component: TrackedExercisesWidget,
    fields: [
      {
        key: "showSparkline",
        kind: "switch",
        label: msg`Show trend line`,
      },
    ],
  },
  measurements: {
    title: msg`Body Measurements`,
    description: msg`Your latest entry`,
    Component: MeasurementsWidget,
    fields: [
      {
        key: "metricKeys",
        kind: "metricKeys",
        label: msg`Measurements shown`,
        description: msg`Choose none to show every measurement in the latest entry.`,
      },
    ],
  },
};
