import React, { useState } from "react";
import { View, StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { Button, Modal, Portal } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { Workout } from "@/store/workoutStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Trans } from "@lingui/react/macro";
import { t, msg, plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

const DAY_LABELS = [
  msg`Mon`,
  msg`Tue`,
  msg`Wed`,
  msg`Thu`,
  msg`Fri`,
  msg`Sat`,
  msg`Sun`,
];
const DAY_FULL_NAMES = [
  msg`Monday`,
  msg`Tuesday`,
  msg`Wednesday`,
  msg`Thursday`,
  msg`Friday`,
  msg`Saturday`,
  msg`Sunday`,
];

interface Props {
  workouts: Workout[];
  weeklyGoal: number;
  /** day_of_week (0=Mon…6=Sun) -> workout array index */
  schedule: Record<number, number>;
  onChange: (schedule: Record<number, number>) => void;
}

export default function PlanScheduleEditor({
  workouts,
  weeklyGoal,
  schedule,
  onChange,
}: Props) {
  const { _ } = useLingui();
  const disabled = workouts.length === 0;
  const [pickerDow, setPickerDow] = useState<number | null>(null);

  const handleAutoSuggest = () => {
    if (disabled || weeklyGoal <= 0) return;

    // Spaced-out day patterns for common training frequencies
    const dayPatterns: Record<number, number[]> = {
      1: [0],
      2: [0, 3],
      3: [0, 2, 4],
      4: [0, 1, 3, 4],
      5: [0, 1, 2, 3, 4],
      6: [0, 1, 2, 3, 4, 5],
      7: [0, 1, 2, 3, 4, 5, 6],
    };

    const days = dayPatterns[Math.min(weeklyGoal, 7)] ?? dayPatterns[7];
    const updated: Record<number, number> = {};
    days.forEach((dow, i) => {
      updated[dow] = i % workouts.length;
    });
    onChange(updated);
  };

  const scheduledDays = Object.keys(schedule).length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          <Trans>Weekly Schedule</Trans>
        </ThemedText>
        <ThemedText style={styles.summary}>
          {plural(scheduledDays, { one: "# day/week", other: "# days/week" })}
        </ThemedText>
      </View>

      <View style={styles.grid}>
        {DAY_LABELS.map((label, dow) => {
          const workoutIdx = schedule[dow];
          const hasWorkout = workoutIdx !== undefined;
          const workoutName = hasWorkout
            ? workouts[workoutIdx]?.name || `W${workoutIdx + 1}`
            : t`Rest`;

          return (
            <View key={dow} style={styles.tileWrapper}>
              <ThemedText
                style={[styles.dayLabel, hasWorkout && styles.dayLabelActive]}
              >
                {_(label)}
              </ThemedText>
              <Pressable
                style={[
                  styles.dayTile,
                  hasWorkout && styles.dayTileActive,
                  disabled && styles.dayTileDisabled,
                ]}
                onPress={() => !disabled && setPickerDow(dow)}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.workoutLabel,
                    hasWorkout && styles.workoutLabelActive,
                  ]}
                  numberOfLines={2}
                >
                  {workoutName}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Workout picker modal */}
      <Portal>
        <Modal
          visible={pickerDow !== null}
          onDismiss={() => setPickerDow(null)}
          contentContainerStyle={styles.modalContent}
          theme={{ colors: { backdrop: "rgba(0, 0, 0, 0.65)" } }}
        >
          <View style={styles.modalTitleContainer}>
            <ThemedText style={styles.modalTitle}>
              {pickerDow !== null ? _(DAY_FULL_NAMES[pickerDow]) : ""}
            </ThemedText>
          </View>
          <ScrollView>
            {workouts.map((w, idx) => {
              const isSelected =
                pickerDow !== null && schedule[pickerDow] === idx;
              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.pickerItem,
                    isSelected && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    if (pickerDow !== null) {
                      onChange({ ...schedule, [pickerDow]: idx });
                    }
                    setPickerDow(null);
                  }}
                >
                  <Text style={styles.pickerItemText}>
                    {w.name || t`Workout ${idx + 1}`}
                  </Text>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color={Colors.dark.text}
                    />
                  )}
                </Pressable>
              );
            })}
            <Pressable
              style={[
                styles.pickerItem,
                styles.pickerItemLast,
                pickerDow !== null &&
                  schedule[pickerDow] === undefined &&
                  styles.pickerItemSelected,
              ]}
              onPress={() => {
                if (pickerDow !== null) {
                  const updated = { ...schedule };
                  delete updated[pickerDow];
                  onChange(updated);
                }
                setPickerDow(null);
              }}
            >
              <Text style={styles.pickerItemText}>{t`Rest`}</Text>
              {pickerDow !== null && schedule[pickerDow] === undefined && (
                <MaterialCommunityIcons
                  name="check"
                  size={18}
                  color={Colors.dark.text}
                />
              )}
            </Pressable>
          </ScrollView>
        </Modal>
      </Portal>

      <Button
        mode="outlined"
        onPress={handleAutoSuggest}
        disabled={disabled}
        style={styles.autoButton}
        labelStyle={styles.autoButtonLabel}
        textColor={Colors.dark.tint}
      >
        {plural(weeklyGoal, { one: "Auto-suggest (1 day)", other: "Auto-suggest (# days)" })}
      </Button>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
  },
  summary: {
    fontSize: 13,
    color: Colors.dark.icon,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
  },
  tileWrapper: {
    flex: 1,
    alignItems: "center",
  },
  dayTile: {
    width: "100%",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.dark.icon,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 2,
    minHeight: 45,
  },
  dayTileActive: {
    borderColor: Colors.dark.tint,
    backgroundColor: Colors.dark.tint + "22",
  },
  dayTileDisabled: {
    opacity: 0.4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.icon,
  },
  dayLabelActive: {
    color: Colors.dark.tint,
  },
  workoutLabel: {
    fontSize: 8,
    color: Colors.dark.icon,
    textAlign: "center",
  },
  workoutLabelActive: {
    color: Colors.dark.text,
  },
  modalContent: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 12,
    width: "75%",
    maxHeight: "60%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.dark.cardBackground,
    alignSelf: "center",
  },
  modalTitleContainer: {
    backgroundColor: Colors.dark.screenBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.subText,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.subText,
  },
  pickerItemLast: {
    borderBottomWidth: 0,
  },
  pickerItemSelected: {
    backgroundColor: Colors.dark.cardBackground2,
  },
  pickerItemText: {
    color: Colors.dark.text,
    fontSize: 15,
  },
  autoButton: {
    marginTop: 14,
    borderColor: Colors.dark.tint,
  },
  autoButtonLabel: {
    fontSize: 13,
  },
});
