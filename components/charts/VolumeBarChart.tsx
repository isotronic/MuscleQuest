import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "react-native-paper";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { chartTheme } from "./chartTheme";

interface VolumeBarChartProps {
  completedWorkouts: CompletedWorkout[];
  timeRange: string;
  weightUnit: string;
}

const groupVolumeByTime = (
  completedWorkouts: CompletedWorkout[],
  timeRange: string,
  weightUnit: string,
) => {
  const grouped: Record<string, number> = {};
  const tonDivisor = weightUnit === "lbs" ? 2000 : 1000;

  completedWorkouts.forEach((workout) => {
    const workoutDate = new Date(workout.date_completed);
    let groupKey: string;

    if (timeRange === "30") {
      const weekStart = new Date(workoutDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const day = weekStart.getDate();
      const month = weekStart.toLocaleString(undefined, { month: "short" });
      groupKey = `${day} ${month}`;
    } else if (timeRange === "90") {
      const weekStart = new Date(workoutDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const day = weekStart.getDate().toString().padStart(2, "0");
      const month = (weekStart.getMonth() + 1).toString().padStart(2, "0");
      groupKey = `${day}.${month}.`;
    } else {
      const month = workoutDate.toLocaleString(undefined, { month: "short" });
      groupKey = month;
    }

    if (!grouped[groupKey]) grouped[groupKey] = 0;

    workout.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.weight && set.reps) {
          grouped[groupKey] += (set.weight * set.reps) / tonDivisor;
        }
      });
    });
  });

  return grouped;
};

export const VolumeBarChart: React.FC<VolumeBarChartProps> = ({
  completedWorkouts,
  timeRange,
  weightUnit,
}) => {
  const grouped = useMemo(
    () => groupVolumeByTime(completedWorkouts, timeRange, weightUnit),
    [completedWorkouts, timeRange, weightUnit],
  );

  const barData = Object.keys(grouped)
    .reverse()
    .map((key) => ({
      label: key,
      value: parseFloat(grouped[key].toFixed(2)),
    }));

  if (barData.length === 0) return null;

  const maxVal = Math.max(...barData.map((d) => d.value));
  const barWidth = timeRange === "30" ? 35 : 15;
  const barSpacing = timeRange === "30" ? 20 : timeRange === "90" ? 15 : 6;

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
        width={270}
        noOfSections={chartTheme.noOfSections}
        initialSpacing={10}
        maxValue={maxVal > 0 ? maxVal : 1}
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
    backgroundColor: "#3A3A4A",
  },
  yAxisLabel: {
    fontSize: 10,
    color: "#9BA1A6",
  },
  xAxisLabel: {
    fontSize: 9,
    color: "#9BA1A6",
    marginTop: 4,
  },
});
