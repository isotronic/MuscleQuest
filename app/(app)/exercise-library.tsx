import { useState, useMemo } from "react";
import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { useExerciseSort } from "@/hooks/useExerciseSort";
import { useExerciseUsageQuery } from "@/hooks/useExerciseUsageQuery";
import { router, useLocalSearchParams } from "expo-router";
import { View, TextInput, StyleSheet } from "react-native";
import { t } from "@lingui/core/macro";
import { ActivityIndicator } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ErrorState } from "@/components/ui/ErrorState";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import ExerciseSuggestions from "@/components/ExerciseSuggestions";
import ExerciseSortChips, {
  type SortMode,
} from "@/components/ExerciseSortChips";
import { useExercisePickerStore } from "@/store/exercisePickerStore";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export default function ExerciseLibraryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null,
  );
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState<
    string | null
  >(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const { mode, trackingType } = useLocalSearchParams<{
    mode?: string;
    trackingType?: string;
  }>();
  const isSelectMode = mode === "select";
  const setPickedExercise = useExercisePickerStore((s) => s.setPickedExercise);

  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
    refetch: refetchExercises,
  } = useExercisesQuery(sortMode === "activePlan", false);

  const { data: usageData } = useExerciseUsageQuery();

  const searchFilters = useMemo(
    () => ({
      equipment: selectedEquipment,
      bodyPart: selectedBodyPart,
      targetMuscle: selectedTargetMuscle,
      trackingType: isSelectMode ? (trackingType ?? null) : null,
    }),
    [
      selectedEquipment,
      selectedBodyPart,
      selectedTargetMuscle,
      isSelectMode,
      trackingType,
    ],
  );

  const { filteredExercises, suggestions, debouncedQuery } = useExerciseSearch(
    exercises,
    searchFilters,
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
        selectedExercises={[]}
        onSelect={() => {}}
        scrollKey={`${debouncedQuery}-${sortMode}`}
        onPressItem={(item) => {
          if (isSelectMode) {
            setPickedExercise(item);
            router.back();
            return;
          }
          router.push({
            pathname: "/(app)/exercise-info",
            params: { exercise_id: item.exercise_id.toString() },
          });
        }}
        showCheckbox={false}
        sectionTitles={sectionTitles}
      />
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
  });
}
