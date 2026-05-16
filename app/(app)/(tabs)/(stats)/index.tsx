import React, { useState, useEffect, useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Divider } from "react-native-paper";
import { TimeRangeSelector } from "@/components/stats/TimeRangeSelector";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import {
  CompletedWorkout,
  useCompletedWorkoutsQuery,
  usePreviousPeriodWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { Colors } from "@/constants/Colors";
import { WorkoutHistorySection } from "@/components/stats/WorkoutHistorySection";
import { InsightsStrip } from "@/components/stats/InsightsStrip";
import { StatsTile } from "@/components/stats/StatsTile";
import { ExerciseCompactCard } from "@/components/stats/ExerciseCompactCard";
import { useRouter } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useTrackedExercisesQuery } from "@/hooks/useTrackedExercisesQuery";
import { useStatsInsights } from "@/hooks/useStatsInsights";
import { WorkoutBarChart } from "@/components/charts/WorkoutBarChart";
import { VolumeBarChart } from "@/components/charts/VolumeBarChart";
import BodyPartChart from "@/components/charts/BodyPartChart";
import { updateSettings } from "@/utils/database";
import { useQueryClient } from "@tanstack/react-query";
import { formatToHoursMinutes } from "@/utils/utility";
import Bugsnag from "@bugsnag/expo";

const computeStats = (workouts: CompletedWorkout[], weightUnit: string) => {
  const tonDivisor = weightUnit === "lbs" ? 2000 : 1000;
  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce(
    (acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.length, 0),
    0,
  );
  const totalVolume = workouts.reduce(
    (acc, w) =>
      acc +
      w.exercises.reduce(
        (a, e) =>
          a +
          e.sets.reduce(
            (s, set) =>
              s + (set.weight && set.reps ? set.weight * set.reps : 0),
            0,
          ),
        0,
      ),
    0,
  );
  const totalTimeSeconds = workouts.reduce((acc, w) => acc + w.duration, 0);
  return {
    totalWorkouts,
    totalSets,
    totalVolumeTons: totalVolume / tonDivisor,
    totalTimeSeconds,
    avgDurationSeconds:
      totalWorkouts > 0 ? Math.round(totalTimeSeconds / totalWorkouts) : 0,
  };
};

