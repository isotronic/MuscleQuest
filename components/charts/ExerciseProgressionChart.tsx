import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { LineChart } from "react-native-gifted-charts";
import { Colors } from "@/constants/Colors";
import {
  TrackedExerciseWithSets,
  CompletedSet,
} from "@/hooks/useTrackedExercisesQuery";

interface ExerciseProgressionChartProps {
  exercise: TrackedExerciseWithSets;
  timeRange: string;
  weightUnit: string;
}

const groupSetsByTime = (
  completedSets: CompletedSet[],
  timeRange: string,
  trackingType: string | null,
  conversionFactor: number,
) => {
  const groupedSets: Record<string, { progressionMetric: number }> = {};

  completedSets.forEach((set) => {
    const setDate = new Date(set.date_completed);
    let groupKey: string;

    if (timeRange === "90") {
      // Group by week: label in "30 Sep" or "7 Oct" format
      const weekStart = new Date(setDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const day = weekStart.getDate();
      const month = weekStart.toLocaleString(undefined, { month: "short" });
      groupKey = `${day} ${month}`;
    } else if (timeRange === "365" || timeRange === "0") {
      // Group by month
      const month = setDate.toLocaleString(undefined, { month: "short" });
      groupKey = `${month}`;
    } else {
      // Default: daily
      groupKey = setDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "numeric",
      });
    }

    // Convert progressionMetric if needed
    // If tracking_type is null or weight or assistance, apply conversion; otherwise, no conversion
    const isWeightType =
      trackingType === null ||
      trackingType === "weight" ||
      trackingType === "assisted";

    const metric = isWeightType
      ? set.progressionMetric * conversionFactor
      : set.progressionMetric;

    if (
      !groupedSets[groupKey] ||
      metric > groupedSets[groupKey].progressionMetric
    ) {
      groupedSets[groupKey] = { progressionMetric: metric };
    }
  });

  return groupedSets;
};

export const ExerciseProgressionChart: React.FC<
  ExerciseProgressionChartProps
> = ({ exercise, timeRange, weightUnit }) => {
  // Determine conversion factor
  const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;

  const chartData = useMemo(() => {
    const groupedSets = groupSetsByTime(
      exercise.completed_sets,
      timeRange,
      exercise.tracking_type,
      conversionFactor,
    );
    return Object.keys(groupedSets)
      .map((key) => ({
        label: key,
        value: groupedSets[key].progressionMetric,
      }))
      .reverse();
  }, [
    exercise.completed_sets,
    timeRange,
    exercise.tracking_type,
    conversionFactor,
  ]);

  const latestSet = exercise.completed_sets[0];

  // Determine correct label based on tracking type and units
  const isWeightType =
    exercise.tracking_type === null ||
    exercise.tracking_type === "weight" ||
    exercise.tracking_type === "assisted";

  const weightUnitLabel = weightUnit === "lbs" ? "lbs" : "kg";

  const metricLabel =
    exercise.tracking_type === "time"
      ? "Time (s)"
      : exercise.tracking_type === "reps"
        ? "Reps"
        : `1RM (${weightUnitLabel})`; // For null or "weight"

  // Convert latest metrics if applicable
  const latestMetric =
    exercise.tracking_type === "reps"
      ? latestSet?.reps
      : exercise.tracking_type === "time"
        ? latestSet?.time
        : latestSet?.oneRepMax !== undefined
          ? latestSet.oneRepMax * conversionFactor
          : undefined;

  const latestWeight =
    latestSet?.weight !== undefined && isWeightType
      ? latestSet.weight * conversionFactor
      : latestSet?.weight;

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText style={styles.exerciseName}>
          {exercise.name} ({metricLabel})
        </ThemedText>
        {latestSet && (
          <>
            <ThemedText style={styles.latestMetric}>
              Latest {metricLabel}:{" "}
              {latestMetric !== undefined ? latestMetric.toFixed(1) : "N/A"}
            </ThemedText>

            <ThemedText style={styles.additionalInfo}>
              {latestWeight !== undefined &&
                `${latestWeight.toFixed(1)}${weightUnitLabel} `}
              {exercise.tracking_type === "assisted" && "assistance "}
              {latestSet.reps !== undefined && `x ${latestSet.reps} reps `}
              {latestSet.time !== undefined && `for ${latestSet.time}s `}(
              {new Date(latestSet.date_completed).toLocaleDateString()})
            </ThemedText>
          </>
        )}
        <LineChart
          data={chartData}
          spacing={30}
          thickness={5}
          color={Colors.dark.highlight}
          isAnimated
          areaChart
          width={250}
          startFillColor="rgba(231, 64, 67, 0.5)"
          endFillColor="rgba(231, 64, 67, 0)"
          yAxisColor={Colors.dark.text}
          yAxisTextStyle={styles.yAxisLabel}
          xAxisLabelTextStyle={styles.xAxisLabel}
          xAxisColor={Colors.dark.text}
          dataPointsColor={Colors.dark.tint}
        />
      </View>
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
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  latestMetric: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: Colors.dark.text,
  },
  additionalInfo: {
    fontSize: 12,
    color: Colors.dark.subText,
    marginBottom: 16,
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
