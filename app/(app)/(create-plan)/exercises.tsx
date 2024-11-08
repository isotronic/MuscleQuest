import { useCallback, useEffect, useMemo, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Button, ActivityIndicator, IconButton, FAB } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import FilterModal from "@/components/FilterModal";
import ExerciseList from "@/components/ExerciseList";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
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
  const { workouts, addExercise, newExerciseId, setNewExerciseId } =
    useWorkoutStore();
  const { index } = useLocalSearchParams();
  const currentWorkoutIndex = Number(index);
  const currentWorkout = workouts[currentWorkoutIndex];

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const defaultSetNumber = settings ? parseInt(settings?.defaultSets) : 3;
  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;
  const allExercises = [
    ...(exercises?.activePlanExercises || []),
    ...(exercises?.favoriteExercises || []),
    ...(exercises?.otherExercises || []),
  ];

  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);

  useEffect(() => {
    if (currentWorkout?.exercises) {
      const existingExerciseIds = currentWorkout.exercises.map(
        (exercise) => exercise.exercise_id,
      );
      // If there is a newExerciseId, select it in addition to the existing exercises
      if (newExerciseId) {
        setSelectedExercises((prev) => [...prev, newExerciseId]);
      } else {
        setSelectedExercises((prev) => {
          const newIds = existingExerciseIds.filter((id) => !prev.includes(id)); // Filter out duplicates
          return [...prev, ...newIds]; // Add only new IDs
        });
      }

      // Clear the newExerciseId after it's used
      setNewExerciseId(null);
    }
  }, [currentWorkout, newExerciseId, setNewExerciseId]);

  const handleSelectExercise = useCallback((exerciseId: number) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );
  }, []);

  const handleAddExercise = () => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const defaultSets = Array(defaultSetNumber).fill({
      repsMin: 8,
      repsMax: 12,
      restMinutes: minutes,
      restSeconds: seconds,
    });
    const defaultTimeSets = Array(defaultSetNumber).fill({
      restMinutes: minutes,
      restSeconds: seconds,
      time: 30,
    });

    selectedExercises.forEach((exerciseId) => {
      const exercise = allExercises.find((ex) => ex.exercise_id === exerciseId);
      if (
        exercise &&
        !currentWorkout?.exercises.some(
          (e) => e.exercise_id === exercise.exercise_id,
        )
      ) {
        const exerciseToAdd = {
          ...exercise,
          sets:
            exercise.tracking_type === "time" ? defaultTimeSets : defaultSets,
        };
        addExercise(currentWorkoutIndex, exerciseToAdd);
      }
    });
    router.back();
  };

  const filteredExercises = useMemo(() => {
    const filterByQueryAndSelection = (exercise: any) => {
      const queryWords = searchQuery.toLowerCase().split(" ");
      const matchesSearch = queryWords.every((word) =>
        exercise.name.toLowerCase().includes(word),
      );
      return (
        matchesSearch &&
        (!selectedEquipment || exercise.equipment === selectedEquipment) &&
        (!selectedBodyPart || exercise.body_part === selectedBodyPart) &&
        (!selectedTargetMuscle ||
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

  if (exercisesLoading || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (exercisesError || settingsError) {
    const error = exercisesError || settingsError;
    if (error !== null) {
      console.log(error);
      Bugsnag.notify(error);
    }
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          Error loading exercises: {error?.message}
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
              onPress={handleAddExercise}
              labelStyle={styles.addButtonLabel}
            >
              Add Exercises ({selectedExercises.length})
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
        <IconButton
          icon="filter-variant"
          iconColor={Colors.dark.text}
          size={24}
          onPress={() => setFilterModalVisible(true)}
          style={styles.filterIconButton}
        />
      </View>
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        selectedEquipment={selectedEquipment}
        setSelectedEquipment={setSelectedEquipment}
        selectedBodyPart={selectedBodyPart}
        setSelectedBodyPart={setSelectedBodyPart}
        selectedTargetMuscle={selectedTargetMuscle}
        setSelectedTargetMuscle={setSelectedTargetMuscle}
        exercises={allExercises}
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
      <FAB
        icon="plus"
        label="Create"
        theme={{ colors: { primary: Colors.dark.tint } }}
        style={styles.fab}
        onPress={() => {
          router.push("/(app)/custom-exercise");
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
