import React from "react";
import {
  View,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useLocalSearchParams, router } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";

export default function SetsOverviewScreen() {
  const { exerciseId, workoutIndex } = useLocalSearchParams();
  const addSetToExercise = useWorkoutStore((state) => state.addSetToExercise);
  const workouts = useWorkoutStore((state) => state.workouts);

  const { data: settings } = useSettingsQuery();

  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;

  const exercise = workouts[Number(workoutIndex)]?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );

  const sets = exercise?.sets || [];

  const handleAddSet = () => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const newSet = {
      repsMin: 8,
      repsMax: 12,
      restMinutes: minutes,
      restSeconds: seconds,
    };
    addSetToExercise(Number(workoutIndex), Number(exerciseId), newSet);
  };

  const renderSetItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      onPress={() =>
        router.push(
          `/edit-set?exerciseId=${exerciseId}&workoutIndex=${workoutIndex}&setIndex=${index}`,
        )
      }
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
    <View style={styles.container}>
      <FlatList
        data={sets}
        renderItem={renderSetItem}
        keyExtractor={(_: any, index: number) => index.toString()}
        contentContainerStyle={styles.flatListContent}
      />
      <Button title="Add Set" onPress={handleAddSet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.dark.background,
  },
  setItem: {
    backgroundColor: "#4C566A",
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  setTitle: {
    fontSize: 18,
    color: "#ECEFF4",
    fontWeight: "bold",
  },
  setInfo: {
    fontSize: 16,
    color: "#ECEFF4",
    marginTop: 5,
  },
  flatListContent: {
    paddingBottom: 16,
  },
});
