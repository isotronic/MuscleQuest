import React, { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "react-native-paper";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { chartTheme } from "./chartTheme";
import { Colors } from "@/constants/Colors";

interface WorkoutBarChartProps {
  completedWorkouts: CompletedWorkout[];
  timeRange: string;
}

interface Bucket {
  label: string;
  labelLine2?: string;
  value: number;
}

const groupWorkoutsByTime = (
  completedWorkouts: CompletedWorkout[],
  timeRange: string,
): Bucket[] => {
  type InternalBucket = Bucket & { internalKey: string };
  const buckets: InternalBucket[] = [];
  const keyToIndex = new Map<string, number>();

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - parseInt(timeRange));

  if (timeRange === "30" || timeRange === "90") {
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
  } else {
    const cursor = new Date(startDate);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      // Use year+month as key to avoid collision when range spans same month in two years
      const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      const label = cursor.toLocaleString(undefined, { month: "short" });
      buckets.push({ internalKey, label, value: 0 });
      keyToIndex.set(internalKey, buckets.length - 1);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  completedWorkouts.forEach((workout) => {
    const workoutDate = new Date(workout.date_completed);
    let internalKey: string;

    if (timeRange === "30" || timeRange === "90") {
      const weekStart = new Date(workoutDate);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      internalKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
    } else {
      internalKey = `${workoutDate.getFullYear()}-${workoutDate.getMonth()}`;
    }

    const idx = keyToIndex.get(internalKey);
    if (idx !== undefined) {
      buckets[idx].value++;
    }
  });

  return buckets;
};

const INITIAL_SPACING = 10;
const Y_AXIS_WIDTH = 35;
// screen paddingHorizontal 16 each side + card paddingHorizontal 8 each side
const HORIZONTAL_INSETS = 16 * 2 + 8 * 2;

export const WorkoutBarChart: React.FC<WorkoutBarChartProps> = ({
  completedWorkouts,
  timeRange,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  const buckets = useMemo(
    () => groupWorkoutsByTime(completedWorkouts, timeRange),
    [completedWorkouts, timeRange],
  );

  // Subtract INITIAL_SPACING on the right to mirror the left-side gap
  const chartWidth =
    screenWidth - HORIZONTAL_INSETS - Y_AXIS_WIDTH - INITIAL_SPACING;
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

  return (
    <Card style={styles.card}>
      <BarChart
        data={barData}
        barWidth={barWidth}
        spacing={barSpacing}
        isAnimated
        frontColor={chartTheme.primaryColor}
        roundedTop
        barBorderRadius={chartTheme.barBorderRadius}
        yAxisTextStyle={styles.yAxisLabel}
        xAxisLabelTextStyle={styles.xAxisLabel}
        yAxisColor="transparent"
        xAxisColor={chartTheme.axisColor}
        width={chartWidth}
        noOfSections={chartTheme.noOfSections}
        initialSpacing={INITIAL_SPACING}
        maxValue={Math.max(1, ...buckets.map((b) => b.value))}
        hideRules
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  yAxisLabel: {
    fontSize: 10,
    color: Colors.dark.subText,
  },
  xAxisLabel: {
    fontSize: 9,
    color: Colors.dark.subText,
    marginTop: 4,
  },
  twoLineLabel: {
    alignItems: "center",
    marginTop: 4,
  },
  twoLineLabelText: {
    fontSize: 9,
    color: Colors.dark.subText,
  },
});
