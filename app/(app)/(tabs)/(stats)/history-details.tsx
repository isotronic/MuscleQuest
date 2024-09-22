import { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Image } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ActivityIndicator, Card } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import { useLocalSearchParams } from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import {
  fetchCompletedWorkoutById,
  fetchExerciseImagesByIds,
} from "@/utils/database";
import { byteArrayToBase64 } from "@/utils/utility";
import { parseISO, format } from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";

export default function HistoryDetailsScreen() {
  const { workoutId } = useLocalSearchParams();
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

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

  if (isLoading || !workout || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (settingsError) {
    return <ThemedText>Error: {settingsError.message}</ThemedText>;
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
            Completed on: {formattedDate}
          </ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons
              name="clock"
              size={24}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.summaryText}>
              {workout.duration} mins
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons
              name="numeric"
              size={24}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.summaryText}>
              {workout.total_sets_completed} sets
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons
              name="scale"
              size={24}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.summaryText}>
              {totalVolume} {settings?.weightUnit}
            </ThemedText>
          </View>
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
            <Card key={exercise.exercise_id} style={styles.exerciseCard}>
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
                    {set.weight} {settings?.weightUnit} | {set.reps} Reps
                  </ThemedText>
                </View>
              ))}
            </Card>
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
  exerciseCard: {
    marginBottom: 16,
    borderRadius: 8,
    paddingBottom: 8,
    elevation: 2, // For Android
    shadowColor: "#000", // For iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: Colors.dark.cardBackground,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  exerciseImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
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
