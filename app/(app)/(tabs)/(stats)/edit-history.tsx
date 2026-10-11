import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { router, useLocalSearchParams } from "expo-router";
import { ErrorState } from "@/components/ui/ErrorState";
import { ThemedView } from "@/components/ThemedView";
import { WorkoutHistoryEditor } from "@/components/history/WorkoutHistoryEditor";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useEditCompletedWorkoutMutation } from "@/hooks/useEditCompletedWorkoutMutation";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import { parseDbTimestamp } from "@/utils/dates";
import type { EditableWorkout } from "@/utils/historyEditOps";
import { useAppTheme } from "@/theme";

export default function EditCompletedWorkoutScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";

  const {
    data: workoutData,
    isLoading: isWorkoutLoading,
    error: workoutError,
    refetch: refetchWorkout,
  } = useCompletedWorkoutByIdQuery(Number(id), weightUnit, distanceUnit);

  const editWorkout = useEditCompletedWorkoutMutation(
    Number(id),
    weightUnit,
    distanceUnit,
  );

  // The loaded workout doubles as the original the save diffs against.
  const original = useMemo<EditableWorkout | null>(
    () =>
      workoutData
        ? {
            exercises: workoutData.exercises,
            completedAt: parseDbTimestamp(workoutData.date_completed),
            durationSeconds: workoutData.duration,
            notes: workoutData.notes ?? null,
          }
        : null,
    [workoutData],
  );

  if (settingsError || workoutError) {
    return (
      <ErrorState
        onRetry={() => {
          if (settingsError) void refetchSettings();
          if (workoutError) void refetchWorkout();
        }}
      />
    );
  }

  if (isWorkoutLoading || settingsLoading || !original) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <WorkoutHistoryEditor
        // Re-seeded if the stored workout is refetched with different data.
        key={workoutData?.date_completed}
        initial={original}
        weightUnit={weightUnit}
        distanceUnit={distanceUnit}
        saving={editWorkout.isPending}
        onSave={(edited) =>
          editWorkout.mutate(
            { original, edited },
            { onSuccess: () => router.back() },
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
