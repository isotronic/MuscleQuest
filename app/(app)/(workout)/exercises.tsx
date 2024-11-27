import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router } from "expo-router";
import { Colors } from "@/constants/Colors";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { UserExercise } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  const { replaceExerciseIndex } = useLocalSearchParams();
  const { workout, replaceExercise } = useActiveWorkoutStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null,
  );
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState<
    string | null
  >(null);

  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useExercisesQuery(false, true);

  const allExercises = [
    ...(exercises?.activePlanExercises || []),
    ...(exercises?.favoriteExercises || []),
    ...(exercises?.otherExercises || []),
  ];

  const handleReplaceExercise = (exerciseId: number) => {
    const exercise = allExercises?.find((ex) => ex.exercise_id === exerciseId);

    if (exercise) {
      // Check if the selected exercise already exists in the workout
      const exerciseExists = workout?.exercises.some(
        (ex) => ex.exercise_id === exercise.exercise_id,
      );

      if (exerciseExists) {
        // If exercise already exists, show an alert to the user
        Alert.alert(
          "Exercise Already Added",
          "This exercise is already in your workout. Please choose a different one.",
          [{ text: "OK" }],
        );
        return; // Exit early if exercise exists
      }

      // If the exercise doesn't already exist, proceed with the replacement
      if (replaceExerciseIndex !== undefined) {
        replaceExercise(Number(replaceExerciseIndex), exercise as UserExercise);
        router.back(); // Navigate back after replacement
      }
    }
  };

  const filteredExercises = useMemo(() => {
    const filterByQueryAndSelection = (exercise: any) => {
      const queryWords = searchQuery.toLowerCase().split(" ");
      const matchesSearch = queryWords.every((word) =>
        exercise.name.toLowerCase().includes(word),
      );
      return (
        matchesSearch &&
        (!selectedEquipment ||
          selectedEquipment === "all" ||
          exercise.equipment === selectedEquipment) &&
        (!selectedBodyPart ||
          selectedBodyPart === "all" ||
          exercise.body_part === selectedBodyPart) &&
        (!selectedTargetMuscle ||
          selectedTargetMuscle === "all" ||
          exercise.target_muscle === selectedTargetMuscle)
      );
    };

    return {
      activePlanExercises:
        exercises?.activePlanExercises?.filter(filterByQueryAndSelection) || [],
      favoriteExercises:
        exercises?.favoriteExercises?.filter(filterByQueryAndSelection) || [],
      otherExercises:
        exercises?.otherExercises.filter(filterByQueryAndSelection) || [],
    };
  }, [
    exercises,
    searchQuery,
    selectedEquipment,
    selectedBodyPart,
    selectedTargetMuscle,
  ]);

  if (exercisesLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (exercisesError) {
    console.error("Error loading exercises:", exercisesError);
    Bugsnag.notify(exercisesError);
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          Error loading exercises: {exercisesError?.message}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholderTextColor={Colors.dark.text}
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          selectTextOnFocus={true}
        />
      </View>
      <FilterRow
        selectedEquipment={selectedEquipment}
        setSelectedEquipment={setSelectedEquipment}
        selectedBodyPart={selectedBodyPart}
        setSelectedBodyPart={setSelectedBodyPart}
        selectedTargetMuscle={selectedTargetMuscle}
        setSelectedTargetMuscle={setSelectedTargetMuscle}
      />
      <ExerciseList
        exercises={filteredExercises}
        selectedExercises={[]}
        onSelect={handleReplaceExercise}
        onPressItem={(item) => {
          router.push({
            pathname: "/(app)/exercise-details",
            params: { exercise_id: item.exercise_id.toString() },
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.screenBackground,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: Colors.dark.screenBackground,
    paddingRight: 8,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    color: Colors.dark.text,
  },
  filterIconButton: {
    margin: 0,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});
