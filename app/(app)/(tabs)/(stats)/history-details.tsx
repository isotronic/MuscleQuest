import { useEffect, useState, useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Image } from "expo-image";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ActivityIndicator, Card, IconButton } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import {
  router,
  Stack,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { fetchExerciseImagesByIds } from "@/utils/database";
import { byteArrayToBase64 } from "@/utils/utility";
import { parseISO, format } from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import Bugsnag from "@bugsnag/expo";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function HistoryDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";
  const bodyWeight = parseFloat(settings?.bodyWeight || "70");

  const {
    data: workoutData,
    isLoading: isWorkoutLoading,
    error: workoutError,
    refetch,
  } = useCompletedWorkoutByIdQuery(Number(id), weightUnit);

  useEffect(() => {
    if (workoutData) {
      // Collect unique exercise IDs
      const exerciseIds = workoutData.exercises.map(
        (exercise) => exercise.exercise_id,
      );

      // Fetch images for these exercise IDs and attach them to the exercises
      const fetchImages = async () => {
        try {
          const imagesMap = await fetchExerciseImagesByIds(exerciseIds);

          // Attach images to exercises
          const exercisesWithImages = workoutData.exercises.map((exercise) => ({
            ...exercise,
            exercise_image: imagesMap[exercise.exercise_id],
          }));

          // Update workout data with exercises including images
          setWorkout({
            ...workoutData,
            exercises: exercisesWithImages,
          });
        } catch (error: any) {
          console.error("Error fetching exercise images:", error);
          Bugsnag.notify(error);
        }
      };

      fetchImages();
    }
  }, [workoutData]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Calculate total volume
  const totalVolume = useMemo(() => {
    if (!workout) {
      return 0;
    }

    return workout.exercises.reduce((exerciseAcc, exercise) => {
      const exerciseVolume = exercise.sets.reduce((setAcc, set) => {
        // Check if the tracking type is "assistance" and apply custom calculation
        const weight =
          exercise.exercise_tracking_type === "assisted"
            ? bodyWeight - (set.weight || 0)
            : set.weight || 0;

        return setAcc + weight * (set.reps || 0);
      }, 0);

      return parseFloat((exerciseAcc + exerciseVolume).toFixed(1));
    }, 0);
  }, [workout, bodyWeight]);

  if (isWorkoutLoading || !workout || settingsLoading) {
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

  const isoDateString = workout.date_completed.replace(" ", "T");
  const parsedDate = parseISO(isoDateString);
  const formattedDate = format(parsedDate, "dd/MM/yyyy 'at' HH:mm");

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton
                icon="file-document-edit-outline"
                size={30}
                style={{ marginRight: 0 }}
                iconColor={Colors.dark.text}
                onPressIn={() =>
                  router.push({
                    pathname: "/(stats)/edit-history",
                    params: { id },
                  })
                }
              />
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container}>
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
              {Math.round(workout.duration / 60)} mins
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
        <View style={styles.exerciseList}>
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
                    <Image
                      source={fallbackImage}
                      style={styles.exerciseImage}
                    />
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
                    {exercise.exercise_tracking_type === "time" ? (
                      <ThemedText style={styles.setText}>
                        {set.time} Seconds
                      </ThemedText>
                    ) : exercise.exercise_tracking_type === "reps" ? (
                      <ThemedText style={styles.setText}>
                        {set.reps} Reps
                      </ThemedText>
                    ) : exercise.exercise_tracking_type === "weight" ? (
                      <ThemedText style={styles.setText}>
                        {set.weight} {settings?.weightUnit} | {set.reps} Reps
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.setText}>
                        Assist {set.weight} {settings?.weightUnit} | Resist{" "}
                        {bodyWeight - (set.weight || 0)} {settings?.weightUnit}{" "}
                        | {set.reps} Reps
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
  exerciseList: {
    marginBottom: 50,
  },
  exerciseCard: {
    marginBottom: 16,
    borderRadius: 8,
    paddingBottom: 8,
    elevation: 2, // For Android
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", // For iOS
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
