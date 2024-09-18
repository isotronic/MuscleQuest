// screens/WorkoutDetail.tsx
import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Image } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ActivityIndicator } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import { useLocalSearchParams } from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import {
  fetchCompletedWorkoutById,
  fetchExerciseImagesByIds,
} from "@/utils/database";
import { byteArrayToBase64 } from "@/utils/utility";
import { parseISO, format } from "date-fns";

export default function HistoryDetailsScreen() {
  const { workoutId } = useLocalSearchParams();
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkout = async () => {
      try {
        const data = await fetchCompletedWorkoutById(Number(workoutId));

        // Collect unique exercise IDs
        const exerciseIds = data.exercises.map(
          (exercise) => exercise.exercise_id,
        );

        // Fetch images for these exercise IDs
        const imagesMap = await fetchExerciseImagesByIds(exerciseIds);

        // Attach images to exercises
        const exercisesWithImages = data.exercises.map((exercise) => ({
          ...exercise,
          exercise_image: imagesMap[exercise.exercise_id],
        }));

        // Update workout data with exercises including images
        setWorkout({
          ...data,
          exercises: exercisesWithImages,
        });
      } catch (error) {
        console.error("Error fetching workout:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkout();
  }, [workoutId]);

  // Calculate total volume
  const totalVolume = useMemo(() => {
    if (!workout) {
      return 0;
    }

    return workout.exercises.reduce((exerciseAcc, exercise) => {
      const exerciseVolume = exercise.sets.reduce((setAcc, set) => {
        return setAcc + set.weight * set.reps;
      }, 0);
      return exerciseAcc + exerciseVolume;
    }, 0);
  }, [workout]);

  if (isLoading || !workout) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  const isoDateString = workout.date_completed.replace(" ", "T");
  const parsedDate = parseISO(isoDateString);
  const formattedDate = format(parsedDate, "dd/MM/yyyy 'at' HH:mm");

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        {/* Top Section */}
        <View style={styles.topSection}>
          <ThemedText style={styles.workoutName}>
            {workout.workout_name}
          </ThemedText>
          <ThemedText style={styles.workoutDate}>
            Completed on {formattedDate}
          </ThemedText>
          <ThemedText style={styles.totalVolume}>
            Total Volume: {totalVolume} kg
          </ThemedText>
        </View>

        {/* Exercise List */}
        {workout.exercises.map((exercise) => {
          // Check if the image exists
          let imageUri = "";
          if (exercise.exercise_image) {
            // Convert the image blob to Base64
            const base64Image = byteArrayToBase64(exercise.exercise_image);
            imageUri = `data:image/webp;base64,${base64Image}`;
          }

          return (
            <View key={exercise.exercise_id} style={styles.exerciseSection}>
              <View style={styles.exerciseHeader}>
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.exerciseImage}
                  />
                ) : (
                  <View style={[styles.exerciseImage, styles.placeholderImage]}>
                    <ThemedText>No Image</ThemedText>
                  </View>
                )}
                <ThemedText style={styles.exerciseName}>
                  {exercise.exercise_name}
                </ThemedText>
              </View>
              {/* Sets List */}
              {exercise.sets.map((set, index) => (
                <View key={index} style={styles.setRow}>
                  <ThemedText style={styles.setText}>
                    Set {set.set_number}
                  </ThemedText>
                  <ThemedText style={styles.setText}>
                    Reps: {set.reps} | Weight: {set.weight} kg
                  </ThemedText>
                </View>
              ))}
            </View>
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
  topSection: {
    marginBottom: 32,
    alignItems: "center",
  },
  workoutName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  workoutDate: {
    fontSize: 16,
    marginTop: 8,
  },
  totalVolume: {
    fontSize: 18,
    marginTop: 8,
    fontWeight: "bold",
  },
  exerciseSection: {
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  exerciseImage: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: "bold",
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
});
