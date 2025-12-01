import { useCallback, useEffect, useMemo, useState } from "react";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { Button, ActivityIndicator, FAB } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  // Read bodyPart param from router
  const params = useLocalSearchParams();
  const initialBodyPart =
    typeof params.bodyPart === "string" &&
    typeof params.replaceExerciseIndex !== "undefined"
      ? params.bodyPart
      : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null,
  );
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(
    initialBodyPart,
  );
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState<
    string | null
  >(null);
  const [filterReady, setFilterReady] = useState(false);

  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useExercisesQuery(false, true);
  const {
    workouts,
    addExercise,
    newExerciseId,
    setNewExerciseId,
    replaceExercise,
  } = useWorkoutStore();
  const { index, replaceExerciseIndex } = useLocalSearchParams();
  const currentWorkoutIndex = Number(index);
  const currentWorkout = workouts[currentWorkoutIndex];
  const replacing = typeof replaceExerciseIndex !== "undefined";

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const defaultSetNumber = settings ? parseInt(settings?.defaultSets) : 3;
  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;
  const allExercises = useMemo(
    () => [
      ...(exercises?.activePlanExercises || []),
      ...(exercises?.favoriteExercises || []),
      ...(exercises?.otherExercises || []),
    ],
    [exercises],
  );

  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);

  useEffect(() => {
    if (currentWorkout?.exercises && !replacing) {
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
  }, [currentWorkout, newExerciseId, replacing, setNewExerciseId]);

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

  const handleSelectExercise = useCallback(
    (exerciseId: number) => {
      if (replacing) {
        // Check if this exercise already exists in the current workout
        const workout = workouts[currentWorkoutIndex];
        const exerciseAlreadyExists = workout.exercises.some(
          (e) => e.exercise_id === exerciseId,
        );

        if (exerciseAlreadyExists) {
          Alert.alert(
            "Exercise Already Added",
            "This exercise is already in your workout. Please choose a different one.",
            [{ text: "OK" }],
          );
          return;
        }
        // Immediately replace the existing exercise with the selected one
        const exercise = allExercises.find(
          (ex) => ex.exercise_id === exerciseId,
        );
        if (exercise && replaceExerciseIndex !== undefined) {
          const replacement = {
            ...exercise,
            sets:
              exercise.tracking_type === "time" ? defaultTimeSets : defaultSets,
          };
          replaceExercise(
            currentWorkoutIndex,
            Number(replaceExerciseIndex),
            replacement,
            defaultSets,
            defaultTimeSets,
          );
          router.back(); // Return immediately after replacement
        }
      } else {
        // Normal add mode - allow multiple selections
        setSelectedExercises((prev) =>
          prev.includes(exerciseId)
            ? prev.filter((id) => id !== exerciseId)
            : [...prev, exerciseId],
        );
      }
    },
    [
      replacing,
      allExercises,
      replaceExerciseIndex,
      defaultTimeSets,
      defaultSets,
      replaceExercise,
      currentWorkoutIndex,
      workouts, // Make sure 'workouts' is included in dependencies
    ],
  );

  const handleAddExercise = () => {
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

  const isLoading =
    exercisesLoading || settingsLoading || (!!initialBodyPart && !filterReady);

  return (
    <ThemedView style={styles.container}>
      {isLoading && (
        <ActivityIndicator
          size="large"
          color={Colors.dark.text}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginLeft: -20,
            marginTop: -20,
            zIndex: 1000,
          }}
        />
      )}
      <View style={{ opacity: isLoading ? 0 : 1, flex: 1 }}>
        {!replacing && (
          <Stack.Screen
            options={{
              headerRight: () => (
                <Button
                  mode={selectedExercises.length > 0 ? "contained" : "outlined"}
                  compact
                  disabled={selectedExercises.length === 0}
                  onPressIn={handleAddExercise}
                  labelStyle={styles.addButtonLabel}
                >
                  Add Exercises ({selectedExercises.length})
                </Button>
              ),
            }}
          />
        )}
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
          onReady={initialBodyPart ? () => setFilterReady(true) : undefined}
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
        {!replacing && (
          <FAB
            icon="plus"
            label="Create"
            theme={{ colors: { primary: Colors.dark.tint } }}
            style={styles.fab}
            onPress={() => {
              router.push("/(app)/custom-exercise");
            }}
          />
        )}
      </View>
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
