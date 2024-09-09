import React, { useState } from "react";
import { View, StyleSheet, TextInput, Button } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useLocalSearchParams, router } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";

export default function EditSetScreen() {
  const { setIndex, exerciseId, workoutIndex } = useLocalSearchParams();
  const updateSetInExercise = useWorkoutStore(
    (state) => state.updateSetInExercise,
  );
  const workouts = useWorkoutStore((state) => state.workouts);

  const exercise = workouts[Number(workoutIndex)]?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );
  const set = exercise?.sets[Number(setIndex)];

  const [repsMin, setRepsMin] = useState(String(set?.repsMin || 8));
  const [repsMax, setRepsMax] = useState(String(set?.repsMax || 12));
  const [restMinutes, setRestMinutes] = useState(String(set?.restMinutes || 1));
  const [restSeconds, setRestSeconds] = useState(
    String(set?.restSeconds || 30),
  );

  const handleSaveSet = () => {
    const updatedSet = {
      repsMin: Number(repsMin),
      repsMax: Number(repsMax),
      restMinutes: Number(restMinutes),
      restSeconds: Number(restSeconds),
    };
    updateSetInExercise(
      Number(workoutIndex),
      Number(exerciseId),
      Number(setIndex),
      updatedSet,
    );
    router.back();
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>Min Reps</ThemedText>
      <TextInput
        style={styles.input}
        value={repsMin}
        onChangeText={setRepsMin}
        keyboardType="numeric"
      />

      <ThemedText style={styles.label}>Max Reps</ThemedText>
      <TextInput
        style={styles.input}
        value={repsMax}
        onChangeText={setRepsMax}
        keyboardType="numeric"
      />

      <ThemedText style={styles.label}>Rest Minutes</ThemedText>
      <TextInput
        style={styles.input}
        value={restMinutes}
        onChangeText={setRestMinutes}
        keyboardType="numeric"
      />

      <ThemedText style={styles.label}>Rest Seconds</ThemedText>
      <TextInput
        style={styles.input}
        value={restSeconds}
        onChangeText={setRestSeconds}
        keyboardType="numeric"
      />

      <Button title="Save Set" onPress={handleSaveSet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.dark.background,
  },
  label: {
    fontSize: 16,
    color: "#ECEFF4",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#3B4252",
    color: "#FFFFFF",
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
    textAlign: "center",
  },
});
