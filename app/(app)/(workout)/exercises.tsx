import { useMemo, useState } from "react";
import { useExercisePreselectFilter } from "@/hooks/useExercisePreselectFilter";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { ActivityIndicator, Button } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/Colors";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { UserExercise } from "@/store/workoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  const { workout, replaceExercise, appendExercise } = useActiveWorkoutStore();
  const {
    initialTargetMuscle,
    isPreselectLoading,
    onFilterReady,
    replaceExerciseIndex,
  } = useExercisePreselectFilter();

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isAppendMode = mode === "append";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null,
  );
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState<
    string | null
  >(initialTargetMuscle);
  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);

  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useExercisesQuery(false, true);

  const { data: settings, isLoading: settingsLoading } = useSettingsQuery();

  const defaultSetNumber = settings ? parseInt(settings.defaultSets) : 3;
  const totalSeconds = settings ? parseInt(settings.defaultRestTime) : 0;
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

  const allExercises = [
    ...(exercises?.activePlanExercises || []),
    ...(exercises?.favoriteExercises || []),
    ...(exercises?.otherExercises || []),
  ];

  const handleReplaceExercise = (exerciseId: number) => {
    const exercise = allExercises?.find((ex) => ex.exercise_id === exerciseId);

    if (exercise) {
      const exerciseExists = workout?.exercises.some(
        (ex) => ex.exercise_id === exercise.exercise_id,
      );

      if (exerciseExists) {
        Alert.alert(
          "Exercise Already Added",
          "This exercise is already in your workout. Please choose a different one.",
          [{ text: "OK" }],
        );
        return;
      }

      if (replaceExerciseIndex !== undefined) {
        replaceExercise(replaceExerciseIndex, exercise as UserExercise);
        router.back();
      }
    }
  };

  const handleToggleAppendSelection = (exerciseId: number) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );
  };

  const handleConfirmAppend = () => {
    selectedExercises.forEach((exerciseId) => {
      const exercise = allExercises.find((ex) => ex.exercise_id === exerciseId);
      if (exercise) {
        const exerciseToAdd = {
          ...exercise,
          sets:
            exercise.tracking_type === "time" ? defaultTimeSets : defaultSets,
        } as UserExercise;
        appendExercise(exerciseToAdd);
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

  const isLoading =
    exercisesLoading || isPreselectLoading || (isAppendMode && settingsLoading);

  return (
    <ThemedView style={styles.container}>
      {isAppendMode && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Button
                mode={selectedExercises.length > 0 ? "contained" : "outlined"}
                compact
                disabled={selectedExercises.length === 0}
                onPressIn={handleConfirmAppend}
                labelStyle={styles.addButtonLabel}
              >
                Add Exercises ({selectedExercises.length})
              </Button>
            ),
          }}
        />
      )}
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
          selectedExercises={isAppendMode ? selectedExercises : []}
          onSelect={
            isAppendMode ? handleToggleAppendSelection : handleReplaceExercise
          }
          onPressItem={(item) => {
            router.push({
              pathname: "/(app)/exercise-details",
              params: { exercise_id: item.exercise_id.toString() },
            });
          }}
        />
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
  addButtonLabel: {
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});
