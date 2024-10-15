import { useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { IconButton, Card } from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useNavigation } from "expo-router";
import { Colors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSaveCompletedWorkoutMutation } from "@/hooks/useSaveCompletedWorkoutMutation";
import { useCompletedWorkoutsQuery } from "@/hooks/useCompletedWorkoutsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";

export default function WorkoutOverviewScreen() {
  const navigation = useNavigation();
  const { data: settings } = useSettingsQuery();
  const { workout, completedSets, weightAndReps, startTime, activeWorkout } =
    useActiveWorkoutStore();

  const weightUnit = settings?.weightUnit || "kg";
  const { data: completedWorkouts } = useCompletedWorkoutsQuery(weightUnit);
  const currentWorkoutHistory = completedWorkouts?.find(
    (completedWorkout) => completedWorkout.workout_name === activeWorkout?.name,
  );
  const saveCompletedWorkoutMutation =
    useSaveCompletedWorkoutMutation(weightUnit);

  useKeepScreenOn();

  // Calculate if any sets are completed
  const hasCompletedSets = useMemo(() => {
    return Object.values(completedSets).some((exerciseSets) =>
      Object.values(exerciseSets).some((setCompleted) => setCompleted === true),
    );
  }, [completedSets]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      Alert.alert(
        "Discard Workout?",
        "Do you really want to quit your current workout without saving?",
        [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation]);

  const handleExercisePress = (index: number) => {
    const historyString = currentWorkoutHistory
      ? JSON.stringify(currentWorkoutHistory)
      : undefined;

    router.push({
      pathname: "workout-session",
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
              weight: parseFloat(set.weight),
              reps: parseInt(set.reps),
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
            notes: null,
          },
          {
            onSuccess: () => {
              console.log("Workout saved successfully!");
              router.push("/(tabs)");
            },
            onError: (error) => {
              Alert.alert(
                "Error",
                "Failed to save workout. Please try again.",
                [{ text: "OK" }],
              );
              console.error("Error saving workout: ", error);
            },
          },
        );
      } else {
        console.warn("No completed exercises to save.");
      }
    }
  };

  if (!workout) {
    return <ThemedText>No workout available</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <MaterialCommunityIcons
              name="content-save-outline"
              size={35}
              label="Save"
              color={
                hasCompletedSets
                  ? Colors.dark.tint
                  : Colors.dark.disabledButtonBackground
              }
              onPress={hasCompletedSets ? handleSaveWorkout : undefined}
            />
          ),
        }}
      />
      <ScrollView>
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

                  {/* Three-dot options */}
                  <IconButton
                    icon="dots-vertical"
                    size={24}
                    onPress={() => console.log("Options pressed")}
                    style={styles.optionsButton}
                    iconColor={Colors.dark.text}
                  />
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
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 15,
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
    marginRight: 10,
  },
  numberContainerCompleted: {
    backgroundColor: "green",
    borderColor: "green",
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
    marginBottom: 5,
    color: Colors.dark.text,
  },
  setInfo: {
    fontSize: 14,
    color: Colors.dark.subText,
  },
  optionsButton: {
    padding: 0,
  },
});
