import { useState, useEffect } from "react";
import { useExerciseSearch } from "@/hooks/useExerciseSearch";
import { useExerciseSort } from "@/hooks/useExerciseSort";
import { useExerciseUsageQuery } from "@/hooks/useExerciseUsageQuery";
import { router } from "expo-router";
import { View, TextInput, StyleSheet } from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ActivityIndicator } from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { Colors } from "@/constants/Colors";
import FilterRow from "@/components/FilterRow";
import ExerciseList from "@/components/ExerciseList";
import ExerciseSuggestions from "@/components/ExerciseSuggestions";
import ExerciseSortChips, {
  type SortMode,
} from "@/components/ExerciseSortChips";
import Bugsnag from "@bugsnag/expo";
import { radii } from "@/theme";

export default function ExerciseLibraryScreen() {
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
  } = useExercisesQuery(sortMode === "activePlan", false);

  const { data: usageData } = useExerciseUsageQuery();

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

  useEffect(() => {
    if (exercisesError) {
      console.error("Error loading exercises:", exercisesError);
      Bugsnag.notify(exercisesError);
    }
  }, [exercisesError]);

  if (exercisesLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (exercisesError) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          <Trans>Error loading exercises: {exercisesError?.message}</Trans>
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
    borderRadius: radii.md,
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
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});
