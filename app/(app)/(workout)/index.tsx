import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { IconButton, Card, Menu, Button } from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSaveCompletedWorkoutMutation } from "@/hooks/useSaveCompletedWorkoutMutation";
import { useCompletedWorkoutsQuery } from "@/hooks/useCompletedWorkoutsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSoundAndVibration } from "@/hooks/useSoundAndVibration";
import Bugsnag from "@bugsnag/expo";
import SaveIcon from "@/components/SaveIcon";

export default function WorkoutOverviewScreen() {
  const { data: settings } = useSettingsQuery();
  const {
    workout,
    completedSets,
    weightAndReps,
    startTime,
    activeWorkout,
    deleteExercise,
    clearPersistedStore,
    restartWorkout,
  } = useActiveWorkoutStore();

  const weightUnit = settings?.weightUnit || "kg";
  const { data: completedWorkouts, error: completedWorkoutsError } =
    useCompletedWorkoutsQuery(weightUnit);
  const currentWorkoutHistory = completedWorkouts?.find(
    (completedWorkout) => completedWorkout.workout_name === activeWorkout?.name,
  );
  const saveCompletedWorkoutMutation =
    useSaveCompletedWorkoutMutation(weightUnit);

  useKeepScreenOn();

  const { unloadSound } = useSoundAndVibration();

  const [menuVisible, setMenuVisible] = useState<{ [key: number]: boolean }>(
    {},
  );

  // Calculate if any sets are completed
  const hasCompletedSets = useMemo(() => {
    return Object.values(completedSets).some((exerciseSets) =>
      Object.values(exerciseSets).some((setCompleted) => setCompleted === true),
    );
  }, [completedSets]);

  const handleMenuOpen = (index: number) => {
    setMenuVisible((prev) => ({ ...prev, [index]: true }));
  };

  const handleMenuClose = (index: number) => {
    setMenuVisible((prev) => ({ ...prev, [index]: false }));
  };

  const handleDeleteExercise = (index: number) => {
    Alert.alert(
      "Delete Exercise",
      "Are you sure you want to delete this exercise?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteExercise(index);
          },
        },
      ],
    );
  };

  const handleReplaceExercise = (index: number) => {
    // Navigate to the exercises screen for replacing
    router.push({
      pathname: "/(app)/(workout)/exercises",
      params: { replaceExerciseIndex: index },
    });
  };

  const handleExercisePress = (index: number) => {
    const historyString = currentWorkoutHistory
      ? JSON.stringify(currentWorkoutHistory)
      : undefined;

    router.push({
      pathname: "/(app)/(workout)/workout-session",
      params: {
        selectedExerciseIndex: index,
        workoutHistory: historyString,
      },
    });
  };

  const handleSaveWorkout = async () => {
    const planId = activeWorkout?.planId;
    const workoutId = activeWorkout?.workoutId;
    const endTime = new Date();
    const duration = startTime
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : 0;
    const totalSetsCompleted = Object.values(completedSets).reduce(
      (total, exerciseSets) => {
        const setsCompleted = Object.values(exerciseSets).filter(
          (setCompleted) => setCompleted === true,
        ).length;
        return total + setsCompleted;
      },
      0,
    );

    if (workout && planId && workoutId) {
      const exercises = workout.exercises
        .map((exercise, index) => {
          const completedSetIndices = Object.entries(completedSets[index] || {})
            .filter(([, isCompleted]) => isCompleted)
            .map(([setIndex]) => parseInt(setIndex));

          if (completedSetIndices.length === 0) {
            return null; // Exclude exercises with no completed sets
          }

          const sets = Object.entries(weightAndReps[index] || {})
            .filter(([setIndex]) =>
              completedSetIndices.includes(parseInt(setIndex)),
            )
            .map(([setIndex, set]) => ({
              set_number: parseInt(setIndex) + 1,
              weight: set.weight ? parseFloat(set.weight) : null,
              reps: set.reps ? parseInt(set.reps) : null,
              time: set.time ? parseInt(set.time) : null,
            }));

          return {
            exercise_id: exercise.exercise_id,
            sets,
          };
        })
        .filter((exercise) => exercise !== null); // Remove null values from exercises

      if (exercises.length > 0) {
        saveCompletedWorkoutMutation.mutate(
          {
            planId,
            workoutId,
            duration,
            totalSetsCompleted,
            exercises,
          },
          {
            onSuccess: () => {
              console.log("Workout saved successfully!");
              unloadSound();
              clearPersistedStore();
              router.push("/(tabs)");
            },
            onError: (error) => {
              Alert.alert(
                "Error",
                "Failed to save workout. Please try again.",
                [{ text: "OK" }],
              );
              Bugsnag.notify(error);
              console.error("Error saving workout: ", error);
            },
          },
        );
      } else {
        console.warn("No completed exercises to save.");
      }
    }
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      "Cancel Workout",
      "Are you sure you want to cancel and delete this workout?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            clearPersistedStore();
            // Navigate back to the main screen or home screen
            router.push("/(tabs)");
          },
        },
      ],
    );
  };

  const handleRestartWorkout = () => {
    Alert.alert(
      "Restart Workout",
      "Are you sure you want to restart this workout?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            restartWorkout();
          },
        },
      ],
    );
  };

  if (!workout) {
    return (
      <ThemedView>
        <ThemedText>No workout available</ThemedText>
      </ThemedView>
    );
  }

  if (completedWorkoutsError) {
    Bugsnag.notify(completedWorkoutsError);
    return (
      <ThemedView>
        <ThemedText>
          Error loading completed workouts: {completedWorkoutsError.message}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <Button
                mode="text"
                icon={SaveIcon}
                style={{ marginRight: 0 }}
                labelStyle={styles.buttonLabel}
                disabled={!hasCompletedSets}
                onPress={handleSaveWorkout}
              >
                Save
              </Button>
              <Menu
                visible={menuVisible[69420]}
                onDismiss={() => handleMenuClose(69420)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    size={24}
                    onPress={() => handleMenuOpen(69420)}
                    style={styles.optionsButton}
                    iconColor={Colors.dark.text}
                  />
                }
              >
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleRestartWorkout();
                  }}
                  title="Restart"
                />
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleCancelWorkout();
                  }}
                  title="Cancel"
                />
              </Menu>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container}>
        {workout.exercises.map((exercise, index) => {
          const completedSetsForExercise = completedSets[index] || {};
          const completedCount = Object.values(completedSetsForExercise).filter(
            (setCompleted) => setCompleted === true,
          ).length;
          const totalSets = exercise.sets.length;
          const allSetsCompleted = completedCount === totalSets;
          return (
            <TouchableOpacity
              key={exercise.exercise_id}
              onPress={() => handleExercisePress(index)}
            >
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  {/* Circle with the number or checkmark */}
                  <View
                    style={[
                      styles.numberContainer,
                      allSetsCompleted && styles.numberContainerCompleted,
                    ]}
                  >
                    {allSetsCompleted ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={24}
                        color="white"
                      />
                    ) : (
                      <ThemedText style={styles.numberText}>
                        {index + 1}
                      </ThemedText>
                    )}
                  </View>

                  {/* Exercise Info */}
                  <View style={styles.exerciseInfo}>
                    <ThemedText style={styles.exerciseName}>
                      {exercise.name}
                    </ThemedText>
                    <ThemedText style={styles.setInfo}>
                      {completedCount}/{exercise.sets.length} sets completed
                    </ThemedText>
                  </View>

                  {/* Options Menu */}
                  <Menu
                    visible={menuVisible[index]}
                    onDismiss={() => handleMenuClose(index)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={24}
                        onPress={() => handleMenuOpen(index)}
                        style={styles.optionsButton}
                        iconColor={Colors.dark.text}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        handleMenuClose(index);
                        handleDeleteExercise(index);
                      }}
                      title="Delete"
                    />
                    <Menu.Item
                      onPress={() => {
                        handleMenuClose(index);
                        handleReplaceExercise(index);
                      }}
                      title="Replace"
                    />
                  </Menu>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 16,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 10,
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 10,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  numberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.dark.text,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  numberContainerCompleted: {
    backgroundColor: Colors.dark.completed,
    borderColor: Colors.dark.completed,
  },
  numberText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.dark.text,
  },
  setInfo: {
    fontSize: 14,
    color: Colors.dark.subText,
  },
  optionsButton: {
    padding: 0,
    marginRight: 0,
  },
});
