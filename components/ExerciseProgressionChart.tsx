import React from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { LineChart } from "react-native-gifted-charts"; // Ensure you're using this library
import { Colors } from "@/constants/Colors";
import { TrackedExerciseWithSets } from "@/hooks/useTrackedExercisesQuery";

interface ExerciseProgressionChartProps {
  exercise: TrackedExerciseWithSets;
}

export const ExerciseProgressionChart: React.FC<
  ExerciseProgressionChartProps
> = ({ exercise }) => {
  const chartData = exercise.completed_sets.map((set) => ({
    value: set.oneRepMax, // Using one-rep-max for progression
    label: new Date(set.date_completed).toLocaleDateString(),
  }));

  const latestSet = exercise.completed_sets[exercise.completed_sets.length - 1];

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText style={styles.exerciseName}>
          {exercise.name} (1RM)
        </ThemedText>
        {latestSet && (
          <>
            <ThemedText style={styles.latestOneRepMax}>
              Latest 1RM: {latestSet.oneRepMax} kg
            </ThemedText>

            {/* Additional Info: weight x reps (date completed) */}
            <ThemedText style={styles.additionalInfo}>
              {latestSet.weight}kg x {latestSet.reps} reps (
              {new Date(latestSet.date_completed).toLocaleDateString()})
            </ThemedText>
          </>
        )}
        <LineChart
          data={chartData}
          spacing={35}
          thickness={5}
          isAnimated
          areaChart
          rulesType="solid"
          width={250}
          yAxisColor={Colors.dark.text}
          yAxisTextStyle={styles.yAxisLabel}
          xAxisLabelTextStyle={styles.xAxisLabel}
          xAxisColor={Colors.dark.text}
          dataPointsColor={Colors.dark.highlight}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    marginVertical: 8,
    padding: 16,
    backgroundColor: Colors.dark.cardBackground,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  latestOneRepMax: {
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
    fontSize: 10,
    color: Colors.dark.text,
    marginTop: 4,
  },
});
