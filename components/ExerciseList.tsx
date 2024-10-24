import React, { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ThemedText } from "./ThemedText";
import ExerciseItem from "./ExerciseItem";
import { Exercise } from "@/utils/database";

interface ExerciseListProps {
  exercises: {
    favoriteExercises: Exercise[];
    activePlanExercises: Exercise[];
    otherExercises: Exercise[];
  };
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
  const listData = [];

  if (exercises.favoriteExercises.length > 0) {
    listData.push({ type: "title", title: "Favorites" });
    listData.push(
      ...exercises.favoriteExercises.map((item) => ({
        type: "exercise",
        item,
      })),
    );
  }

  if (exercises.activePlanExercises.length > 0) {
    listData.push({ type: "title", title: "Active Plan Exercises" });
    listData.push(
      ...exercises.activePlanExercises.map((item) => ({
        type: "exercise",
        item,
      })),
    );
  }

  if (exercises.otherExercises.length > 0) {
    if (
      exercises.favoriteExercises.length === 0 &&
      exercises.activePlanExercises.length === 0
    ) {
      // If there are no favorites or active plan exercises, do not show the title for other exercises
      listData.push(
        ...exercises.otherExercises.map((item) => ({
          type: "exercise",
          item,
        })),
      );
    } else {
      listData.push({ type: "title", title: "Other Exercises" });
      listData.push(
        ...exercises.otherExercises.map((item) => ({
          type: "exercise",
          item,
        })),
      );
    }
  }

  const renderExerciseItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === "title") {
        return (
          <View style={styles.titleContainer}>
            <ThemedText style={styles.title}>{item.title}</ThemedText>
          </View>
        );
      }
      return (
        <ExerciseItem
          item={item.item}
          selected={selectedExercises.includes(item.item.exercise_id)}
          onSelect={onSelect}
          onPress={onPressItem}
        />
      );
    },
    [selectedExercises, onSelect, onPressItem],
  );

  return (
    <FlatList
      data={listData}
      keyExtractor={(item: any, index: number) =>
        item.type === "title"
          ? `title-${index}`
          : item.item.exercise_id.toString()
      }
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
    marginTop: 12,
  },
  titleContainer: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default React.memo(ExerciseList);
