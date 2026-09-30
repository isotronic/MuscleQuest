import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { t } from "@lingui/core/macro";
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
  showCheckbox?: boolean;
  scrollKey?: string;
  sectionTitles?: {
    activePlan?: string;
    favorites?: string;
    other?: string;
  };
}

type ListRow =
  | { type: "title"; title: string }
  | { type: "exercise"; item: Exercise };

const getItemType = (row: ListRow) => row.type;

const ExerciseList = ({
  exercises,
  selectedExercises,
  onSelect,
  onPressItem,
  showCheckbox = true,
  scrollKey,
  sectionTitles,
}: ExerciseListProps) => {
  const listData = useMemo(() => {
    const exerciseRows = (items: Exercise[]): ListRow[] =>
      items.map((item) => ({ type: "exercise", item }));
    const rows: ListRow[] = [];

    if (exercises.favoriteExercises.length > 0) {
      rows.push({
        type: "title",
        title: sectionTitles?.favorites ?? t`Favorites`,
      });
      rows.push(...exerciseRows(exercises.favoriteExercises));
    }

    if (exercises.activePlanExercises.length > 0) {
      rows.push({
        type: "title",
        title: sectionTitles?.activePlan ?? t`Active Plan Exercises`,
      });
      rows.push(...exerciseRows(exercises.activePlanExercises));
    }

    if (exercises.otherExercises.length > 0) {
      // If there are no favorites or active plan exercises, do not show the title for other exercises
      if (
        exercises.favoriteExercises.length > 0 ||
        exercises.activePlanExercises.length > 0
      ) {
        rows.push({
          type: "title",
          title: sectionTitles?.other ?? t`Other Exercises`,
        });
      }
      rows.push(...exerciseRows(exercises.otherExercises));
    }

    return rows;
  }, [
    exercises.favoriteExercises,
    exercises.activePlanExercises,
    exercises.otherExercises,
    sectionTitles,
  ]);

  const selectedSet = useMemo(
    () => new Set(selectedExercises),
    [selectedExercises],
  );

  // Parents pass inline handlers. Rows get stable wrappers that call the
  // latest one, so React.memo on ExerciseItem is not defeated by every parent
  // render.
  const onSelectRef = useRef(onSelect);
  const onPressItemRef = useRef(onPressItem);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onPressItemRef.current = onPressItem;
  });
  const handleSelect = useCallback(
    (exerciseId: number) => onSelectRef.current(exerciseId),
    [],
  );
  const handlePressItem = useCallback(
    (item: Exercise) => onPressItemRef.current(item),
    [],
  );

  const renderExerciseItem = useCallback(
    ({ item }: { item: ListRow }) => {
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
          selected={selectedSet.has(item.item.exercise_id)}
          onSelect={handleSelect}
          onPress={handlePressItem}
          showCheckbox={showCheckbox}
        />
      );
    },
    [selectedSet, handleSelect, handlePressItem, showCheckbox],
  );

  return (
    <FlashList
      key={scrollKey}
      data={listData}
      keyExtractor={(item, index) =>
        item.type === "title"
          ? `title-${index}`
          : item.item.exercise_id.toString()
      }
      getItemType={getItemType}
      renderItem={renderExerciseItem}
      contentContainerStyle={styles.flatListContent}
    />
  );
};

const styles = StyleSheet.create({
  flatListContent: {
    paddingTop: 8,
    paddingBottom: 50,
    paddingHorizontal: 16,
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
