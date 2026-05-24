import { useState } from "react";
import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { useExercisePreselectFilter } from "@/hooks/useExercisePreselectFilter";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ActivityIndicator, Button } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/Colors";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import ExerciseSuggestions from "@/components/ExerciseSuggestions";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { UserExercise } from "@/store/workoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import Bugsnag from "@bugsnag/expo";

export default function ExercisesScreen() {
  const { workout, replaceExercise, appendExercise, createSuperset } =
    useActiveWorkoutStore();
  const {
    initialTargetMuscle,
    isPreselectLoading,
    onFilterReady,
    replaceExerciseIndex,
  } = useExercisePreselectFilter();

  const { mode, supersetForIndex } = useLocalSearchParams<{
    mode?: string;
    supersetForIndex?: string;
  }>();
  const isAppendMode = mode === "append";
  const parsed = Number(supersetForIndex);
  const isSupersetMode =
    supersetForIndex !== undefined && Number.isInteger(parsed) && parsed >= 0;
  const supersetForExerciseIndex = isSupersetMode ? parsed : undefined;

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
  const defaultSets = Array.from({ length: defaultSetNumber }, () => ({
    repsMin: 8,
    repsMax: 12,
    restMinutes: minutes,
    restSeconds: seconds,
  }));
  const defaultTimeSets = Array.from({ length: defaultSetNumber }, () => ({
    restMinutes: minutes,
    restSeconds: seconds,
    time: 30,
  }));
  const defaultDistanceSets = Array.from({ length: defaultSetNumber }, () => ({
    restMinutes: minutes,
    restSeconds: seconds,
    distance: 0,
  }));

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
          t`Exercise Already Added`,
          t`This exercise is already in your workout. Please choose a different one.`,
          [{ text: t`OK` }],
        );
        return;
      }

      if (replaceExerciseIndex !== undefined) {
        replaceExercise(replaceExerciseIndex, exercise as UserExercise);
        router.back();
      }
    }
  };

  const handleSupersetSelect = (exerciseId: number) => {
    const exercise = allExercises.find((ex) => ex.exercise_id === exerciseId);
    const exerciseExists = workout?.exercises.some(
      (ex) => ex.exercise_id === exerciseId,
    );
    if (exerciseExists) {
      Alert.alert(
        t`Exercise Already Added`,
        t`This exercise is already in your workout. Please choose a different one.`,
        [{ text: t`OK` }],
      );
      return;
    }
    if (exercise && supersetForExerciseIndex !== undefined) {
      const exerciseToAdd = {
        ...exercise,
        sets:
          exercise.tracking_type === "time"
            ? defaultTimeSets
            : exercise.tracking_type === "distance"
              ? defaultDistanceSets
              : defaultSets,
      } as UserExercise;
      createSuperset(supersetForExerciseIndex, exerciseToAdd);
      router.back();
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
            exercise.tracking_type === "time"
              ? defaultTimeSets
              : exercise.tracking_type === "distance"
                ? defaultDistanceSets
                : defaultSets,
        } as UserExercise;
        appendExercise(exerciseToAdd);
      }
    });
    router.back();
  };

  const { filteredExercises, suggestions } = useExerciseSearch(
    exercises,
    {
      equipment: selectedEquipment,
      bodyPart: selectedBodyPart,
      targetMuscle: selectedTargetMuscle,
    },
    searchQuery,
  );

  if (exercisesError) {
    console.error("Error loading exercises:", exercisesError);
    Bugsnag.notify(exercisesError);
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          <Trans>Error loading exercises: {exercisesError?.message}</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  const isLoading =
    exercisesLoading ||
    isPreselectLoading ||
    ((isAppendMode || isSupersetMode) && settingsLoading);

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
            placeholder={t`Search`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            selectTextOnFocus={true}
          />
        </View>
        <ExerciseSuggestions
          suggestions={suggestions}
          query={searchQuery}
          onSelect={(s) => setSearchQuery(s.text)}
        />
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
            isSupersetMode
              ? handleSupersetSelect
              : isAppendMode
                ? handleToggleAppendSelection
                : handleReplaceExercise
          }
          onPressItem={(item) => {
            router.push({
              pathname: "/(app)/exercise-info",
              params: { exercise_id: item.exercise_id.toString() },
            });
          }}
        />
        {isAppendMode && (
          <View style={styles.bottomButtons}>
            <Button
              mode="contained"
              compact
              disabled={selectedExercises.length === 0}
              style={styles.bottomButton}
              labelStyle={styles.addButtonLabel}
              onPress={handleConfirmAppend}
            >
              <Trans>Add ({selectedExercises.length})</Trans>
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
  addButtonLabel: {
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
  bottomButtons: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 28,
    backgroundColor: Colors.dark.screenBackground,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bottomButton: {
    borderRadius: 8,
  },
});
