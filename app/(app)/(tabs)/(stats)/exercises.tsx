import { useCallback, useEffect, useMemo, useState } from "react";
import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { useExerciseSort } from "@/hooks/useExerciseSort";
import { useExerciseUsageQuery } from "@/hooks/useExerciseUsageQuery";
import { useLocalSearchParams, router } from "expo-router";
import { View, TextInput, StyleSheet } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Button, ActivityIndicator } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ErrorState } from "@/components/ui/ErrorState";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import ExerciseSuggestions from "@/components/ExerciseSuggestions";
import ExerciseSortChips, {
  type SortMode,
} from "@/components/ExerciseSortChips";
import { setPinnedExercises } from "@/utils/database";
import { useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export default function ExercisesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
    refetch: refetchExercises,
  } = useExercisesQuery(true, false);

  const { data: usageData } = useExerciseUsageQuery();

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
      await setPinnedExercises(selectedExercises);
      queryclient.invalidateQueries({ queryKey: ["trackedExercises"] });
      // The recent PRs widget can be limited to pinned exercises.
      queryclient.invalidateQueries({
        queryKey: ["completedWorkouts", "recentPRs"],
      });
      router.back();
    } catch (error: any) {
      console.error("Error saving pinned exercises:", error);
      Bugsnag.notify(error);
    }
  };

  const { filteredExercises, suggestions, debouncedQuery } = useExerciseSearch(
    exercises,
    {
      equipment: selectedEquipment,
      bodyPart: selectedBodyPart,
      targetMuscle: selectedTargetMuscle,
    },
    searchQuery,
  );

  const { sortedExercises, sectionTitles } = useExerciseSort(
    sortMode,
    filteredExercises,
    usageData,
  );

  if (exercisesLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  if (exercisesError) {
    return <ErrorState onRetry={() => void refetchExercises()} />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          accessibilityLabel={t`Search exercises`}
          style={styles.searchInput}
          placeholderTextColor={colors.contentPrimary}
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
      />
      <ExerciseSortChips sortMode={sortMode} onSortModeChange={setSortMode} />
      <ExerciseList
        exercises={sortedExercises}
        selectedExercises={selectedExercises}
        onSelect={handleSelectExercise}
        scrollKey={`${debouncedQuery}-${sortMode}`}
        onPressItem={(item) => {
          router.push({
            pathname: "/(app)/exercise-info",
            params: { exercise_id: item.exercise_id.toString() },
          });
        }}
        sectionTitles={sectionTitles}
      />
      <View style={styles.bottomButtons}>
        <Button
          mode="contained"
          compact
          disabled={selectedExercises.length === 0}
          style={styles.bottomButton}
          labelStyle={styles.addButtonLabel}
          onPressIn={handleAddExercise}
        >
          <Trans>Pin ({selectedExercises.length})</Trans>
        </Button>
      </View>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      paddingTop: 16,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderColor: colors.contentPrimary,
      borderWidth: 1,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      paddingRight: 8,
      marginBottom: 4,
      marginHorizontal: 16,
    },
    searchInput: {
      flex: 1,
      padding: 10,
      color: colors.contentPrimary,
    },
    filterIconButton: {
      margin: 0,
    },
    addButtonLabel: {
      fontWeight: "bold",
    },
    bottomButtons: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    bottomButton: {
      borderRadius: radii.md,
    },
  });
}
