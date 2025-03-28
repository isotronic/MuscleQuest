import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, TextInput, StyleSheet } from "react-native";
import { Button, ActivityIndicator } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import { openDatabase } from "@/utils/database";
import { useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  const queryclient = useQueryClient();
  const { selectedExercises: selectedExercisesParam } = useLocalSearchParams();
  const initialSelectedExercises = useMemo(() => {
    if (Array.isArray(selectedExercisesParam)) {
      return JSON.parse(selectedExercisesParam[0] || "[]");
    }
    return selectedExercisesParam ? JSON.parse(selectedExercisesParam) : [];
  }, [selectedExercisesParam]);
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
  } = useExercisesQuery(true, false);

  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);

  useEffect(() => {
    if (initialSelectedExercises.length > 0) {
      setSelectedExercises(
        initialSelectedExercises.map((id: number | string) => Number(id)),
      );
    }
  }, [initialSelectedExercises]);

  const handleSelectExercise = useCallback((exerciseId: number) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );
  }, []);

  const handleAddExercise = async () => {
    try {
      const db = await openDatabase("userData.db");
      // Fetch already tracked exercises
      const trackedExercises = (await db.getAllAsync(`
        SELECT exercise_id FROM tracked_exercises
      `)) as { exercise_id: number }[];

      const trackedExerciseIds = trackedExercises.map((exercise) =>
        Number(exercise.exercise_id),
      );

      // Find exercises that are newly selected (need to be added)
      const newExercises = selectedExercises.filter(
        (exerciseId) => !trackedExerciseIds.includes(exerciseId),
      );

      // Find exercises that are unselected (need to be removed)
      const removedExercises = trackedExerciseIds.filter(
        (exerciseId) => !selectedExercises.includes(exerciseId),
      );

      // Insert new exercises into the tracked_exercises table
      for (const exerciseId of newExercises) {
        await db.runAsync(
          `
          INSERT INTO tracked_exercises (exercise_id)
          VALUES (?)
        `,
          [exerciseId],
        );
      }

      // Delete unselected exercises from the tracked_exercises table
      for (const exerciseId of removedExercises) {
        await db.runAsync(
          `
          DELETE FROM tracked_exercises WHERE exercise_id = ?
        `,
          [exerciseId],
        );
      }

      queryclient.invalidateQueries({ queryKey: ["trackedExercises"] });
      router.back();
    } catch (error: any) {
      console.error("Error saving exercises for tracking:", error);
      Bugsnag.notify(error);
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
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              mode={selectedExercises.length > 0 ? "contained" : "outlined"}
              compact
              disabled={selectedExercises.length === 0}
              onPress={handleAddExercise}
              labelStyle={styles.addButtonLabel}
            >
              Track Exercises ({selectedExercises.length})
            </Button>
          ),
        }}
      />
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
        selectedExercises={selectedExercises}
        onSelect={handleSelectExercise}
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
    marginHorizontal: 16,
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
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});
