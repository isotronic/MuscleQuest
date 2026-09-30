import React, { useMemo } from "react";
import { localDateKeyToDate } from "@/utils/dates";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "react-native-paper";
import type { WorkoutSummary } from "@/utils/db/workoutStats";
import { volumeInTons } from "@/utils/workoutStats";
import { t } from "@lingui/core/macro";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useChartTheme } from "./chartTheme";
import { spokenBucketLabels, summarizeTotals } from "./chartA11y";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

type WorkoutVolume = Pick<WorkoutSummary, "local_date" | "volume_kg">;

interface VolumeBarChartProps {
  /** volume_kg already reflects the warm-up and doubling settings. */
  completedWorkouts: WorkoutVolume[];
  timeRange: string;
  weightUnit: string;
}

interface Bucket {
  label: string;
  labelLine2?: string;
  value: number;
  /** Year-first key, e.g. "2026-4"; names repeated months in speech. */
  internalKey?: string;
}

type BucketType = "weekly" | "monthly" | "quarterly" | "yearly";

const groupVolumeByTime = (
  completedWorkouts: WorkoutVolume[],
  timeRange: string,
  weightUnit: string,
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
      buckets.push({
        internalKey,
        label: cursor.toLocaleString(undefined, { month: "short" }),
        value: 0,
      });
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
    if (idx === undefined) return;

    buckets[idx].value += volumeInTons(workout.volume_kg, weightUnit);
  });

  return buckets.map((b) => ({ ...b, value: parseFloat(b.value.toFixed(2)) }));
};

const INITIAL_SPACING = 10;
const Y_AXIS_WIDTH = 35;
const HORIZONTAL_INSETS = 16 * 2 + 8 * 2;

export const VolumeBarChart: React.FC<VolumeBarChartProps> = ({
  completedWorkouts,
  timeRange,
  weightUnit,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const chartTheme = useChartTheme();
  // Gifted charts animate with RN Animated, which ignores the setting.
  const reduceMotion = useReduceMotion();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const buckets = useMemo(
    () => groupVolumeByTime(completedWorkouts, timeRange, weightUnit),
    [completedWorkouts, timeRange, weightUnit],
  );

  if (buckets.length === 0) return null;

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

  const maxVal = Math.max(...buckets.map((b) => b.value));

  const summary = summarizeTotals({
    title: t`Volume`,
    timeRange,
    buckets: spokenBucketLabels(buckets).map((label, i) => ({
      label,
      value: buckets[i].value,
    })),
    // Bars are in thousands of the weight unit; spell the unit out.
    unit: weightUnit === "lbs" ? t`tons` : t`tonnes`,
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
          maxValue={maxVal > 0 ? maxVal : 1}
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
