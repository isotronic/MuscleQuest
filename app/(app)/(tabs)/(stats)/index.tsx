import React, { useState } from "react";
import { ScrollView, StyleSheet, View, FlatList } from "react-native";
import { ActivityIndicator, Button, Card } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import {
  CompletedWorkout,
  useCompletedWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { Colors } from "@/constants/Colors";
import WorkoutHistoryCard from "@/components/WorkoutHistoryCard";
import { useRouter } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useTrackedExercisesQuery } from "@/hooks/useTrackedExercisesQuery";
import { ExerciseProgressionChart } from "@/components/charts/ExerciseProgressionChart";
import { updateSettings } from "@/utils/database";
import { useQueryClient } from "@tanstack/react-query";
import BodyPartChart from "@/components/charts/BodyPartChart";
import { WorkoutBarChart } from "@/components/charts/WorkoutBarChart";

const timeRanges = {
  allTime: "0",
  thirtyDays: "30",
  ninetyDays: "90",
  oneYear: "365",
};

export default function StatsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    settings?.timeRange || timeRanges.allTime,
  );
  const { data: exercises, isLoading: isLoadingExercises } =
    useExercisesQuery();
  const { data: trackedExercises, isLoading: isLoadingTrackedExercises } =
    useTrackedExercisesQuery();

  const { data: completedWorkouts, isLoading: isLoadingWorkouts } =
    useCompletedWorkoutsQuery(weightUnit, parseInt(selectedTimeRange));

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

  // Function to update the selected time range
  const handleTimeRangeChange = async (range: string) => {
    setSelectedTimeRange(range);
    try {
      await updateSettings("timeRange", range);
    } catch (error) {
      console.error("Failed to update time range:", error);
      setSelectedTimeRange((prevRange) => prevRange);
      // TODO: Implement user-facing error message
    } finally {
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
    }
  };

  const handleWorkoutPress = (id: number) => {
    router.push(`/history-details?id=${id}`);
  };

  const handleAddExercisesPress = () => {
    router.push({
      pathname: "/(app)/(tabs)/(stats)/exercises", // Adjust based on your routing structure
      params: {
        selectedExercises: JSON.stringify(
          trackedExercises?.map((te) => te.exercise_id),
        ),
      },
    });
  };

  if (isLoadingWorkouts || isLoadingExercises || isLoadingTrackedExercises) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  return (
    <ThemedView>
      <ScrollView style={styles.container}>
        <View style={styles.timeRangeContainer}>
          <Button
            mode={
              selectedTimeRange === timeRanges.allTime ? "outlined" : "text"
            }
            onPress={() => handleTimeRangeChange(timeRanges.allTime)}
          >
            All Time
          </Button>
          <Button
            mode={
              selectedTimeRange === timeRanges.thirtyDays ? "outlined" : "text"
            }
            onPress={() => handleTimeRangeChange(timeRanges.thirtyDays)}
          >
            30 Days
          </Button>
          <Button
            mode={
              selectedTimeRange === timeRanges.ninetyDays ? "outlined" : "text"
            }
            onPress={() => handleTimeRangeChange(timeRanges.ninetyDays)}
          >
            90 Days
          </Button>
          <Button
            mode={
              selectedTimeRange === timeRanges.oneYear ? "outlined" : "text"
            }
            onPress={() => handleTimeRangeChange(timeRanges.oneYear)}
          >
            1 Year
          </Button>
        </View>
        {/* Summary Stats */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Summary</ThemedText>
          <View style={styles.summaryContainer}>
            <Card style={[styles.summaryCard, { marginRight: 8 }]}>
              <ThemedText style={styles.statValue}>{totalWorkouts}</ThemedText>
              <ThemedText style={styles.statLabel}>Workouts</ThemedText>
            </Card>
            <Card style={[styles.summaryCard, { marginRight: 8 }]}>
              <ThemedText style={styles.statValue}>
                {totalSetsCompleted}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Sets</ThemedText>
            </Card>
            <Card style={styles.summaryCard}>
              <ThemedText style={styles.statValue}>
                {totalTimeMinutes}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Minutes</ThemedText>
            </Card>
          </View>
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
                  onPress={() => handleWorkoutPress(item.id)}
                />
              )}
              keyExtractor={(item: CompletedWorkout) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          ) : (
            <ThemedText>
              No workouts completed yet. Start your first workout!
            </ThemedText>
          )}
        </View>

        {/* Workout Bar Chart */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Workouts Over Time
          </ThemedText>
          {completedWorkouts && completedWorkouts.length > 0 ? (
            <WorkoutBarChart
              completedWorkouts={completedWorkouts}
              timeRange={selectedTimeRange}
            />
          ) : (
            <ThemedText>
              No workouts completed yet. Start your first workout!
            </ThemedText>
          )}
        </View>

        {/* Body Parts Trained */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Training Split</ThemedText>
          <BodyPartChart
            completedWorkouts={completedWorkouts}
            exercises={exercises}
          />
        </View>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Exercises Tracked</ThemedText>
          {/* Render Line Charts for Each Tracked Exercise */}
          {trackedExercises && trackedExercises.length > 0 ? (
            trackedExercises.map((exercise) => (
              <ExerciseProgressionChart
                key={exercise.exercise_id}
                exercise={exercise}
              />
            ))
          ) : (
            <ThemedText>
              No exercises tracked yet. Add some exercises!
            </ThemedText>
          )}
          <Button
            style={{ marginTop: 16 }}
            mode="contained"
            onPress={handleAddExercisesPress}
          >
            Add Exercises to Track
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeRangeContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  statValue: {
    fontSize: 24,
    textAlign: "center",
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
  },
  section: {
    marginBottom: 32,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
