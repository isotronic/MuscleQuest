import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "react-native-paper";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Colors } from "@/constants/Colors";

interface WorkoutBarChartProps {
  completedWorkouts: CompletedWorkout[];
  timeRange: string;
}

const groupWorkoutsByTime = (
  completedWorkouts: CompletedWorkout[],
  timeRange: string,
) => {
  const workoutsGrouped: Record<string, number> = {};

  completedWorkouts.forEach((workout) => {
    const workoutDate = new Date(workout.date_completed);

    // Determine the group key based on the selected time range
    let groupKey: string;

    if (timeRange === "30" || timeRange === "90") {
      // Group by week: label in "30 Sep" or "7 Oct" format
      const weekStart = new Date(workoutDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of the week
      const day = weekStart.getDate();
      const month = weekStart.toLocaleString(undefined, { month: "short" });
      groupKey = `${day} ${month}`;
    } else {
      // Group by month: label in the first three letters of the month
      const month = workoutDate.toLocaleString(undefined, { month: "short" });
      groupKey = month;
    }

    if (!workoutsGrouped[groupKey]) {
      workoutsGrouped[groupKey] = 0;
    }
    workoutsGrouped[groupKey]++;
  });

  return workoutsGrouped;
};

export const WorkoutBarChart: React.FC<WorkoutBarChartProps> = ({
  completedWorkouts,
  timeRange,
}) => {
  const groupedWorkouts = useMemo(
    () => groupWorkoutsByTime(completedWorkouts, timeRange),
    [completedWorkouts, timeRange],
  );

  const barData = Object.keys(groupedWorkouts).map((key) => ({
    label: key,
    value: groupedWorkouts[key],
  }));

  const barWidth = timeRange === "30" ? 35 : 15;

  return (
    <Card style={styles.card}>
      <BarChart
        data={barData.reverse()}
        barWidth={barWidth}
        spacing={35}
        isAnimated
        frontColor={Colors.dark.highlight}
        yAxisTextStyle={styles.yAxisLabel}
        xAxisLabelTextStyle={styles.xAxisLabel}
        yAxisColor={Colors.dark.text}
        xAxisColor={Colors.dark.text}
        width={250}
        noOfSections={Math.max(...Object.values(groupedWorkouts))}
        initialSpacing={10}
        maxValue={Math.max(...Object.values(groupedWorkouts))}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    marginBottom: 8,
    padding: 16,
    backgroundColor: Colors.dark.cardBackground,
  },
  yAxisLabel: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  xAxisLabel: {
    fontSize: 10,
    color: Colors.dark.text,
    marginTop: 4,
  },
});
