import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  Modal,
  View,
  TouchableWithoutFeedback,
} from "react-native";
import { Button, Checkbox } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { useWorkoutStore } from "@/store/workoutStore";
import {
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
} from "@/utils/utility";
import { TimeInput } from "./TimeInput";

interface EditSetModalProps {
  visible: boolean;
  onClose: () => void;
  workoutIndex: number;
  exerciseId: number;
  setIndex: number | null;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultTotalSeconds: number;
  defaultTime: number;
  trackingType: string;
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
  defaultTime,
  trackingType,
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

  const [applyToAllSets, setApplyToAllSets] = useState(false);
  const [isWarmup, setIsWarmup] = useState(set?.isWarmup ?? false);
  const [isDropSet, setIsDropSet] = useState(set?.isDropSet ?? false);

  const [repsMin, setRepsMin] = useState(
    set?.repsMin !== undefined && set?.repsMin !== null
      ? String(set.repsMin)
      : defaultRepsMin !== undefined && defaultRepsMin !== null
        ? String(defaultRepsMin)
        : "",
  );

  const [repsMax, setRepsMax] = useState(
    set?.repsMax !== undefined && set?.repsMax !== null
      ? String(set.repsMax)
      : defaultRepsMax !== undefined && defaultRepsMax !== null
        ? String(defaultRepsMax)
        : "",
  );

  const [restTime, setRestTime] = useState(
    formatFromTotalSeconds(defaultTotalSeconds),
  );

  const [time, setTime] = useState(formatFromTotalSeconds(defaultTime));

  useEffect(() => {
    if (setIndex !== null && set) {
      setRepsMin(
        set.repsMin !== undefined && set.repsMin !== null
          ? String(set.repsMin)
          : "",
      );
      setRepsMax(
        set.repsMax !== undefined && set.repsMax !== null
          ? String(set.repsMax)
          : "",
      );
      setRestTime(
        formatFromTotalSeconds(set.restMinutes * 60 + set.restSeconds),
      );
      setTime(set.time ? formatFromTotalSeconds(set.time) : "00:00");
      setIsWarmup(set?.isWarmup ?? false);
      setIsDropSet(set?.isDropSet ?? false);
    } else {
      if (trackingType === "time") {
        setTime(formatFromTotalSeconds(defaultTime));
      } else {
        setRepsMin(
          defaultRepsMin !== undefined && defaultRepsMin !== null
            ? String(defaultRepsMin)
            : "",
        );
        setRepsMax(
          defaultRepsMax !== undefined && defaultRepsMax !== null
            ? String(defaultRepsMax)
            : "",
        );
      }

      setRestTime(formatFromTotalSeconds(defaultTotalSeconds));
    }
  }, [
    setIndex,
    set,
    defaultRepsMin,
    defaultRepsMax,
    defaultTotalSeconds,
    defaultTime,
    trackingType,
  ]);

  const handleSaveSet = () => {
    const totalSeconds = convertToTotalSeconds(restTime);
    const minReps = repsMin === "" ? undefined : Number(repsMin);
    const maxReps = repsMax === "" ? undefined : Number(repsMax);
    const timeToSave = convertToTotalSeconds(time || "00:00");

    const updatedSet = {
      repsMin: minReps,
      repsMax: maxReps,
      restMinutes: Math.floor(totalSeconds / 60),
      restSeconds: totalSeconds % 60,
      time: timeToSave,
      isWarmup,
      isDropSet,
    };

    if (applyToAllSets) {
      // Update all sets in the current exercise
      exercise?.sets.forEach((_, sIndex) => {
        updateSetInExercise(workoutIndex, exerciseId, sIndex, updatedSet);
      });
    } else if (setIndex !== null) {
      // Update only the selected set
      updateSetInExercise(workoutIndex, exerciseId, setIndex, updatedSet);
    } else {
      // Add a new set
      addSetToExercise(workoutIndex, exerciseId, updatedSet);
    }

    setApplyToAllSets(false);
    onClose();
  };

  const handleRestTimeChange = (value: string) => {
    setRestTime(formatTimeInput(value));
  };

  const handleTimeChange = (value: string) => {
    setTime(formatTimeInput(value));
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
              {trackingType === "time" ? (
                <View>
                  <ThemedText style={styles.label}>
                    Time (Minutes:Seconds)
                  </ThemedText>
                  <View style={styles.inputRow}>
                    <TimeInput
                      style={styles.input}
                      value={time}
                      onChange={handleTimeChange}
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <ThemedText style={styles.label}>Min Reps</ThemedText>
                  <View style={styles.inputRow}>
                    <MaterialCommunityIcons
                      name="minus"
                      size={32}
                      color={Colors.dark.text}
                      onPress={() =>
                        setRepsMin((prev) =>
                          String(Math.max(Number(prev) - 1, 0)),
                        )
                      }
                    />
                    <TextInput
                      style={styles.input}
                      value={repsMin ? repsMin : ""}
                      onChangeText={setRepsMin}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />
                    <MaterialCommunityIcons
                      name="plus"
                      size={32}
                      color={Colors.dark.text}
                      onPress={() =>
                        setRepsMin((prev) => String(Number(prev) + 1))
                      }
                    />
                  </View>

                  <ThemedText style={styles.label}>Max Reps</ThemedText>
                  <View style={styles.inputRow}>
                    <MaterialCommunityIcons
                      name="minus"
                      size={32}
                      color={Colors.dark.text}
                      onPress={() =>
                        setRepsMax((prev) =>
                          String(Math.max(Number(prev) - 1, 0)),
                        )
                      }
                    />
                    <TextInput
                      style={styles.input}
                      value={repsMax ? repsMax : ""}
                      onChangeText={setRepsMax}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />
                    <MaterialCommunityIcons
                      name="plus"
                      size={32}
                      color={Colors.dark.text}
                      onPress={() =>
                        setRepsMax((prev) => String(Number(prev) + 1))
                      }
                    />
                  </View>
                </View>
              )}

              <ThemedText style={styles.label}>
                Rest Time (Minutes:Seconds)
              </ThemedText>
              <View style={styles.inputRow}>
                <TimeInput
                  style={styles.input}
                  value={restTime}
                  onChange={handleRestTimeChange}
                />
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={isWarmup ? "checked" : "unchecked"}
                  uncheckedColor={Colors.dark.subText}
                  onPress={() => setIsWarmup(!isWarmup)}
                />
                <ThemedText style={styles.checkboxLabel}>
                  Warm-up set
                </ThemedText>
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={isDropSet ? "checked" : "unchecked"}
                  uncheckedColor={Colors.dark.subText}
                  onPress={() => setIsDropSet(!isDropSet)}
                />
                <ThemedText style={styles.checkboxLabel}>Drop set</ThemedText>
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={applyToAllSets ? "checked" : "unchecked"}
                  uncheckedColor={Colors.dark.subText}
                  onPress={() => {
                    setApplyToAllSets(!applyToAllSets);
                  }}
                />
                <ThemedText style={styles.checkboxLabel}>
                  Apply to all sets
                </ThemedText>
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
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.dark.text,
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
