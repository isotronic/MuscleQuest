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

              <ThemedText style={styles.label}>
                Rest Time (Minutes:Seconds)
              </ThemedText>
              <TextInput
                style={styles.input}
                value={restTime}
                onChangeText={handleRestTimeChange}
                keyboardType="numeric"
              />

              <Button
                style={styles.button}
                labelStyle={styles.buttonLabel}
                onPress={handleSaveSet}
                mode="contained"
              >
                Save Set
              </Button>

              <Button
                style={styles.cancelButton}
                labelStyle={styles.buttonLabel}
                onPress={onClose}
                mode="outlined"
              >
                Cancel
              </Button>
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
  },
  input: {
    padding: 10,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
  },
  cancelButton: {
    marginTop: 10,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
