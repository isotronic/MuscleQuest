import React, { useCallback } from "react";
import { FlatList, StyleSheet } from "react-native";
import ExerciseItem from "./ExerciseItem";
import { Exercise } from "@/utils/database";

interface ExerciseListProps {
  exercises: Exercise[];
  selectedExercises: number[];
  onSelect: (exerciseId: number) => void;
  onPressItem: (item: Exercise) => void;
}

const ExerciseList = ({
  exercises,
  selectedExercises,
  onSelect,
  onPressItem,
}: ExerciseListProps) => {
  const renderExerciseItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseItem
        item={item}
        selected={selectedExercises.includes(item.exercise_id)}
        onSelect={onSelect}
        onPress={onPressItem}
      />
    ),
    [selectedExercises, onSelect, onPressItem],
  );

  return (
    <FlatList
      data={exercises}
      keyExtractor={(item: Exercise) => item.exercise_id.toString()}
      renderItem={renderExerciseItem}
      contentContainerStyle={styles.flatListContent}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  );
};

const styles = StyleSheet.create({
  flatListContent: {
    flexGrow: 1,
  },
});

export default React.memo(ExerciseList);
