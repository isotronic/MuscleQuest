import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  Modal,
  View,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Button, Checkbox, Divider } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWorkoutStore } from "@/store/workoutStore";
import {
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
} from "@/utils/utility";
import { TimeInput } from "./TimeInput";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

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
  defaultDistance: number;
  trackingType: string;
  distanceUnit?: string;
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
  defaultDistance,
  trackingType,
  distanceUnit = "m",
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [distance, setDistance] = useState(
    defaultDistance != null ? String(defaultDistance) : "",
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in content after modal animation
  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      const animation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        delay: 50,
        useNativeDriver: true,
      });
      animation.start();

      return () => {
        animation.stop();
      };
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

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
      setDistance(set.distance !== undefined ? String(set.distance) : "");
    } else {
      const prevSets = exercise?.sets;
      const previousSet =
        prevSets && prevSets.length > 0 ? prevSets[prevSets.length - 1] : null;

      setIsWarmup(previousSet?.isWarmup ?? false);
      setIsDropSet(previousSet?.isDropSet ?? false);
      setIsToFailure(previousSet?.isToFailure ?? false);

      if (trackingType === "time") {
        const prevTime = previousSet?.time ?? defaultTime;
        setTime(formatFromTotalSeconds(prevTime));
      } else if (trackingType === "distance") {
        setDistance(
          previousSet?.distance !== undefined
            ? String(previousSet.distance)
            : defaultDistance
              ? String(defaultDistance)
              : "",
        );
      } else {
        setRepsMin(
          previousSet?.repsMin !== undefined
            ? String(previousSet.repsMin)
            : defaultRepsMin
              ? String(defaultRepsMin)
              : "",
        );
        setRepsMax(
          previousSet?.repsMax !== undefined
            ? String(previousSet.repsMax)
            : defaultRepsMax
              ? String(defaultRepsMax)
              : "",
        );
      }

      const prevRestSeconds = previousSet
        ? previousSet.restMinutes * 60 + previousSet.restSeconds
        : defaultTotalSeconds;
      setRestTime(formatFromTotalSeconds(prevRestSeconds));
    }
  }, [
    setIndex,
    set,
    exercise,
    trackingType,
    defaultTotalSeconds,
    defaultTime,
    defaultRepsMin,
    defaultRepsMax,
    defaultDistance,
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

    const distanceToSave =
      trackingType === "distance" && distance !== ""
        ? parseFloat(distance)
        : undefined;

    const updatedSet = {
      repsMin: minReps,
      repsMax: maxReps,
      restMinutes: Math.floor(totalSeconds / 60),
      restSeconds: totalSeconds % 60,
      time: timeToSave,
      distance: distanceToSave,
      isWarmup,
      isDropSet,
      isToFailure,
    };

    if (applyToAllSets) {
      exercise?.sets.forEach((s, sIndex) => {
        if (
          (s.isWarmup ?? false) === isWarmup ||
          (setIndex !== null && sIndex === setIndex)
        ) {
          updateSetInExercise(workoutIndex, exerciseId, sIndex, updatedSet);
        }
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
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
              {trackingType === "time" ? (
                <View>
                  <ThemedText style={styles.label}>
                    <Trans>Time (Minutes:Seconds)</Trans>
                  </ThemedText>
                  <View style={styles.inputRow}>
                    <TimeInput
                      style={styles.input}
                      value={time}
                      onChange={handleTimeChange}
                    />
                  </View>
                </View>
              ) : trackingType === "distance" ? (
                <View>
                  <ThemedText style={styles.label}>
                    <Trans>Target Distance ({distanceUnit})</Trans>
                  </ThemedText>
                  <View style={styles.inputRow}>
                    <MaterialCommunityIcons
                      name="minus"
                      size={32}
                      color={colors.contentPrimary}
                      onPress={() =>
                        setDistance((prev) =>
                          String(Math.max(parseFloat(prev || "0") - 1, 0)),
                        )
                      }
                    />
                    <TextInput
                      style={styles.input}
                      value={distance}
                      onChangeText={(v: string) => {
                        const cleaned = v.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        setDistance(
                          parts.length > 1
                            ? parts[0] + "." + parts.slice(1).join("")
                            : cleaned,
                        );
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                    />
                    <MaterialCommunityIcons
                      name="plus"
                      size={32}
                      color={colors.contentPrimary}
                      onPress={() =>
                        setDistance((prev) =>
                          String(parseFloat(prev || "0") + 1),
                        )
                      }
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <ThemedText style={styles.label}>
                    <Trans>Min Reps</Trans>
                  </ThemedText>
                  <View style={styles.inputRow}>
                    <MaterialCommunityIcons
                      name="minus"
                      size={32}
                      color={colors.contentPrimary}
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
                      color={colors.contentPrimary}
                      onPress={() =>
                        setRepsMin((prev) => String(Number(prev) + 1))
                      }
                    />
                  </View>

                  <ThemedText style={styles.label}>
                    <Trans>Max Reps</Trans>
                  </ThemedText>
                  <View style={styles.inputRow}>
                    <MaterialCommunityIcons
                      name="minus"
                      size={32}
                      color={colors.contentPrimary}
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
                      color={colors.contentPrimary}
                      onPress={() =>
                        setRepsMax((prev) => String(Number(prev) + 1))
                      }
                    />
                  </View>
                </View>
              )}

              <ThemedText style={styles.label}>
                <Trans>Rest Time (Minutes:Seconds)</Trans>
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
                  uncheckedColor={colors.contentSecondary}
                  onPress={() => setIsWarmup(!isWarmup)}
                />
                <ThemedText style={styles.checkboxLabel}>
                  <Trans>Warm-up set</Trans>
                </ThemedText>
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={isDropSet ? "checked" : "unchecked"}
                  uncheckedColor={colors.contentSecondary}
                  onPress={() => setIsDropSet(!isDropSet)}
                />
                <ThemedText style={styles.checkboxLabel}>
                  <Trans>Drop set</Trans>
                </ThemedText>
              </View>

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={isToFailure ? "checked" : "unchecked"}
                  uncheckedColor={colors.contentSecondary}
                  onPress={handleToFailureChange}
                />
                <ThemedText style={styles.checkboxLabel}>
                  <Trans>To failure</Trans>
                </ThemedText>
              </View>

              <Divider style={{ marginTop: 16 }} />

              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={applyToAllSets ? "checked" : "unchecked"}
                  uncheckedColor={colors.contentSecondary}
                  onPress={() => {
                    setApplyToAllSets(!applyToAllSets);
                  }}
                />
                <ThemedText style={styles.checkboxLabel}>
                  <Trans>
                    Apply to all {isWarmup ? t`warmup` : t`working`} sets
                  </Trans>
                </ThemedText>
              </View>

              <View style={styles.inputRow}>
                <Button
                  style={styles.button}
                  labelStyle={styles.buttonLabel}
                  onPress={onClose}
                  mode="outlined"
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  style={styles.button}
                  labelStyle={styles.buttonLabel}
                  onPress={handleSaveSet}
                  mode="contained"
                >
                  <Trans>Save Set</Trans>
                </Button>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.modalBackdrop,
    },
    modalContent: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: radii.md,
      width: "90%",
    },
    label: {
      fontSize: 16,
      color: colors.contentPrimary,
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
      borderColor: colors.contentPrimary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      textAlign: "center",
    },
    checkboxContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    checkboxLabel: {
      fontSize: 16,
      color: colors.contentPrimary,
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
}
