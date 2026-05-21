import { StyleSheet, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Colors } from "@/constants/Colors";

interface WorkoutCardProps {
  workout: CompletedWorkout;
  onPress: (id: number) => void;
  excludeWarmup?: boolean;
}

export default function WorkoutHistoryCard({
  workout,
  onPress,
  excludeWarmup = false,
}: WorkoutCardProps) {
  const setsCount = excludeWarmup
    ? workout.exercises.reduce(
        (t, e) => t + e.sets.filter((s) => !s.is_warmup).length,
        0,
      )
    : workout.total_sets_completed;
  return (
    <TouchableOpacity
      onPress={() => onPress(workout.id)}
      style={styles.cardContainer}
    >
      <ThemedView style={styles.card}>
        <ThemedText style={styles.workoutName}>
          {workout.workout_name}
        </ThemedText>
        <ThemedText style={styles.workoutDate}>
          {new Date(workout.date_completed).toLocaleDateString()}
        </ThemedText>
        <ThemedText style={styles.workoutDuration}>
          Duration: {Math.round(workout.duration / 60)} min
        </ThemedText>
        <ThemedText style={styles.workoutSets}>Sets: {setsCount}</ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginRight: 8,
  },
  card: {
    width: 200,
    padding: 16,
    borderRadius: 6,
    backgroundColor: Colors.dark.cardBackground,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4, // For Android shadow
  },
  workoutName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  workoutDate: {
    marginTop: 8,
    fontSize: 14,
  },
  workoutDuration: {
    marginTop: 4,
    fontSize: 14,
  },
  workoutSets: {
    marginTop: 4,
    fontSize: 14,
  },
});