export default function StatsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    settings?.timeRange || "30",
  );

  useEffect(() => {
    if (settings?.timeRange) setSelectedTimeRange(settings.timeRange);
  }, [settings?.timeRange]);

  const {
    data: exercises,
    isLoading: isLoadingExercises,
    error: exercisesError,
  } = useExercisesQuery();
  const {
    data: trackedExercises,
    isLoading: isLoadingTracked,
    error: trackedError,
  } = useTrackedExercisesQuery(selectedTimeRange);
  const {
    data: completedWorkouts,
    isLoading: isLoadingWorkouts,
    error,
  } = useCompletedWorkoutsQuery(weightUnit, parseInt(selectedTimeRange));
  const { data: prevWorkouts } = usePreviousPeriodWorkoutsQuery(
    weightUnit,
    parseInt(selectedTimeRange),
  );

  const insights = useStatsInsights(
    completedWorkouts,
    trackedExercises,
    exercises?.otherExercises,
    parseInt(selectedTimeRange),
    weightUnit,
  );

  const handleTimeRangeChange = useCallback(
    async (range: string) => {
      setSelectedTimeRange(range);
      try {
        await updateSettings("timeRange", range);
      } catch (err: any) {
        Bugsnag.notify(err);
      } finally {
        queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
        queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      }
    },
    [queryClient],
  );

  const handleWorkoutPress = useCallback(
    (id: number) => router.push(`/history-details?id=${id}`),
    [router],
  );

  const handleExercisePress = useCallback(
    (exerciseId: number, name: string) =>
      router.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathname: "/(app)/(tabs)/(stats)/exercise-detail" as any,
        params: { exerciseId: exerciseId.toString(), name },
      }),
    [router],
  );

  const handleManageExercisesPress = useCallback(() => {
    router.push({
      pathname: "/(app)/(tabs)/(stats)/exercises",
      params: {
        selectedExercises: JSON.stringify(
          trackedExercises?.map((te) => te.exercise_id),
        ),
      },
    });
  }, [router, trackedExercises]);

  const isLoading = isLoadingWorkouts || isLoadingExercises || isLoadingTracked;

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  const anyError = error || exercisesError || trackedError;
  if (anyError) {
    Bugsnag.notify(
      anyError instanceof Error ? anyError : new Error(String(anyError)),
    );
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Error loading stats. Please try again.</ThemedText>
      </ThemedView>
    );
  }

  const current = computeStats(completedWorkouts ?? [], weightUnit);
  const prev = prevWorkouts ? computeStats(prevWorkouts, weightUnit) : null;

  const volumeUnit = weightUnit === "lbs" ? "tn" : "t";
  const formattedVolume = current.totalVolumeTons.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const workoutsDelta = prev
    ? current.totalWorkouts - prev.totalWorkouts
    : null;
  const volumeDelta =
    prev != null
      ? parseFloat((current.totalVolumeTons - prev.totalVolumeTons).toFixed(2))
      : null;
  const timeDeltaMinutes =
    prev != null
      ? Math.round((current.totalTimeSeconds - prev.totalTimeSeconds) / 60)
      : null;

  return (
    <ThemedView>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Time range selector */}
        <TimeRangeSelector
          selected={selectedTimeRange}
          onChange={handleTimeRangeChange}
        />
        <Divider style={styles.divider} />

        {/* Insights strip */}
        {(completedWorkouts?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <InsightsStrip
              workoutsPerWeek={insights.workoutsPerWeek}
              biggestGainLabel={insights.biggestGainLabel}
              biggestGainValue={insights.biggestGainValue}
              topBodyPart={insights.topBodyPart}
              streak={null}
              weightUnit={weightUnit}
            />
          </View>
        )}

        {/* Summary tiles */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Summary</ThemedText>
          <View style={styles.tileGrid}>
            <StatsTile
              label="Workouts"
              value={String(current.totalWorkouts)}
              delta={workoutsDelta}
            />
            <StatsTile
              label={`Volume (${volumeUnit})`}
              value={formattedVolume}
              delta={volumeDelta}
              deltaLabel={volumeUnit}
            />
            <StatsTile
              label="Total Time"
              value={formatToHoursMinutes(current.totalTimeSeconds)}
              delta={timeDeltaMinutes}
              deltaLabel="min"
            />
            <StatsTile
              label="Avg Duration"
              value={formatToHoursMinutes(current.avgDurationSeconds)}
            />
          </View>
        </View>

        {/* Workout history */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Workout History</ThemedText>
          <WorkoutHistorySection
            completedWorkouts={completedWorkouts ?? []}
            onWorkoutPress={handleWorkoutPress}
          />
        </View>

        {/* Workouts over time */}
        {(completedWorkouts?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              Workouts per Week
            </ThemedText>
            <WorkoutBarChart
              completedWorkouts={completedWorkouts!}
              timeRange={selectedTimeRange}
            />
          </View>
        )}

        {/* Volume over time */}
        {(completedWorkouts?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              Volume per Week ({volumeUnit})
            </ThemedText>
            <VolumeBarChart
              completedWorkouts={completedWorkouts!}
              timeRange={selectedTimeRange}
              weightUnit={weightUnit}
            />
          </View>
        )}

        {/* Training split */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Training Split</ThemedText>
          <BodyPartChart
            completedWorkouts={completedWorkouts}
            exercises={exercises?.otherExercises}
          />
        </View>

        {/* Exercises */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Exercises</ThemedText>
            <Button
              mode="text"
              compact
              labelStyle={{ color: Colors.dark.tint, fontSize: 13 }}
              onPress={handleManageExercisesPress}
            >
              {trackedExercises && trackedExercises.length > 0
                ? "Manage"
                : "+ Add"}
            </Button>
          </View>
          {trackedExercises && trackedExercises.length > 0 ? (
            trackedExercises.map((exercise) => (
              <ExerciseCompactCard
                key={exercise.exercise_id}
                exercise={exercise}
                weightUnit={weightUnit}
                onPress={() =>
                  handleExercisePress(exercise.exercise_id, exercise.name)
                }
              />
            ))
          ) : (
            <ThemedText style={{ color: Colors.dark.subText }}>
              No exercises tracked yet. Tap + Add to start.
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 50,
  },
  divider: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 12,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
