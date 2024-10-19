import React, { useState } from "react";
import { StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Stack, useLocalSearchParams } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { EditSetModal } from "@/components/EditSetModal";

export default function SetsOverviewScreen() {
  const { exerciseId, workoutIndex } = useLocalSearchParams();
  const workouts = useWorkoutStore((state) => state.workouts);

  const { data: settings } = useSettingsQuery();

  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;
  const defaultRepsMin = 8;
  const defaultRepsMax = 12;
  const defaultTotalSeconds = totalSeconds;

  const exercise = workouts[Number(workoutIndex)]?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );

  const sets = exercise?.sets || [];

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);

  const handleAddSet = () => {
    setSelectedSetIndex(null);
    setModalVisible(true);
  };

  const handleEditSet = (index: number) => {
    setSelectedSetIndex(index);
    setModalVisible(true);
  };

  const renderSetItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      onPress={() => handleEditSet(index)}
      style={styles.setItem}
    >
      <ThemedText style={styles.setTitle}>Set {index + 1}</ThemedText>
      <ThemedText style={styles.setInfo}>
        {item.repsMin} - {item.repsMax} reps, Rest: {item.restMinutes}m{" "}
        {item.restSeconds}s
      </ThemedText>
    </TouchableOpacity>
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
  flatListContent: {
    paddingBottom: 16,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
