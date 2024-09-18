import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View, FlatList } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { PieChart } from "react-native-gifted-charts";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import {
  CompletedWorkout,
  useCompletedWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { Colors } from "@/constants/Colors";
import WorkoutHistoryCard from "@/components/WorkoutHistoryCard";

export default function StatsScreen() {
  const { data: completedWorkouts, isLoading: isLoadingWorkouts } =
    useCompletedWorkoutsQuery();
  const { data: exercises, isLoading: isLoadingExercises } =
    useExercisesQuery();

  const chartColors: Record<string, string> = {
    back: "#FF5722", // Deep Orange
    chest: "#3F51B5", // Indigo
    shoulders: "#009688", // Teal
    neck: "#9E9E9E", // Gray
    arms: "#43A047", // Green
    legs: "#5D4037", // Brown
    waist: "#FDD835", // Yellow
    cardio: "#8E24AA", // Purple
  };

  // Calculate total workouts
  const totalWorkouts = completedWorkouts ? completedWorkouts.length : 0;

  // Calculate total sets completed
  const totalSetsCompleted = completedWorkouts
    ? completedWorkouts.reduce((workoutAcc, workout) => {
        const setsInWorkout = workout.exercises.reduce(
          (exerciseAcc, exercise) => {
            return exerciseAcc + exercise.sets.length;
          },
          0,
        );
        return workoutAcc + setsInWorkout;
      }, 0)
    : 0;

  // Calculate total time spent
  const totalTimeSpent = completedWorkouts
    ? completedWorkouts.reduce((acc, workout) => acc + workout.duration, 0)
    : 0;
  const totalTimeMinutes = Math.round(totalTimeSpent / 60);

  // Map exercise_id to body_part
  const exerciseIdToBodyPartMap = useMemo(() => {
    if (!exercises) {
      return {};
    }
    return exercises.reduce(
      (acc, exercise) => {
        acc[exercise.exercise_id] = exercise.body_part;
        return acc;
      },
      {} as Record<number, string>,
    );
  }, [exercises]);

  // Calculate body part counts
  const bodyPartCounts = useMemo(() => {
    if (!completedWorkouts || !exerciseIdToBodyPartMap) {
      return {};
    }

    const counts: Record<string, number> = {};

    completedWorkouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        let bodyPart = exerciseIdToBodyPartMap[exercise.exercise_id];
        if (bodyPart) {
          // Map upper/lower arms and legs to combined categories
          if (bodyPart === "upper arms" || bodyPart === "lower arms") {
            bodyPart = "arms";
          } else if (bodyPart === "upper legs" || bodyPart === "lower legs") {
            bodyPart = "legs";
          }

          counts[bodyPart] = (counts[bodyPart] || 0) + 1;
        }
      });
    });

    return counts;
  }, [completedWorkouts, exerciseIdToBodyPartMap]);

  // Calculate body part percentages
  const bodyPartPercentages = useMemo(() => {
    const total = Object.values(bodyPartCounts).reduce(
      (acc, count) => acc + count,
      0,
    );
    if (total === 0) {
      return [];
    }

    return Object.entries(bodyPartCounts).map(([bodyPart, count]) => ({
      name: bodyPart,
      count,
      percentage: ((count / total) * 100).toFixed(2),
    }));
  }, [bodyPartCounts]);

  const chartData = bodyPartPercentages.map((item) => ({
    text: item.name,
    value: parseFloat(item.percentage),
    color: chartColors[item.name] || "#c4f",
  }));

  const handleWorkoutPress = (workout: CompletedWorkout) => {};

  if (isLoadingWorkouts || isLoadingExercises) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  // Function to render the colored dot
  const renderDot = (color: string) => (
    <View
      style={{
        height: 8,
        width: 8,
        borderRadius: 5,
        backgroundColor: color,
        marginRight: 4,
      }}
    />
  );

  // Function to render the legend component
  const renderLegendComponent = () => (
    <View style={styles.legendContainer}>
      {chartData.map((item) => (
        <View key={item.text} style={styles.legendItem}>
          {renderDot(item.color)}
          <ThemedText style={styles.legendText}>{`${item.text}`}</ThemedText>
        </View>
      ))}
    </View>
  );

  return (
    <ThemedView>
      <ScrollView style={styles.container}>
        {/* Summary Stats */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Summary Stats</ThemedText>
          <ThemedText>Total Workouts: {totalWorkouts}</ThemedText>
          <ThemedText>Total Sets: {totalSetsCompleted}</ThemedText>
          <ThemedText>Total Time: {totalTimeMinutes} minutes</ThemedText>
        </View>

        {/* Workout History */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Workout History</ThemedText>
          {completedWorkouts && completedWorkouts.length > 0 ? (
            <FlatList
              data={completedWorkouts}
              renderItem={({ item }: { item: CompletedWorkout }) => (
                <WorkoutHistoryCard
                  workout={item}
                  onPress={handleWorkoutPress}
                />
              )}
              keyExtractor={(item: CompletedWorkout) =>
                item.workout_id.toString()
              }
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.flatListContent}
            />
          ) : (
            <ThemedText>No workouts completed yet.</ThemedText>
          )}
        </View>

        {/* Body Parts Trained */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Body Parts Trained
          </ThemedText>
          {chartData.length > 0 ? (
            <>
              <PieChart
                donut
                data={chartData}
                innerRadius={100}
                radius={150}
                innerCircleColor={Colors.dark.background}
                centerLabelComponent={() => (
                  <View
                    style={{ justifyContent: "center", alignItems: "center" }}
                  >
                    <ThemedText style={{ fontSize: 18, fontWeight: "bold" }}>
                      Body Parts
                    </ThemedText>
                  </View>
                )}
              />
              {renderLegendComponent()}
            </>
          ) : (
            <ThemedText>No data available.</ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
    alignItems: "center", // Center the content if desired
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
});
