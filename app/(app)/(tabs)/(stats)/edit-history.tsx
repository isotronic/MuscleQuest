import { useMemo, useState, useEffect, useRef } from "react";
import { ScrollView, TextInput, StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Divider, IconButton } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useEditCompletedWorkoutMutation } from "@/hooks/useEditCompletedWorkoutMutation";
import { ActivityIndicator } from "react-native-paper";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import { formatFromTotalSeconds, convertToTotalSeconds } from "@/utils/utility";
import { TimeInput } from "@/components/TimeInput";
import Bugsnag from "@bugsnag/expo";
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

  const [exercises, setExercises] = useState<CompletedWorkout["exercises"]>([]);
  const [weightInputs, setWeightInputs] = useState<{ [key: string]: string }>(
    {},
  );
  const weightInputRefs = useRef<{ [key: string]: any }>({});

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
  // Update exercises when workout data is available
  useEffect(() => {
    if (workoutData) {
      setExercises(workoutData.exercises);
    }
  }, [workoutData]);

  useEffect(() => {
    const initialWeightInputs: { [key: string]: string } = {};
    exercises.forEach((exercise, exerciseIndex) => {
      exercise.sets.forEach((set, setIndex) => {
        const key = `${exerciseIndex}-${setIndex}`;
        initialWeightInputs[key] =
          set.weight !== null ? String(set.weight) : "";
      });
    });
    setWeightInputs(initialWeightInputs);
  }, [exercises]);

  const handleSave = () => {
    Object.values(weightInputRefs.current).forEach((input) => input?.blur());

    // Merge weightInputs into exercises synchronously — onBlur state updates
    // are batched by React and won't be applied before mutate runs.
    const finalExercises = exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      sets: exercise.sets.map((set, setIndex) => {
        const key = `${exerciseIndex}-${setIndex}`;
        if (weightInputs[key] === undefined) return set;
        const raw = weightInputs[key];
        if (raw == null || raw.trim() === "") return { ...set, weight: null };
        const parsedWeight = parseFloat(raw);
        return { ...set, weight: isNaN(parsedWeight) ? null : parsedWeight };
      }),
    }));

    editWorkout.mutate(finalExercises, {
      onSuccess: () => {
        router.back();
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
                <IconButton
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
            key={exercise.exercise_id}
            style={styles.exerciseContainer}
          >
            <ThemedText style={styles.exerciseName}>
              {exercise.exercise_name}
            </ThemedText>
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
                      <TextInput
                        ref={(ref: any) =>
                          (weightInputRefs.current[
                            `${exerciseIndex}-${setIndex}`
                          ] = ref)
                        }
                        style={styles.input}
                        placeholder={t`Weight`}
                        value={
                          weightInputs[`${exerciseIndex}-${setIndex}`] || ""
                        }
                        placeholderTextColor={colors.contentSecondary}
                        selectTextOnFocus={true}
                        keyboardType="numeric"
                        onChangeText={(value: string) => {
                          // Update temporary weightInputs state
                          if (/^\d*\.?\d*$/.test(value)) {
                            setWeightInputs((prev) => ({
                              ...prev,
                              [`${exerciseIndex}-${setIndex}`]: value,
                            }));
                          }
                        }}
                        onBlur={() => {
                          const parsedWeight = parseFloat(
                            weightInputs[`${exerciseIndex}-${setIndex}`] || "0",
                          );

                          setExercises((prev) => {
                            const updated = [...prev];
                            updated[exerciseIndex].sets[setIndex].weight =
                              isNaN(parsedWeight) ? null : parsedWeight;
                            return updated;
                          });
                        }}
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <ThemedText style={styles.label}>
                        <Trans>Reps</Trans>
                      </ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder={t`Reps`}
                        value={String(set.reps || "")}
                        placeholderTextColor={colors.contentSecondary}
                        selectTextOnFocus={true}
                        keyboardType="numeric"
                        onChangeText={(value: string) => {
                          setExercises((prev) => {
                            const updated = [...prev];
                            updated[exerciseIndex].sets[setIndex].reps =
                              Number(value);
                            return updated;
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
                      value={formatFromTotalSeconds(set.time || 0)}
                      onChange={(value: string) => {
                        setExercises((prev) => {
                          const updated = [...prev];
                          updated[exerciseIndex].sets[setIndex].time =
                            convertToTotalSeconds(value);
                          return updated;
                        });
                      }}
                      style={styles.timeInput}
                    />
                  </View>
                ) : exercise.exercise_tracking_type === "reps" ? (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>
                      <Trans>Reps</Trans>
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder={t`Reps`}
                      value={String(set.reps || "")}
                      placeholderTextColor={colors.contentSecondary}
                      selectTextOnFocus={true}
                      keyboardType="numeric"
                      onChangeText={(value: string) => {
                        setExercises((prev) => {
                          const updated = [...prev];
                          updated[exerciseIndex].sets[setIndex].reps =
                            Number(value);
                          return updated;
                        });
                      }}
                    />
                  </View>
                ) : exercise.exercise_tracking_type === "distance" ? (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>
                      <Trans>Distance ({distanceUnit})</Trans>
                    </ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder={t`Distance`}
                      value={set.distance != null ? String(set.distance) : ""}
                      placeholderTextColor={colors.contentSecondary}
                      selectTextOnFocus={true}
                      keyboardType="numeric"
                      onChangeText={(value: string) => {
                        setExercises((prev) => {
                          const updated = [...prev];
                          updated[exerciseIndex].sets[setIndex].distance =
                            value === "" ? null : parseFloat(value);
                          return updated;
                        });
                      }}
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
