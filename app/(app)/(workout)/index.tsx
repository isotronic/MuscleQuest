import React from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { IconButton, Card } from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router } from "expo-router"; // Import router from expo-router
import { Colors } from "@/constants/Colors";

export default function WorkoutOverviewScreen() {
  const { workout, completedSets } = useActiveWorkoutStore();

  if (!workout) {
    return <ThemedText>No workout available</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        {workout.exercises.map((exercise, index) => {
          const completedSetsForExercise = completedSets[index] || {};
          const completedCount = Object.values(completedSetsForExercise).filter(
            (setCompleted) => setCompleted === true,
          ).length;
          return (
            <TouchableOpacity
              key={exercise.exercise_id}
              onPress={() =>
                router.push({
                  pathname: "workout-session",
                  params: { selectedExerciseIndex: index },
                })
              }
            >
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  {/* Circle with the number */}
                  <View style={styles.numberContainer}>
                    <ThemedText style={styles.numberText}>
                      {index + 1}
                    </ThemedText>
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
    padding: 20,
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
