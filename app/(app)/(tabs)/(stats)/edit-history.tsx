import { useMemo, useState, useEffect, useCallback } from "react";
import { AppIconButton } from "@/components/ui";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { ScrollView, TextInput, StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Divider } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  router,
  Stack,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useEditCompletedWorkoutMutation } from "@/hooks/useEditCompletedWorkoutMutation";
import { ActivityIndicator } from "react-native-paper";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import { formatFromTotalSeconds, convertToTotalSeconds } from "@/utils/utility";
import { parseDecimalInput, sanitizeIntegerInput } from "@/utils/numberFormat";
import { TimeInput } from "@/components/TimeInput";
import Bugsnag from "@bugsnag/expo";
import { useExercisePickerStore } from "@/store/exercisePickerStore";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export default function EditCompletedWorkoutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";

  type Exercises = CompletedWorkout["exercises"];
  type EditedSet = Exercises[number]["sets"][number];

  // Edited copy of the loaded workout. Updated immutably: the loaded data is
  // the query cache's object and doubles as the original the save diffs
  // against.
  const [exercises, setExercises] = useState<Exercises>([]);
  // Decimal fields are held as canonical text while typing ("62." must
  // survive a keystroke) and parsed on save. Keyed by set_id.
  const [weightInputs, setWeightInputs] = useState<Record<number, string>>({});
  const [distanceInputs, setDistanceInputs] = useState<Record<number, string>>(
    {},
  );

  const [editingCompletedExerciseId, setEditingCompletedExerciseId] = useState<
    number | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      const picked = useExercisePickerStore.getState().pickedExercise;
      if (picked && editingCompletedExerciseId != null) {
        setExercises((prev) =>
          prev.map((exercise) =>
            exercise.completed_exercise_id === editingCompletedExerciseId
              ? {
                  ...exercise,
                  exercise_id: picked.exercise_id,
                  exercise_name: picked.name,
                  exercise_image: picked.image,
                  exercise_image_uri: picked.image_uri,
                  exercise_tracking_type: picked.tracking_type || "weight",
                  is_unilateral: picked.is_unilateral,
                  double_weight: picked.double_weight,
                }
              : exercise,
          ),
        );
        useExercisePickerStore.getState().clearPickedExercise();
        setEditingCompletedExerciseId(null);
      }
    }, [editingCompletedExerciseId]),
  );

  const {
    data: workoutData,
    isLoading: isWorkoutLoading,
    error: workoutError,
  } = useCompletedWorkoutByIdQuery(Number(id), weightUnit, distanceUnit);

  const editWorkout = useEditCompletedWorkoutMutation(
    Number(id),
    weightUnit,
    distanceUnit,
  );
  // Seed the edit state when the workout loads
  useEffect(() => {
    if (!workoutData) return;
    setExercises(workoutData.exercises);
    const weights: Record<number, string> = {};
    const distances: Record<number, string> = {};
    for (const exercise of workoutData.exercises) {
      for (const set of exercise.sets) {
        weights[set.set_id] = set.weight != null ? String(set.weight) : "";
        distances[set.set_id] =
          set.distance != null ? String(set.distance) : "";
      }
    }
    setWeightInputs(weights);
    setDistanceInputs(distances);
  }, [workoutData]);

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<EditedSet>,
  ) =>
    setExercises((prev) =>
      prev.map((exercise, i) =>
        i !== exerciseIndex
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set, j) =>
                j === setIndex ? { ...set, ...patch } : set,
              ),
            },
      ),
    );

  const handleSave = () => {
    if (!workoutData) return;
    const edited = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        weight: parseDecimalInput(weightInputs[set.set_id] ?? ""),
        distance: parseDecimalInput(distanceInputs[set.set_id] ?? ""),
      })),
    }));

    editWorkout.mutate(
      { original: workoutData.exercises, edited },
      {
        onSuccess: () => {
          router.back();
        },
      },
    );
  };

  const handleChangeExercise = (exercise: CompletedWorkout["exercises"][0]) => {
    setEditingCompletedExerciseId(exercise.completed_exercise_id);
    router.push({
      pathname: "/(app)/exercise-library",
      params: {
        mode: "select",
        trackingType: exercise.exercise_tracking_type,
      },
    });
  };

  if (isWorkoutLoading || !exercises || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  if (settingsError || workoutError) {
    const error = settingsError || workoutError;
    if (error instanceof Error) {
      Bugsnag.notify(error);
      return <ThemedText>Error: {error.message}</ThemedText>;
    }
  }

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              {editWorkout.isPending ? (
                <ActivityIndicator
                  size={24}
                  color={colors.accent}
                  style={{ marginRight: 12 }}
                />
              ) : (
                <AppIconButton
                  accessibilityLabel={t`Save changes`}
                  icon="content-save-outline"
                  size={35}
                  style={{ marginRight: 0 }}
                  iconColor={colors.accent}
                  onPressIn={handleSave}
                />
              )}
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {exercises.map((exercise, exerciseIndex) => (
          <ThemedView
            key={exercise.completed_exercise_id}
            style={styles.exerciseContainer}
          >
            <View style={styles.exerciseHeader}>
              <ThemedText style={styles.exerciseName}>
                {exercise.exercise_name}
              </ThemedText>
              <AppIconButton
                accessibilityLabel={t`Change exercise ${exercise.exercise_name}`}
                icon="pencil-outline"
                size={20}
                onPress={() => handleChangeExercise(exercise)}
              />
            </View>
            {exercise.sets.map((set, setIndex) => (
              <ThemedView key={set.set_number} style={styles.setContainer}>
                <ThemedText style={styles.setNumber}>
                  <Trans>Set {set.set_number}</Trans>
                </ThemedText>
                <Divider style={styles.divider} />
                {exercise.exercise_tracking_type === "weight" ||
                exercise.exercise_tracking_type === "assisted" ? (
                  <View>
                    <View style={styles.inputContainer}>
                      <ThemedText style={styles.label}>
                        {exercise.exercise_tracking_type === "weight" ? (
                          <Trans>Weight</Trans>
                        ) : (
                          <Trans>Assist</Trans>
                        )}{" "}
                        ({weightUnit})
                      </ThemedText>
                      <DecimalInput
                        accessibilityLabel={
                          exercise.exercise_tracking_type === "weight"
                            ? t`Weight in ${weightUnit}, set ${set.set_number}`
                            : t`Assistance in ${weightUnit}, set ${set.set_number}`
                        }
                        style={styles.input}
                        placeholder={t`Weight`}
                        value={weightInputs[set.set_id] ?? ""}
                        placeholderTextColor={colors.contentSecondary}
                        selectTextOnFocus={true}
                        onChangeValue={(value) =>
                          setWeightInputs((prev) => ({
                            ...prev,
                            [set.set_id]: value,
                          }))
                        }
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <ThemedText style={styles.label}>
                        <Trans>Reps</Trans>
                      </ThemedText>
                      <TextInput
                        accessibilityLabel={t`Reps, set ${set.set_number}`}
                        style={styles.input}
                        placeholder={t`Reps`}
                        value={String(set.reps || "")}
                        placeholderTextColor={colors.contentSecondary}
                        selectTextOnFocus={true}
                        keyboardType="number-pad"
                        onChangeText={(value: string) => {
                          const digits = sanitizeIntegerInput(value);
                          updateSet(exerciseIndex, setIndex, {
                            reps: digits === "" ? null : Number(digits),
                          });
                        }}
                      />
                    </View>
                  </View>
                ) : exercise.exercise_tracking_type === "time" ? (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>
                      <Trans>Time (Min:Sec)</Trans>
                    </ThemedText>
                    <TimeInput
                      accessibilityLabel={t`Time, set ${set.set_number}`}
                      value={formatFromTotalSeconds(set.time || 0)}
                      onChange={(value: string) =>
                        updateSet(exerciseIndex, setIndex, {
                          time: convertToTotalSeconds(value),
                        })
                      }
                      style={styles.timeInput}
                    />
                  </View>
                ) : exercise.exercise_tracking_type === "reps" ? (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>
                      <Trans>Reps</Trans>
                    </ThemedText>
                    <TextInput
                      accessibilityLabel={t`Reps, set ${set.set_number}`}
                      style={styles.input}
                      placeholder={t`Reps`}
                      value={String(set.reps || "")}
                      placeholderTextColor={colors.contentSecondary}
                      selectTextOnFocus={true}
                      keyboardType="number-pad"
                      onChangeText={(value: string) => {
                        const digits = sanitizeIntegerInput(value);
                        updateSet(exerciseIndex, setIndex, {
                          reps: digits === "" ? null : Number(digits),
                        });
                      }}
                    />
                  </View>
                ) : exercise.exercise_tracking_type === "distance" ? (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>
                      <Trans>Distance ({distanceUnit})</Trans>
                    </ThemedText>
                    <DecimalInput
                      accessibilityLabel={t`Distance in ${distanceUnit}, set ${set.set_number}`}
                      style={styles.input}
                      placeholder={t`Distance`}
                      value={distanceInputs[set.set_id] ?? ""}
                      placeholderTextColor={colors.contentSecondary}
                      selectTextOnFocus={true}
                      onChangeValue={(value) =>
                        setDistanceInputs((prev) => ({
                          ...prev,
                          [set.set_id]: value,
                        }))
                      }
                    />
                  </View>
                ) : null}
              </ThemedView>
            ))}
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {},
    headerRight: {},
    exerciseContainer: { marginBottom: 16 },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    setContainer: { marginBottom: 8 },
    exerciseName: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
    setNumber: { fontWeight: "bold" },
    divider: { marginBottom: 8 },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 8,
    },
    label: {
      width: 120,
      marginRight: 10,
    },
    input: {
      flex: 1,
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      textAlign: "right",
    },
    timeInput: {
      width: 96,
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      textAlign: "center",
    },
  });
}
