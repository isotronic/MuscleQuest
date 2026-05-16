import { useCallback, useEffect, useMemo, useState } from "react";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { useExercisePreselectFilter } from "@/hooks/useExercisePreselectFilter";
import { Button, ActivityIndicator } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, useLocalSearchParams } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  const {
    initialTargetMuscle,
    isPreselectLoading,
    onFilterReady,
    replaceExerciseIndex,
  } = useExercisePreselectFilter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null,
  );
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState<
    string | null
  >(initialTargetMuscle);

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
    createSuperset,
  } = useWorkoutStore();
  const { index, supersetForIndex } = useLocalSearchParams<{
    index: string;
    supersetForIndex?: string;
  }>();
  const currentWorkoutIndex = Number(index);
  const currentWorkout = workouts[currentWorkoutIndex];
  const replacing = replaceExerciseIndex !== undefined;
  const supersetMode = supersetForIndex !== undefined;
  const supersetForExerciseIndex = supersetMode
    ? Number(supersetForIndex)
    : undefined;

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
    if (currentWorkout?.exercises && !replacing && !supersetMode) {
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
  }, [
    currentWorkout,
    newExerciseId,
    replacing,
    supersetMode,
    setNewExerciseId,
  ]);

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
      const workout = workouts[currentWorkoutIndex];
      const exerciseAlreadyExists = workout?.exercises.some(
        (e) => e.exercise_id === exerciseId,
      );

      if (supersetMode) {
        // Single-select: pair as superset partner
        if (exerciseAlreadyExists) {
          Alert.alert(
            "Exercise Already Added",
            "This exercise is already in your workout. Please choose a different one.",
            [{ text: "OK" }],
          );
          return;
        }
        const exercise = allExercises.find(
          (ex) => ex.exercise_id === exerciseId,
        );
        if (exercise && supersetForExerciseIndex !== undefined) {
          const newExercise = {
            ...exercise,
            sets:
              exercise.tracking_type === "time" ? defaultTimeSets : defaultSets,
          };
          createSuperset(
            currentWorkoutIndex,
            supersetForExerciseIndex,
            newExercise,
          );
          router.back();
        }
      } else if (replacing) {
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
            replaceExerciseIndex,
            replacement,
            defaultSets,
            defaultTimeSets,
          );
          router.back();
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
      supersetMode,
      supersetForExerciseIndex,
      replacing,
      allExercises,
      replaceExerciseIndex,
      defaultTimeSets,
      defaultSets,
      replaceExercise,
      createSuperset,
      currentWorkoutIndex,
      workouts,
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

  const isLoading = exercisesLoading || settingsLoading || isPreselectLoading;

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
      <View
        style={{ opacity: isLoading ? 0 : 1, flex: 1 }}
        pointerEvents={isLoading ? "none" : "auto"}
      >
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
          onReady={onFilterReady}
        />
        <ExerciseList
          exercises={filteredExercises}
          selectedExercises={selectedExercises}
          onSelect={handleSelectExercise}
          onPressItem={(item) => {
            router.push({
              pathname: "/(app)/exercise-info",
              params: { exercise_id: item.exercise_id.toString() },
            });
          }}
        />
        {!replacing && !supersetMode && (
          <View style={styles.bottomButtons}>
            <Button
              mode="outlined"
              compact
              style={styles.bottomButton}
              onPress={() => {
                router.push("/(app)/custom-exercise");
              }}
            >
              Create Exercise
            </Button>
            <Button
              mode="contained"
              compact
              disabled={selectedExercises.length === 0}
              style={styles.bottomButton}
              labelStyle={styles.addButtonLabel}
              onPressIn={handleAddExercise}
            >
              Add ({selectedExercises.length})
            </Button>
          </View>
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
  bottomButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 28,
    gap: 12,
    backgroundColor: Colors.dark.screenBackground,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bottomButton: {
    flex: 1,
  },
});
