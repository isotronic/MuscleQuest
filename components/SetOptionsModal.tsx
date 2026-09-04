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
import { AppIcon } from "@/components/ui";
import {
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
} from "@/utils/utility";
import { TimeInput } from "./TimeInput";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * The set attributes this modal edits. Reps/time/distance are mutually
 * relevant depending on tracking type; rest time always applies.
 */
export interface SetOptionsValues {
  repsMin: number | undefined;
  repsMax: number | undefined;
  restMinutes: number;
  restSeconds: number;
  time: number;
  distance: number | undefined;
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
}

/** Seed values, in the units the inputs use. */
export interface SetOptionsInitialValues {
  repsMin: string;
  repsMax: string;
  restTotalSeconds: number;
  timeSeconds: number;
  distance: string;
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
}

interface SetOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  trackingType: string;
  distanceUnit?: string;
  initialValues: SetOptionsInitialValues;
  /** Restored into the rep inputs when "to failure" is switched back off. */
  defaultRepsMin: number;
  defaultRepsMax: number;
  /** Warm-up / drop set / to failure checkboxes. */
  showSetTypeOptions?: boolean;
  showApplyToAll?: boolean;
  saveLabel: string;
  onSave: (values: SetOptionsValues, applyToAllSets: boolean) => void;
}

/**
 * Presentational set editor shared by the plan editor (EditSetModal) and the
 * in-workout three-dot menu (SessionSetOptionsModal). Holds no store
 * knowledge: the caller seeds it and decides what saving means.
 */
export const SetOptionsModal: React.FC<SetOptionsModalProps> = ({
  visible,
  onClose,
  trackingType,
  distanceUnit = "m",
  initialValues,
  defaultRepsMin,
  defaultRepsMax,
  showSetTypeOptions = true,
  showApplyToAll = true,
  saveLabel,
  onSave,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [applyToAllSets, setApplyToAllSets] = useState(false);
  const [isWarmup, setIsWarmup] = useState(initialValues.isWarmup);
  const [isDropSet, setIsDropSet] = useState(initialValues.isDropSet);
  const [isToFailure, setIsToFailure] = useState(initialValues.isToFailure);
  const [repsMin, setRepsMin] = useState(initialValues.repsMin);
  const [repsMax, setRepsMax] = useState(initialValues.repsMax);
  const [restTime, setRestTime] = useState(
    formatFromTotalSeconds(initialValues.restTotalSeconds),
  );
  const [time, setTime] = useState(
    formatFromTotalSeconds(initialValues.timeSeconds),
  );
  const [distance, setDistance] = useState(initialValues.distance);

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

  // Re-seed the inputs whenever the caller hands over a different set.
  useEffect(() => {
    setIsWarmup(initialValues.isWarmup);
    setIsDropSet(initialValues.isDropSet);
    setIsToFailure(initialValues.isToFailure);
    setRepsMin(initialValues.repsMin);
    setRepsMax(initialValues.repsMax);
    setRestTime(formatFromTotalSeconds(initialValues.restTotalSeconds));
    setTime(formatFromTotalSeconds(initialValues.timeSeconds));
    setDistance(initialValues.distance);
  }, [initialValues]);

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

  const handleSave = () => {
    const totalSeconds = convertToTotalSeconds(restTime);

    onSave(
      {
        repsMin: parseReps(isToFailure, repsMin),
        repsMax: parseReps(isToFailure, repsMax),
        restMinutes: Math.floor(totalSeconds / 60),
        restSeconds: totalSeconds % 60,
        time: convertToTotalSeconds(time || "00:00"),
        distance:
          trackingType === "distance" && distance !== ""
            ? parseFloat(distance)
            : undefined,
        isWarmup,
        isDropSet,
        isToFailure,
      },
      applyToAllSets,
    );

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
                    <AppIcon
                      set="mci"
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
                    <AppIcon
                      set="mci"
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
                    <AppIcon
                      set="mci"
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
                    <AppIcon
                      set="mci"
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
                    <AppIcon
                      set="mci"
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
                    <AppIcon
                      set="mci"
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

              {showSetTypeOptions && (
                <>
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
                </>
              )}

              {showApplyToAll && (
                <>
                  <Divider style={styles.divider} />

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
                </>
              )}

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
                  onPress={handleSave}
                  mode="contained"
                >
                  {saveLabel}
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
    divider: {
      marginTop: 16,
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
