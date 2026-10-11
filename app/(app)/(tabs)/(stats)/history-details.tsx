import { useMemo, useRef, useState, useCallback } from "react";
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Trans, Plural } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ActivityIndicator, Card } from "react-native-paper";
import {
  router,
  Stack,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { formatToHoursMinutes } from "@/utils/utility";
import { exerciseThumbnailUri } from "@/utils/exerciseThumbnail";
import { format } from "date-fns";
import { parseDbTimestamp } from "@/utils/dates";
import { AppButton, AppIcon, AppImage, AppIconButton } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { fetchCompletedWorkoutById } from "@/utils/database";
import { fetchExercisesByIds } from "@/utils/db/exercises";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { showSnackbar } from "@/store/snackbarStore";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { buildDoAgainExercises, findSourceWorkout } from "@/utils/doAgain";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useDeleteCompletedWorkoutMutation } from "@/hooks/useDeleteCompletedWorkoutMutation";
import { formatFromTotalSeconds } from "@/utils/utility";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { displayWorkoutName } from "@/utils/workoutName";
import { formatNumber } from "@/utils/numberFormat";
import { exerciseHref } from "@/utils/exerciseHref";

// Set values arrive in display units; shown with the device separator.
const showValue = (value: number | null | undefined) =>
  value != null ? formatNumber(value, 2) : "—";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function HistoryDetailsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams();
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const bodyWeight = parseFloat(settings?.bodyWeight || "70");
  const excludeWarmup = settings?.excludeWarmupSets === "true";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const doubleWeightForPaired = settings?.doubleWeightForPaired === "true";

  const deleteMutation = useDeleteCompletedWorkoutMutation();
  const { data: plansData } = useAllPlansQuery();
  const { data: standaloneWorkouts } = useStandaloneWorkoutsQuery();
  const [isStarting, setIsStarting] = useState(false);
  // Covers the exercise lookup before confirmStartWorkout sets isStarting.
  const preparingCopy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const numId = Number(Array.isArray(id) ? id[0] : id);
      if (!numId) {
        setIsLoading(false);
        setWorkout(null);
        return;
      }

      let cancelled = false;
      setIsLoading(true);
      setError(null);

      fetchCompletedWorkoutById(numId, weightUnit, distanceUnit)
        .then((data) => {
          if (!cancelled) {
            setWorkout(data);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setWorkout(null);
            setIsLoading(false);
            notifyBugsnag(err);
          }
        });

      return () => {
        cancelled = true;
      };
      // reloadKey re-runs the fetch when the error state's Try again is tapped.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, weightUnit, distanceUnit, reloadKey]),
  );

  const totalVolume = useMemo(() => {
    if (!workout) return 0;

    return workout.exercises.reduce((exerciseAcc, exercise) => {
      const weightM = doubleWeightForPaired && exercise.double_weight ? 2 : 1;
      const repM = countUnilateralDouble && exercise.is_unilateral ? 2 : 1;
      const exerciseVolume = exercise.sets.reduce((setAcc, set) => {
        if (excludeWarmup && set.is_warmup) return setAcc;
        const weight =
          exercise.exercise_tracking_type === "assisted"
            ? bodyWeight - (set.weight || 0)
            : (set.weight || 0) * weightM;
        return setAcc + weight * (set.reps || 0) * repM;
      }, 0);

      return parseFloat((exerciseAcc + exerciseVolume).toFixed(1));
    }, 0);
  }, [
    workout,
    bodyWeight,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
  ]);

  if (isLoading || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  if (settingsError instanceof Error) {
    return <ErrorState onRetry={() => void refetchSettings()} />;
  }

  if (error) {
    return <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  if (!workout) {
    return null;
  }

  const sourceWorkout = findSourceWorkout(
    workout.workout_id,
    [...(plansData?.userPlans ?? []), ...(plansData?.appPlans ?? [])],
    standaloneWorkouts ?? [],
  );

  const prepareCopy = async () => {
    try {
      const library = await fetchExercisesByIds(
        workout.exercises.map((exercise) => exercise.exercise_id),
      );
      return buildDoAgainExercises(
        workout,
        library,
        parseInt(settings?.defaultRestTime ?? "60", 10) || 0,
      );
    } catch (err) {
      notifyBugsnag(err);
      showSnackbar(t`Couldn't load this workout's exercises. Try again.`);
      return null;
    }
  };

  const startCopy = async () => {
    if (preparingCopy.current) return;
    preparingCopy.current = true;
    try {
      const exercises = await prepareCopy();
      if (!exercises) return;
      if (exercises.length === 0) {
        showSnackbar(t`None of these exercises are in your library any more.`);
        return;
      }
      await confirmStartWorkout(setIsStarting, () =>
        useActiveWorkoutStore.getState().startQuickWorkoutFrom(exercises),
      );
    } finally {
      preparingCopy.current = false;
    }
  };

  const startSource = () => {
    if (!sourceWorkout) return;
    const { workout: source, planId } = sourceWorkout;
    void confirmStartWorkout(setIsStarting, () =>
      useActiveWorkoutStore
        .getState()
        .setWorkout(source, planId, source.id ?? null, source.name),
    );
  };

  const handleDoAgain = () => {
    if (isStarting) return;
    if (!sourceWorkout) {
      void startCopy();
      return;
    }
    const name = displayWorkoutName(sourceWorkout.workout.name);
    // Starting the saved workout keeps its progression and history linked;
    // a copy repeats exactly what was done this time.
    Alert.alert(
      t`Do again`,
      t`Start ${name} as it is saved now, or a quick workout with the exercises and sets from this session.`,
      [
        { text: t`Cancel`, style: "cancel" },
        { text: t`Quick workout`, onPress: () => void startCopy() },
        { text: t`Start ${name}`, onPress: startSource },
      ],
    );
  };

  const parsedDate = parseDbTimestamp(workout.date_completed);
  const formattedDate = format(parsedDate, "dd/MM/yyyy 'at' HH:mm");
  const sessionNote = workout.notes?.trim();

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <AppIconButton
                accessibilityLabel={t`Edit workout`}
                icon="file-document-edit-outline"
                size={25}
                style={{ marginRight: 0 }}
                iconColor={colors.contentPrimary}
                onPressIn={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/(stats)/edit-history",
                    params: { id },
                  })
                }
              />
              <AppIconButton
                icon="trash-can-outline"
                size={25}
                style={{ marginRight: 0 }}
                iconColor={colors.danger}
                accessibilityLabel={t`Delete workout`}
                accessibilityHint={t`Deletes this workout from your history`}
                disabled={deleteMutation.isPending}
                // No confirmation: the delete is soft and the snackbar offers
                // Undo.
                onPress={() => {
                  if (typeof id !== "string" || !/^\d+$/.test(id)) return;
                  const parsedId = parseInt(id, 10);
                  if (parsedId <= 0) return;
                  deleteMutation.mutate(parsedId);
                }}
              />
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container}>
        {/* Top Section */}
        <View style={styles.topSection}>
          <ThemedText style={styles.workoutName}>
            {displayWorkoutName(workout.workout_name)}
          </ThemedText>
          <ThemedText style={styles.workoutDate}>
            <Trans>Completed on: {formattedDate}</Trans>
          </ThemedText>
          <AppButton
            variant="secondary"
            style={styles.doAgain}
            loading={isStarting}
            disabled={isStarting}
            accessibilityHint={t`Starts a new session with these exercises`}
            onPress={handleDoAgain}
          >
            <Trans>Do again</Trans>
          </AppButton>
          {!!sessionNote && (
            <View style={styles.sessionNoteBox}>
              <ThemedText style={styles.sessionNoteLabel}>
                {t`Session note`}
              </ThemedText>
              <ThemedText style={styles.sessionNote}>{sessionNote}</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <AppIcon
              set="mci"
              name="clock"
              size={24}
              color={colors.contentSecondary}
            />
            <ThemedText style={styles.summaryText}>
              {formatToHoursMinutes(workout.duration)}
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon
              set="mci"
              name="numeric"
              size={24}
              color={colors.contentSecondary}
            />
            <ThemedText style={styles.summaryText}>
              <Plural
                value={workout.total_sets_completed}
                one="# set"
                other="# sets"
              />
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <AppIcon
              set="mci"
              name="scale"
              size={24}
              color={colors.contentSecondary}
            />
            <ThemedText style={styles.summaryText}>
              {formatNumber(totalVolume, 1)} {settings?.weightUnit}
            </ThemedText>
          </View>
        </View>

        {/* Exercise List */}
        <View style={styles.exerciseList}>
          {workout.exercises.map((exercise) => {
            const imageUri = exerciseThumbnailUri(
              exercise.exercise_image_uri,
              exercise.exercise_image,
            );

            return (
              <Card key={exercise.exercise_id} style={styles.exerciseCard}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityHint={t`Opens this exercise`}
                  style={styles.exerciseHeader}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push(exerciseHref(exercise.exercise_id, "progress"))
                  }
                >
                  {imageUri ? (
                    <AppImage
                      source={{ uri: imageUri }}
                      style={styles.exerciseImage}
                    />
                  ) : (
                    <AppImage
                      source={fallbackImage}
                      style={styles.exerciseImage}
                    />
                  )}
                  <ThemedText style={styles.exerciseName}>
                    {exercise.exercise_name}
                  </ThemedText>
                  <AppIcon
                    set="mci"
                    name="chevron-right"
                    size={22}
                    color={colors.contentSecondary}
                  />
                </TouchableOpacity>
                {/* Sets List */}
                {exercise.sets.map((set, index) => (
                  <View key={index}>
                    <View style={styles.setRow}>
                      <ThemedText style={styles.setText}>
                        <Trans>Set {set.set_number}</Trans>
                      </ThemedText>
                      {exercise.exercise_tracking_type === "time" ? (
                        <ThemedText style={styles.setText}>
                          {set.time != null
                            ? formatFromTotalSeconds(set.time)
                            : "—"}
                        </ThemedText>
                      ) : exercise.exercise_tracking_type === "reps" ? (
                        <ThemedText style={styles.setText}>
                          {set.reps != null ? (
                            <Plural
                              value={set.reps}
                              one="# Rep"
                              other="# Reps"
                            />
                          ) : (
                            "—"
                          )}
                        </ThemedText>
                      ) : exercise.exercise_tracking_type === "distance" ? (
                        <ThemedText style={styles.setText}>
                          {showValue(set.distance)} {distanceUnit}
                        </ThemedText>
                      ) : exercise.exercise_tracking_type === "weight" ? (
                        <ThemedText style={styles.setText}>
                          <Trans>
                            {showValue(set.weight)} {settings?.weightUnit} |{" "}
                            {set.reps ?? 0} Reps
                          </Trans>
                        </ThemedText>
                      ) : (
                        <ThemedText style={styles.setText}>
                          <Trans>
                            Assist {showValue(set.weight)}{" "}
                            {settings?.weightUnit} | Resist{" "}
                            {showValue(
                              set.weight != null
                                ? bodyWeight - set.weight
                                : null,
                            )}{" "}
                            {settings?.weightUnit} | {set.reps ?? 0} Reps
                          </Trans>
                        </ThemedText>
                      )}
                    </View>
                    {!!set.note?.trim() && (
                      <ThemedText style={styles.setNote}>
                        {set.note.trim()}
                      </ThemedText>
                    )}
                  </View>
                ))}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    container: {
      flex: 1,
      padding: 16,
    },
    topSection: {
      marginBottom: 24,
      alignItems: "center",
    },
    workoutName: {
      fontSize: 28,
      lineHeight: 28,
      fontWeight: "bold",
    },
    workoutDate: {
      fontSize: 16,
      marginTop: 4,
    },
    doAgain: {
      marginTop: 12,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 16,
    },
    summaryItem: {
      alignItems: "center",
    },
    summaryText: {
      fontSize: 16,
      marginTop: 4,
    },
    exerciseList: {
      marginBottom: 50,
    },
    exerciseCard: {
      marginBottom: 16,
      borderRadius: radii.md,
      paddingBottom: 8,
      elevation: 2,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      backgroundColor: colors.card,
    },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
    },
    exerciseImage: {
      width: 60,
      height: 60,
      borderRadius: radii.md,
      marginRight: 16,
    },
    exerciseName: {
      fontSize: 20,
      fontWeight: "bold",
      flex: 1,
      flexWrap: "wrap",
    },
    setRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      paddingHorizontal: 16,
    },
    setText: {
      fontSize: 16,
    },
    setNote: {
      fontSize: 14,
      color: colors.contentSecondary,
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    sessionNoteBox: {
      alignSelf: "stretch",
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 12,
    },
    sessionNoteLabel: {
      fontSize: 12,
      color: colors.contentSecondary,
    },
    sessionNote: {
      fontSize: 15,
    },
  });
}
