import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AppSelect, type SelectOption } from "@/components/ui";
import { WorkoutHistoryEditor } from "@/components/history/WorkoutHistoryEditor";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import { useLogPastWorkoutMutation } from "@/hooks/useLogPastWorkoutMutation";
import { showSnackbar } from "@/store/snackbarStore";
import { findSourceWorkout } from "@/utils/doAgain";
import type { EditableWorkout } from "@/utils/historyEditOps";
import { exercisesFromWorkout } from "@/utils/logPastWorkout";
import { displayWorkoutName } from "@/utils/workoutName";
import { useAppTheme } from "@/theme";

const EMPTY = "none";
const DEFAULT_DURATION_SECONDS = 60 * 60;

/** Now, to the minute: the default finish time of a workout logged late. */
const thisMinute = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
};

export default function LogPastWorkoutScreen() {
  const { colors } = useAppTheme();
  const { data: settings, isLoading: settingsLoading } = useSettingsQuery();
  const { data: plansData, isLoading: plansLoading } = useAllPlansQuery();
  const { data: standaloneWorkouts, isLoading: standaloneLoading } =
    useStandaloneWorkoutsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const logWorkout = useLogPastWorkoutMutation(weightUnit, distanceUnit);

  const plans = useMemo(
    () => [...(plansData?.userPlans ?? []), ...(plansData?.appPlans ?? [])],
    [plansData],
  );
  const sourceOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [{ label: t`Empty workout`, value: EMPTY }];
    for (const plan of plans) {
      for (const workout of plan.workouts) {
        if (workout.id == null) continue;
        options.push({
          label: `${plan.name} · ${displayWorkoutName(workout.name)}`,
          value: String(workout.id),
        });
      }
    }
    for (const workout of standaloneWorkouts ?? []) {
      if (workout.id == null) continue;
      options.push({
        label: displayWorkoutName(workout.name),
        value: String(workout.id),
      });
    }
    return options;
  }, [plans, standaloneWorkouts]);

  const [sourceValue, setSourceValue] = useState(EMPTY);
  const source =
    sourceValue === EMPTY
      ? null
      : findSourceWorkout(Number(sourceValue), plans, standaloneWorkouts ?? []);

  // The draft's date, duration and note carry over when the source changes
  // and the editor is seeded again with the new exercises.
  const draft = useRef<EditableWorkout | null>(null);
  const handleDraftChange = useCallback((next: EditableWorkout) => {
    draft.current = next;
  }, []);
  const nextId = useRef(-1);
  const initial = useMemo<EditableWorkout>(
    () => ({
      exercises: source
        ? exercisesFromWorkout(source.workout, () => nextId.current--)
        : [],
      completedAt: draft.current?.completedAt ?? thisMinute(),
      durationSeconds:
        draft.current?.durationSeconds ?? DEFAULT_DURATION_SECONDS,
      notes: draft.current?.notes ?? null,
    }),
    // Seeded once per source choice, not on every refetch of the lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceValue, source == null],
  );

  if (settingsLoading || plansLoading || standaloneLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <WorkoutHistoryEditor
        key={sourceValue}
        initial={initial}
        weightUnit={weightUnit}
        distanceUnit={distanceUnit}
        saving={logWorkout.isPending}
        onChange={handleDraftChange}
        header={
          <View style={styles.source}>
            <ThemedText style={styles.sourceLabel}>
              <Trans>Start from</Trans>
            </ThemedText>
            <AppSelect
              accessibilityLabel={t`Start from`}
              testID="log-workout-source"
              data={sourceOptions}
              value={sourceValue}
              onChange={setSourceValue}
              searchable={sourceOptions.length > 8}
              searchPlaceholder={t`Search workouts`}
            />
          </View>
        }
        onSave={(workout) =>
          logWorkout.mutate(
            {
              workout,
              source:
                source?.workout.id != null
                  ? { planId: source.planId, workoutId: source.workout.id }
                  : null,
            },
            {
              onSuccess: () => {
                router.back();
                showSnackbar(t`Workout logged`);
              },
            },
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  source: { marginBottom: 16 },
  sourceLabel: { marginBottom: 8 },
});
