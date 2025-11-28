import React, { useState, useCallback } from "react";
import { StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Stack, useLocalSearchParams } from "expo-router";
import { useWorkoutStore, Set } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { EditSetModal } from "@/components/EditSetModal";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { formatFromTotalSeconds } from "@/utils/utility";

export default function SetsOverviewScreen() {
  const { exerciseId, workoutIndex, trackingType } = useLocalSearchParams();
  const workouts = useWorkoutStore((state) => state.workouts);

  const { data: settings } = useSettingsQuery();

  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;
  const defaultRepsMin = 8;
  const defaultRepsMax = 12;
  const defaultTime = 60;
  const defaultTotalSeconds = totalSeconds;

  const exercise = workouts[Number(workoutIndex)]?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );

  const sets = exercise?.sets || [];

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);

  const handleAddSet = useCallback(() => {
    setSelectedSetIndex(null);
    setModalVisible(true);
  }, []);

  const handleEditSet = useCallback((index: number) => {
    setSelectedSetIndex(index);
    setModalVisible(true);
  }, []);

  const handleDeleteSet = useCallback(
    (index: number) => {
      useWorkoutStore
        .getState()
        .removeSetFromExercise(Number(workoutIndex), Number(exerciseId), index);
    },
    [workoutIndex, exerciseId],
  );

  const renderRightActions = useCallback(
    (index: number) => {
      return (
        <TouchableOpacity
          onPress={() => handleDeleteSet(index)}
          style={styles.deleteAction}
        >
          <MaterialCommunityIcons
            name="delete"
            size={24}
            color={Colors.dark.text}
          />
        </TouchableOpacity>
      );
    },
    [handleDeleteSet],
  );

  const renderSetItem = useCallback(
    ({ item, index }: { item: Set; index: number }) => {
      const repRange =
        item.repsMin === item.repsMax
          ? item.repsMin
          : !item.repsMin
            ? item.repsMax
            : item.repsMax
              ? `${item.repsMin} - ${item.repsMax}`
              : item.repsMin;

      const formattedTime = item.time
        ? formatFromTotalSeconds(item.time)
        : formatFromTotalSeconds(defaultTime);

      return (
        <Swipeable
          renderRightActions={() => renderRightActions(index)}
          overshootRight={false}
          overshootLeft={false}
        >
          <ThemedView style={styles.setItem}>
            <TouchableOpacity
              onPress={() => handleEditSet(index)}
              style={styles.setContent}
            >
              <ThemedView style={styles.setTextContainer}>
                <ThemedText style={styles.setTitle}>Set {index + 1}</ThemedText>
                <ThemedText style={styles.setInfo}>
                  {item.isWarmup ? "Warm-up, " : ""}
                  {item.isDropSet ? "Drop set, " : ""}
                  {item.isToFailure ? "To failure, " : ""}
                  {trackingType === "time"
                    ? `${formattedTime}, `
                    : repRange !== undefined
                      ? `${repRange} Reps, `
                      : ""}
                  {item.restMinutes}:{String(item.restSeconds).padStart(2, "0")}{" "}
                  Rest
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={Colors.dark.text}
              onPress={() => handleDeleteSet(index)}
              style={styles.deleteIcon}
            />
          </ThemedView>
        </Swipeable>
      );
    },
    [
      defaultTime,
      trackingType,
      renderRightActions,
      handleEditSet,
      handleDeleteSet,
    ],
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: exercise?.name,
        }}
      />
      <FlatList
        data={sets}
        renderItem={renderSetItem}
        keyExtractor={(_: any, index: number) => index.toString()}
        contentContainerStyle={styles.flatListContent}
      />
      <Button
        mode="contained"
        labelStyle={styles.buttonLabel}
        onPress={handleAddSet}
      >
        Add Set
      </Button>
      <EditSetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        workoutIndex={Number(workoutIndex)}
        exerciseId={Number(exerciseId)}
        setIndex={selectedSetIndex}
        defaultRepsMin={defaultRepsMin}
        defaultRepsMax={defaultRepsMax}
        defaultTotalSeconds={defaultTotalSeconds}
        defaultTime={defaultTime}
        trackingType={trackingType?.toString() || "weight"}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  setItem: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  setContent: {
    flex: 1,
  },
  setTextContainer: {
    flex: 1,
    backgroundColor: Colors.dark.cardBackground,
  },
  setTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontWeight: "bold",
  },
  setInfo: {
    fontSize: 16,
    color: Colors.dark.text,
    marginTop: 5,
  },
  deleteIcon: {
    paddingLeft: 16,
  },
  deleteAction: {
    backgroundColor: Colors.dark.highlight || "#d32f2f",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 8,
    marginBottom: 10,
  },
  flatListContent: {
    paddingBottom: 50,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
