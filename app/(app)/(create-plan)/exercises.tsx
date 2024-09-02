import { useState } from "react";
import { View, TextInput, FlatList, StyleSheet } from "react-native";
import { Checkbox, Button } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercises } from "@/hooks/useExercises";
import { router, useLocalSearchParams } from "expo-router";
import { Exercise } from "@/utils/database";
import { useWorkoutStore } from "@/store/store";
import { Colors } from "@/constants/Colors";

export default function ExercisesScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: exercises, isLoading, error } = useExercises();
  const addExercise = useWorkoutStore((state) => state.addExercise);
  const workouts = useWorkoutStore((state) => state.workouts);
  const { index } = useLocalSearchParams();
  const currentWorkoutIndex = Number(index);
  const currentWorkout = workouts[currentWorkoutIndex];

  const [selectedExercises, setSelectedExercises] = useState<string[]>(() => {
    return (
      currentWorkout?.exercises.map((exercise) =>
        exercise.exercise_id.toString(),
      ) || []
    );
  });

  const handleSelectExercise = (exerciseId: string) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );
  };

  const handleAddExercise = () => {
    selectedExercises.forEach((exerciseId) => {
      const exercise = exercises?.find(
        (ex) => ex.exercise_id.toString() === exerciseId,
      );
      if (
        exercise &&
        !currentWorkout?.exercises.some(
          (e) => e.exercise_id === exercise.exercise_id,
        )
      ) {
        addExercise(currentWorkoutIndex, exercise);
      }
    });
    router.back();
  };

  const filteredExercises =
    exercises?.filter((exercise) =>
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <View key={item.exercise_id} style={styles.exerciseItem}>
      <Checkbox
        status={
          selectedExercises.includes(item.exercise_id.toString())
            ? "checked"
            : "unchecked"
        }
        onPress={() => handleSelectExercise(item.exercise_id.toString())}
      />
      <View style={styles.exerciseInfo}>
        <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
        <ThemedText style={styles.exerciseDetails}>
          {item.target_muscle.toUpperCase()}
        </ThemedText>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    console.log(error);
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          Error loading exercises
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholderTextColor={Colors.dark.text}
        placeholder="Search"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        data={filteredExercises}
        keyExtractor={(item: Exercise) => item.exercise_id.toString()}
        renderItem={renderExerciseItem}
        contentContainerStyle={styles.flatListContent}
      />
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleAddExercise}
          style={styles.addButton}
        >
          Add exercises ({selectedExercises.length})
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2E3440",
    padding: 16,
  },
  searchInput: {
    backgroundColor: "#3B4252",
    color: "#FFFFFF",
    padding: 8,
    borderRadius: 4,
    marginVertical: 16,
  },
  flatListContent: {
    flexGrow: 1,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B4252",
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  exerciseInfo: {
    marginLeft: 16,
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    color: "#FFFFFF",
    flexWrap: "wrap",
    flexShrink: 1,
  },
  exerciseDetails: {
    fontSize: 14,
    color: "#D8DEE9",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  addButton: {
    backgroundColor: "#81A1C1",
  },
  loadingText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});