import { useState, useEffect, useRef } from "react";
import { ScrollView, TextInput, StyleSheet, View } from "react-native";
import { Divider, IconButton } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useEditCompletedWorkoutMutation } from "@/hooks/useEditCompletedWorkoutMutation";
import { ActivityIndicator } from "react-native-paper";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import Bugsnag from "@bugsnag/expo";

export default function EditCompletedWorkoutScreen() {
  const { id } = useLocalSearchParams();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";

  const [exercises, setExercises] = useState<CompletedWorkout["exercises"]>([]);
  const [weightInputs, setWeightInputs] = useState<{ [key: string]: string }>(
    {},
  );
  const weightInputRefs = useRef<{ [key: string]: any }>({});

  const {
    data: workoutData,
    isLoading: isWorkoutLoading,
    error: workoutError,
  } = useCompletedWorkoutByIdQuery(Number(id), weightUnit);

  const editWorkout = useEditCompletedWorkoutMutation(Number(id), weightUnit);

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
    // Blur each input to ensure all onBlur events are fired
    Object.values(weightInputRefs.current).forEach((input) => input?.blur());

    editWorkout.mutate(exercises, {
      onSuccess: () => {
        router.back();
      },
    });
  };

  if (isWorkoutLoading || !exercises || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
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
              <IconButton
                icon="content-save-outline"
                size={35}
                style={{ marginRight: 0 }}
                iconColor={Colors.dark.tint}
                onPressIn={handleSave}
              />
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
                  Set {set.set_number}
                </ThemedText>
                <Divider style={styles.divider} />
                {exercise.exercise_tracking_type === "weight" ||
                exercise.exercise_tracking_type === "assisted" ? (
                  <View>
                    <View style={styles.inputContainer}>
                      <ThemedText style={styles.label}>
                        {exercise.exercise_tracking_type === "weight"
                          ? "Weight"
                          : "Assist"}{" "}
                        ({weightUnit})
                      </ThemedText>
                      <TextInput
                        ref={(ref: any) =>
                          (weightInputRefs.current[
                            `${exerciseIndex}-${setIndex}`
                          ] = ref)
                        }
                        style={styles.input}
                        placeholder="Weight"
                        value={
                          weightInputs[`${exerciseIndex}-${setIndex}`] || ""
                        }
                        placeholderTextColor={Colors.dark.subText}
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
                      <ThemedText style={styles.label}>Reps</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="Reps"
                        value={String(set.reps || "")}
                        placeholderTextColor={Colors.dark.subText}
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
                    <ThemedText style={styles.label}>Time (Seconds)</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Time"
                      value={String(set.time || "")}
                      placeholderTextColor={Colors.dark.subText}
                      selectTextOnFocus={true}
                      keyboardType="numeric"
                      onChangeText={(value: string) => {
                        setExercises((prev) => {
                          const updated = [...prev];
                          updated[exerciseIndex].sets[setIndex].time =
                            Number(value);
                          return updated;
                        });
                      }}
                    />
                  </View>
                ) : exercise.exercise_tracking_type === "reps" ? (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.label}>Reps</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="Reps"
                      value={String(set.reps || "")}
                      placeholderTextColor={Colors.dark.subText}
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
                ) : null}
              </ThemedView>
            ))}
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    textAlign: "right",
  },
});
