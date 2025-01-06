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

    if (timeRange === "30") {
      // Group by week: label in "30 Sep" format
      const weekStart = new Date(workoutDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of the week
      const day = weekStart.getDate();
      const month = weekStart.toLocaleString(undefined, { month: "short" });
      groupKey = `${day} ${month}`;
    } else if (timeRange === "90") {
      // Group by week: label in "18.12." (day.month.) format
      const weekStart = new Date(workoutDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of the week
      const day = weekStart.getDate().toString().padStart(2, "0"); // Add leading zero
      const month = (weekStart.getMonth() + 1).toString().padStart(2, "0"); // Add leading zero
      groupKey = `${day}.${month}.`;
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
  const barSpacing = timeRange === "30" ? 20 : timeRange === "90" ? 15 : 6;

  return (
    <Card style={styles.card}>
      <BarChart
        data={barData.reverse()}
        barWidth={barWidth}
        spacing={barSpacing}
        isAnimated
        frontColor={Colors.dark.highlight}
        yAxisTextStyle={styles.yAxisLabel}
        xAxisLabelTextStyle={styles.xAxisLabel}
        yAxisColor={Colors.dark.text}
        xAxisColor={Colors.dark.text}
        width={270}
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
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  yAxisLabel: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  xAxisLabel: {
    fontSize: 9,
    color: Colors.dark.text,
    marginTop: 4,
  },
});
