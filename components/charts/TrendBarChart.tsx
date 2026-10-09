import React, { useMemo } from "react";
import { localDateKeyToDate } from "@/utils/dates";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "react-native-paper";
import type { WorkoutSummary } from "@/utils/db/workoutStats";
import type { TrendMetric } from "@/utils/statsLayout";
import { volumeInTons } from "@/utils/workoutStats";
import { t } from "@lingui/core/macro";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useChartTheme } from "./chartTheme";
import { spokenBucketLabels, summarizeTotals } from "./chartA11y";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { toDisplayDecimal } from "@/utils/numberFormat";

type TrendWorkout = Pick<WorkoutSummary, "local_date"> &
  Partial<
    Pick<WorkoutSummary, "volume_kg" | "set_count" | "rep_count" | "duration">
  >;

interface TrendBarChartProps {
  /** Totals already reflect the warm-up and doubling settings. */
  completedWorkouts: TrendWorkout[];
  timeRange: string;
  metric: TrendMetric;
  weightUnit?: string;
}

/** What one workout adds to its bar: tonnes/tons for volume, hours for time. */
const metricValue = (
  workout: TrendWorkout,
  metric: TrendMetric,
  weightUnit: string,
): number => {
  switch (metric) {
    case "workouts":
      return 1;
    case "volume":
      return volumeInTons(workout.volume_kg ?? 0, weightUnit);
    case "sets":
      return workout.set_count ?? 0;
    case "reps":
      return workout.rep_count ?? 0;
    case "duration":
      return (workout.duration ?? 0) / 3600;
  }
};

interface Bucket {
  label: string;
  labelLine2?: string;
  value: number;
  /** Year-first key, e.g. "2026-4"; names repeated months in speech. */
  internalKey?: string;
}

type BucketType = "weekly" | "monthly" | "quarterly" | "yearly";

export const groupWorkoutsByTime = (
  completedWorkouts: TrendWorkout[],
  timeRange: string,
  valueOf: (workout: TrendWorkout) => number = () => 1,
): Bucket[] => {
  type InternalBucket = Bucket & { internalKey: string };
  const buckets: InternalBucket[] = [];
  const keyToIndex = new Map<string, number>();

  const today = new Date();
  let bucketType: BucketType = "monthly";

  if (timeRange === "30" || timeRange === "90") {
    bucketType = "weekly";
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - parseInt(timeRange));
    const cursor = new Date(startDate);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      const label =
        timeRange === "30"
          ? `${cursor.getDate()} ${cursor.toLocaleString(undefined, { month: "short" })}`
          : String(cursor.getDate());
      const labelLine2 =
        timeRange === "90"
          ? cursor.toLocaleString(undefined, { month: "short" })
          : undefined;
      buckets.push({ internalKey, label, labelLine2, value: 0 });
      keyToIndex.set(internalKey, buckets.length - 1);
      cursor.setDate(cursor.getDate() + 7);
    }
  } else if (timeRange === "365") {
    bucketType = "monthly";
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 365);
    const cursor = new Date(startDate);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      const label = cursor.toLocaleString(undefined, { month: "short" });
      buckets.push({ internalKey, label, value: 0 });
      keyToIndex.set(internalKey, buckets.length - 1);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    // All time — adaptive bucket size based on data span
    if (completedWorkouts.length === 0) return [];
    const earliest = completedWorkouts.reduce(
      (min, w) =>
        localDateKeyToDate(w.local_date) < min
          ? localDateKeyToDate(w.local_date)
          : min,
      localDateKeyToDate(completedWorkouts[0].local_date),
    );
    const latest = completedWorkouts.reduce(
      (max, w) =>
        localDateKeyToDate(w.local_date) > max
          ? localDateKeyToDate(w.local_date)
          : max,
      localDateKeyToDate(completedWorkouts[0].local_date),
    );
    const spanYears =
      (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (spanYears <= 1) {
      bucketType = "monthly";
      const cursor = new Date(earliest);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latest) {
        const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        buckets.push({
          internalKey,
          label: cursor.toLocaleString(undefined, { month: "short" }),
          value: 0,
        });
        keyToIndex.set(internalKey, buckets.length - 1);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else if (spanYears <= 3) {
      bucketType = "quarterly";
      const cursor = new Date(earliest);
      cursor.setDate(1);
      cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latest) {
        const q = Math.floor(cursor.getMonth() / 3) + 1;
        const yr = cursor.getFullYear();
        buckets.push({
          internalKey: `${yr}-Q${q}`,
          label: `Q${q}`,
          labelLine2: `${yr}`,
          value: 0,
        });
        keyToIndex.set(`${yr}-Q${q}`, buckets.length - 1);
        cursor.setMonth(cursor.getMonth() + 3);
      }
    } else {
      bucketType = "yearly";
      const cursor = new Date(earliest);
      cursor.setMonth(0);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latest) {
        const yr = cursor.getFullYear();
        buckets.push({ internalKey: `${yr}`, label: `${yr}`, value: 0 });
        keyToIndex.set(`${yr}`, buckets.length - 1);
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
    }
  }

  completedWorkouts.forEach((workout) => {
    const d = localDateKeyToDate(workout.local_date);
    let internalKey: string;
    if (bucketType === "weekly") {
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      internalKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
    } else if (bucketType === "monthly") {
      internalKey = `${d.getFullYear()}-${d.getMonth()}`;
    } else if (bucketType === "quarterly") {
      internalKey = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    } else {
      internalKey = `${d.getFullYear()}`;
    }
    const idx = keyToIndex.get(internalKey);
    if (idx !== undefined) {
      buckets[idx].value += valueOf(workout);
    }
  });

  // Fractional metrics (tonnes, hours) carry float noise from the sums.
  return buckets.map((b) => ({ ...b, value: parseFloat(b.value.toFixed(2)) }));
};

