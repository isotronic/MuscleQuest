import React from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { LineChart } from "react-native-gifted-charts"; // Assuming you're using this library
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

  return (
    <Card style={styles.card}>
      <View style={styles.cardContent}>
        <ThemedText style={styles.exerciseName}>
          {exercise.name} Progression
        </ThemedText>
        <LineChart data={chartData} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    padding: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  cardContent: {
    alignItems: "center",
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
