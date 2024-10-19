import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  Modal,
  View,
  TouchableWithoutFeedback,
} from "react-native";
import { Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { useWorkoutStore } from "@/store/workoutStore";
import {
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
} from "@/utils/utility";

interface EditSetModalProps {
  visible: boolean;
  onClose: () => void;
  workoutIndex: number;
  exerciseId: number;
  setIndex: number | null;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultTotalSeconds: number;
}

export const EditSetModal: React.FC<EditSetModalProps> = ({
  visible,
  onClose,
  workoutIndex,
  exerciseId,
  setIndex,
  defaultRepsMin,
  defaultRepsMax,
  defaultTotalSeconds,
}) => {
  const updateSetInExercise = useWorkoutStore(
    (state) => state.updateSetInExercise,
  );
  const addSetToExercise = useWorkoutStore((state) => state.addSetToExercise);
  const workouts = useWorkoutStore((state) => state.workouts);

  const exercise = workouts[Number(workoutIndex)]?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );
  const set = setIndex !== null ? exercise?.sets[setIndex] : null;

  const [repsMin, setRepsMin] = useState(
    String(set?.repsMin || defaultRepsMin),
  );
  const [repsMax, setRepsMax] = useState(
    String(set?.repsMax || defaultRepsMax),
  );

  const [restTime, setRestTime] = useState(
    formatFromTotalSeconds(defaultTotalSeconds),
  );

  useEffect(() => {
    if (setIndex !== null && set) {
      setRepsMin(String(set.repsMin));
      setRepsMax(String(set.repsMax));
      setRestTime(
        formatFromTotalSeconds(set.restMinutes * 60 + set.restSeconds),
      );
    } else {
      setRepsMin(String(defaultRepsMin));
      setRepsMax(String(defaultRepsMax));
      setRestTime(formatFromTotalSeconds(defaultTotalSeconds));
    }
  }, [setIndex, set, defaultRepsMin, defaultRepsMax, defaultTotalSeconds]);

  const handleSaveSet = () => {
    const totalSeconds = convertToTotalSeconds(restTime);

    const updatedSet = {
      repsMin: Number(repsMin),
      repsMax: Number(repsMax),
      restMinutes: Math.floor(totalSeconds / 60),
      restSeconds: totalSeconds % 60,
    };

    if (setIndex !== null) {
      updateSetInExercise(workoutIndex, exerciseId, setIndex, updatedSet);
    } else {
      addSetToExercise(workoutIndex, exerciseId, updatedSet);
    }

    onClose();
  };

  const handleRestTimeChange = (value: string) => {
    setRestTime(formatTimeInput(value));
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      onDismiss={onClose}
      animationType="slide"
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <ThemedText style={styles.label}>Min Reps</ThemedText>
              <View style={styles.inputRow}>
                <MaterialCommunityIcons
                  name="minus"
                  size={32}
                  color={Colors.dark.text}
                  onPress={() =>
                    setRepsMin((prev) => String(Math.max(Number(prev) - 1, 0)))
                  }
                />
                <TextInput
                  style={styles.input}
                  value={repsMin}
                  onChangeText={setRepsMin}
                  keyboardType="numeric"
                  selectTextOnFocus={true}
                />
                <MaterialCommunityIcons
                  name="plus"
                  size={32}
                  color={Colors.dark.text}
                  onPress={() => setRepsMin((prev) => String(Number(prev) + 1))}
                />
              </View>

              <ThemedText style={styles.label}>Max Reps</ThemedText>
              <View style={styles.inputRow}>
                <MaterialCommunityIcons
                  name="minus"
                  size={32}
                  color={Colors.dark.text}
                  onPress={() =>
                    setRepsMax((prev) => String(Math.max(Number(prev) - 1, 0)))
                  }
                />
                <TextInput
                  style={styles.input}
                  value={repsMax}
                  onChangeText={setRepsMax}
                  keyboardType="numeric"
                  selectTextOnFocus={true}
                />
                <MaterialCommunityIcons
                  name="plus"
                  size={32}
                  color={Colors.dark.text}
                  onPress={() => setRepsMax((prev) => String(Number(prev) + 1))}
                />
              </View>

              <ThemedText style={styles.label}>
                Rest Time (Minutes:Seconds)
              </ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={restTime}
                  onChangeText={handleRestTimeChange}
                  keyboardType="numeric"
                  selectTextOnFocus={true}
                />
              </View>

              <View style={styles.inputRow}>
                <Button
                  style={styles.button}
                  labelStyle={styles.buttonLabel}
                  onPress={onClose}
                  mode="outlined"
                >
                  Cancel
                </Button>
                <Button
                  style={styles.button}
                  labelStyle={styles.buttonLabel}
                  onPress={handleSaveSet}
                  mode="contained"
                >
                  Save Set
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 8,
    width: "90%",
  },
  label: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 4,
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    marginHorizontal: 8,
    textAlign: "center",
  },
  button: {
    marginTop: 16,
    flex: 1,
    marginHorizontal: 8,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
