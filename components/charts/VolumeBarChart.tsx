import React, { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "react-native-paper";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useChartTheme } from "./chartTheme";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface VolumeBarChartProps {
  completedWorkouts: CompletedWorkout[];
  timeRange: string;
  weightUnit: string;
  excludeWarmup?: boolean;
  countUnilateralDouble?: boolean;
  doubleWeightForPaired?: boolean;
}

interface Bucket {
  label: string;
  labelLine2?: string;
  value: number;
}

type BucketType = "weekly" | "monthly" | "quarterly" | "yearly";

const groupVolumeByTime = (
  completedWorkouts: CompletedWorkout[],
  timeRange: string,
  weightUnit: string,
  excludeWarmup: boolean = false,
  countUnilateralDouble: boolean = false,
  doubleWeightForPaired: boolean = false,
): Bucket[] => {
  type InternalBucket = Bucket & { internalKey: string };
  const buckets: InternalBucket[] = [];
  const keyToIndex = new Map<string, number>();
  const tonDivisor = weightUnit === "lbs" ? 2000 : 1000;

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
        new Date(w.date_completed) < min ? new Date(w.date_completed) : min,
      new Date(completedWorkouts[0].date_completed),
    );
    const latest = completedWorkouts.reduce(
      (max, w) =>
        new Date(w.date_completed) > max ? new Date(w.date_completed) : max,
      new Date(completedWorkouts[0].date_completed),
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
    const d = new Date(workout.date_completed);
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

    workout.exercises.forEach((exercise) => {
      const weightM = doubleWeightForPaired && exercise.double_weight ? 2 : 1;
      const repM = countUnilateralDouble && exercise.is_unilateral ? 2 : 1;
      exercise.sets.forEach((set) => {
        if ((!excludeWarmup || !set.is_warmup) && set.weight && set.reps) {
          buckets[idx].value +=
            (set.weight * weightM * set.reps * repM) / tonDivisor;
        }
      });
    });
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
  excludeWarmup = false,
  countUnilateralDouble = false,
  doubleWeightForPaired = false,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const chartTheme = useChartTheme();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const buckets = useMemo(
    () =>
      groupVolumeByTime(
        completedWorkouts,
        timeRange,
        weightUnit,
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
      ),
    [
      completedWorkouts,
      timeRange,
      weightUnit,
      excludeWarmup,
      countUnilateralDouble,
      doubleWeightForPaired,
    ],
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

  return (
    <Card style={styles.card}>
      <BarChart
        data={barData}
        barWidth={barWidth}
        spacing={barSpacing}
        isAnimated
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
