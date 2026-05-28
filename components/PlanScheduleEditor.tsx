import React, { useMemo, useState } from "react";
import { View, StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { Button, Modal, Portal } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Workout } from "@/store/workoutStore";
import { AppIcon } from "@/components/ui";
import { Trans, Plural } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <Plural value={scheduledDays} one="# day/week" other="# days/week" />
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
          theme={{ colors: { backdrop: colors.modalBackdrop } }}
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
                    <AppIcon
                      set="mci"
                      name="check"
                      size={18}
                      color={colors.contentPrimary}
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
                <AppIcon
                  set="mci"
                  name="check"
                  size={18}
                  color={colors.contentPrimary}
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
        textColor={colors.accent}
      >
        <Plural
          value={weeklyGoal}
          one="Auto-suggest (# day)"
          other="Auto-suggest (# days)"
        />
      </Button>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: 24,
      padding: 16,
      borderRadius: radii.lg,
      backgroundColor: colors.background,
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
      color: colors.contentSecondary,
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
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 2,
      paddingHorizontal: 2,
      minHeight: 45,
    },
    dayTileActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + "22",
    },
    dayTileDisabled: {
      opacity: 0.4,
    },
    dayLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.contentSecondary,
    },
    dayLabelActive: {
      color: colors.accent,
    },
    workoutLabel: {
      fontSize: 8,
      color: colors.contentSecondary,
      textAlign: "center",
    },
    workoutLabelActive: {
      color: colors.contentPrimary,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      width: "75%",
      maxHeight: "60%",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.card,
      alignSelf: "center",
    },
    modalTitleContainer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.contentSecondary,
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
      borderBottomColor: colors.contentSecondary,
    },
    pickerItemLast: {
      borderBottomWidth: 0,
    },
    pickerItemSelected: {
      backgroundColor: colors.cardSecondary,
    },
    pickerItemText: {
      color: colors.contentPrimary,
      fontSize: 15,
    },
    autoButton: {
      marginTop: 14,
      borderColor: colors.accent,
    },
    autoButtonLabel: {
      fontSize: 13,
    },
  });
}