const INITIAL_SPACING = 10;
const Y_AXIS_WIDTH = 35;
// screen paddingHorizontal 16 each side + card paddingHorizontal 8 each side
const HORIZONTAL_INSETS = 16 * 2 + 8 * 2;

export const TrendBarChart: React.FC<TrendBarChartProps> = ({
  completedWorkouts,
  timeRange,
  metric,
  weightUnit = "kg",
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const chartTheme = useChartTheme();
  // Gifted charts animate with RN Animated, which ignores the setting.
  const reduceMotion = useReduceMotion();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const buckets = useMemo(
    () =>
      groupWorkoutsByTime(completedWorkouts, timeRange, (w) =>
        metricValue(w, metric, weightUnit),
      ),
    [completedWorkouts, timeRange, metric, weightUnit],
  );

  const chartWidth =
    screenWidth - HORIZONTAL_INSETS - Y_AXIS_WIDTH - INITIAL_SPACING - 16;
  const numBars = Math.max(1, buckets.length);
  const slotWidth = (chartWidth - INITIAL_SPACING) / numBars;
  const barSpacing = Math.max(3, Math.floor(slotWidth * 0.3));
  const barWidth = Math.max(4, Math.floor(slotWidth - barSpacing));

  const barData = buckets.map((bucket) => {
    if (bucket.labelLine2) {
      return {
        value: bucket.value,
        labelComponent: () => (
          <View style={styles.twoLineLabel}>
            <Text style={styles.twoLineLabelText}>{bucket.label}</Text>
            <Text style={styles.twoLineLabelText}>{bucket.labelLine2}</Text>
          </View>
        ),
      };
    }
    return { value: bucket.value, label: bucket.label };
  });

  // Tonnes and hours can peak below 1; counts start at an axis of 1.
  const peak = Math.max(0, ...buckets.map((b) => b.value));
  const maxValue = peak > 0 ? peak : 1;

  const spoken = {
    workouts: { title: t`Workouts`, unit: undefined },
    // Bars are in thousands of the weight unit; spell the unit out.
    volume: {
      title: t`Volume`,
      unit: weightUnit === "lbs" ? t`tons` : t`tonnes`,
    },
    sets: { title: t`Sets`, unit: undefined },
    reps: { title: t`Reps`, unit: undefined },
    duration: { title: t`Training time`, unit: t`hours` },
  }[metric];

  const summary = summarizeTotals({
    title: spoken.title,
    timeRange,
    buckets: spokenBucketLabels(buckets).map((label, i) => ({
      label,
      value: buckets[i].value,
    })),
    unit: spoken.unit,
    emptyText: t`No workouts in this period`,
  });

  return (
    <Card style={styles.card}>
      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        <BarChart
          data={barData}
          barWidth={barWidth}
          spacing={barSpacing}
          isAnimated={!reduceMotion}
          frontColor={chartTheme.primary}
          roundedTop
          barBorderRadius={chartTheme.barBorderRadius}
          yAxisTextStyle={styles.yAxisLabel}
          xAxisLabelTextStyle={styles.xAxisLabel}
          yAxisColor="transparent"
          xAxisColor={chartTheme.axisColor}
          width={chartWidth}
          noOfSections={chartTheme.noOfSections}
          initialSpacing={INITIAL_SPACING}
          maxValue={maxValue}
          formatYLabel={toDisplayDecimal}
          hideRules
        />
      </View>
    </Card>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      width: "100%",
      marginBottom: 8,
      paddingVertical: 16,
      paddingHorizontal: 8,
      backgroundColor: colors.card,
    },
    yAxisLabel: {
      fontSize: 10,
      color: colors.contentSecondary,
    },
    xAxisLabel: {
      fontSize: 9,
      color: colors.contentSecondary,
      marginTop: 4,
    },
    twoLineLabel: {
      alignItems: "center",
      marginTop: 4,
    },
    twoLineLabelText: {
      fontSize: 9,
      color: colors.contentSecondary,
    },
  });
}
