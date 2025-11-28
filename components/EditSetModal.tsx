import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  Modal,
  View,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Button, Checkbox, Divider } from "react-native-paper";
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

  // Initialize states
  const [applyToAllSets, setApplyToAllSets] = useState(false);
  const [isWarmup, setIsWarmup] = useState(false);
  const [isDropSet, setIsDropSet] = useState(false);
  const [isToFailure, setIsToFailure] = useState(false);
  const [repsMin, setRepsMin] = useState("");
  const [repsMax, setRepsMax] = useState("");
  const [restTime, setRestTime] = useState(
    formatFromTotalSeconds(defaultTotalSeconds),
  );
  const [time, setTime] = useState(formatFromTotalSeconds(defaultTime));

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in content after modal animation
  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        delay: 50,
        useNativeDriver: true,
      }).start();
    }
    // fadeAnim is a stable ref and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Single effect to handle initial state setup
  useEffect(() => {
    if (setIndex !== null && set) {
      setIsWarmup(set.isWarmup ?? false);
      setIsDropSet(set.isDropSet ?? false);
      setIsToFailure(set.isToFailure ?? false);
      setRepsMin(set.repsMin !== undefined ? String(set.repsMin) : "");
      setRepsMax(set.repsMax !== undefined ? String(set.repsMax) : "");
      setRestTime(
        formatFromTotalSeconds(set.restMinutes * 60 + set.restSeconds),
      );
      setTime(set.time ? formatFromTotalSeconds(set.time) : "00:00");
    } else {
      setIsWarmup(false);
      setIsDropSet(false);
      setIsToFailure(false);
      if (trackingType === "time") {
        setTime(formatFromTotalSeconds(defaultTime));
      } else {
        setRepsMin(defaultRepsMin ? String(defaultRepsMin) : "");
        setRepsMax(defaultRepsMax ? String(defaultRepsMax) : "");
      }
      setRestTime(formatFromTotalSeconds(defaultTotalSeconds));
    }
  }, [
    setIndex,
    set,
    trackingType,
    defaultTotalSeconds,
    defaultTime,
    defaultRepsMin,
    defaultRepsMax,
  ]);

  const handleToFailureChange = () => {
    const newValue = !isToFailure;
    setIsToFailure(newValue);
    if (newValue) {
      setRepsMin("");
      setRepsMax("");
    } else {
      setRepsMin(defaultRepsMin ? String(defaultRepsMin) : "");
      setRepsMax(defaultRepsMax ? String(defaultRepsMax) : "");
    }
  };

  const parseReps = (toFailure: boolean, reps: string): number | undefined => {
    if (toFailure) return undefined;
    if (reps === "") return undefined;
    return Number(reps);
  };

  const handleSaveSet = () => {
    const totalSeconds = convertToTotalSeconds(restTime);
    const minReps = parseReps(isToFailure, repsMin);
    const maxReps = parseReps(isToFailure, repsMax);
    const timeToSave = convertToTotalSeconds(time || "00:00");

    const updatedSet = {
      repsMin: minReps,
      repsMax: maxReps,
      restMinutes: Math.floor(totalSeconds / 60),
      restSeconds: totalSeconds % 60,
      time: timeToSave,
      isWarmup,
      isDropSet,
      isToFailure,
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
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
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
                  status={isToFailure ? "checked" : "unchecked"}
                  uncheckedColor={Colors.dark.subText}
                  onPress={handleToFailureChange}
                />
                <ThemedText style={styles.checkboxLabel}>To failure</ThemedText>
              </View>

              <Divider style={{ marginTop: 16 }} />

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
            </Animated.View>
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
