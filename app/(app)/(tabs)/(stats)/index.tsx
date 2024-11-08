import React, { useState } from "react";
import { ScrollView, StyleSheet, View, FlatList } from "react-native";
import { ActivityIndicator, Button, Card, Divider } from "react-native-paper";
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
import { formatToHoursMinutes } from "@/utils/utility";
import Bugsnag from "@bugsnag/expo";

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
    settings?.timeRange || timeRanges.thirtyDays,
  );
  const {
    data: exercises,
    isLoading: isLoadingExercises,
    error: exercisesError,
  } = useExercisesQuery();
  const {
    data: trackedExercises,
    isLoading: isLoadingTrackedExercises,
    error: trackedExercisesError,
  } = useTrackedExercisesQuery(selectedTimeRange);

  const {
    data: completedWorkouts,
    isLoading: isLoadingWorkouts,
    error: completedWorkoutsError,
  } = useCompletedWorkoutsQuery(weightUnit, parseInt(selectedTimeRange));

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
  const totalTime = formatToHoursMinutes(totalTimeSpent);

  // Function to update the selected time range
  const handleTimeRangeChange = async (range: string) => {
    setSelectedTimeRange(range);
    try {
      await updateSettings("timeRange", range);
    } catch (error: any) {
      Bugsnag.notify(error);
      console.error("Failed to update time range:", error);
      setSelectedTimeRange((prevRange) => prevRange);
      // TODO: Implement user-facing error message
    } finally {
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
    }
  };

  const handleWorkoutPress = (id: number) => {
    router.push(`/history-details?id=${id}`);
  };

  const handleAddExercisesPress = () => {
    router.push({
      pathname: "/(app)/(tabs)/(stats)/exercises",
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

  if (completedWorkoutsError || exercisesError || trackedExercisesError) {
    const error =
      completedWorkoutsError || exercisesError || trackedExercisesError;

    if (error instanceof Error) {
      Bugsnag.notify(error);
      return (
        <ThemedView style={styles.container}>
          <ThemedText>Error loading data: {error.message}</ThemedText>
        </ThemedView>
      );
    }
  }

  return (
    <ThemedView>
      <ScrollView style={styles.container}>
        <View style={styles.timeRangeContainer}>
          <Button
            mode="text"
            labelStyle={{
              color:
                selectedTimeRange === timeRanges.allTime
                  ? Colors.dark.tint
                  : Colors.dark.text,
            }}
            onPress={() => handleTimeRangeChange(timeRanges.allTime)}
          >
            All Time
          </Button>
          <Button
            mode="text"
            labelStyle={{
              color:
                selectedTimeRange === timeRanges.thirtyDays
                  ? Colors.dark.tint
                  : Colors.dark.text,
            }}
            onPress={() => handleTimeRangeChange(timeRanges.thirtyDays)}
          >
            30 Days
          </Button>
          <Button
            mode="text"
            labelStyle={{
              color:
                selectedTimeRange === timeRanges.ninetyDays
                  ? Colors.dark.tint
                  : Colors.dark.text,
            }}
            onPress={() => handleTimeRangeChange(timeRanges.ninetyDays)}
          >
            90 Days
          </Button>
          <Button
            mode="text"
            labelStyle={{
              color:
                selectedTimeRange === timeRanges.oneYear
                  ? Colors.dark.tint
                  : Colors.dark.text,
            }}
            onPress={() => handleTimeRangeChange(timeRanges.oneYear)}
          >
            1 Year
          </Button>
        </View>
        <Divider style={{ marginBottom: 16, marginTop: -8 }} />
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
              <ThemedText style={styles.statValue}>{totalTime}</ThemedText>
              <ThemedText style={styles.statLabel}>Time (h:m)</ThemedText>
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
            exercises={exercises?.otherExercises}
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
                timeRange={selectedTimeRange}
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
            labelStyle={styles.buttonLabel}
            onPress={handleAddExercisesPress}
          >
            Add{" "}
            {trackedExercises && trackedExercises.length > 0 ? "/ Remove " : ""}
            Exercises to Track
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
    paddingTop: 8,
    paddingBottom: 50,
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
    padding: 20,
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
    textAlign: "center",
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
  buttonLabel: {
    fontSize: 16,
  },
});
