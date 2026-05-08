import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Button, Menu } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { Workout } from "@/store/workoutStore";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const disabled = workouts.length === 0;
  const [openMenuDow, setOpenMenuDow] = useState<number | null>(null);

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
          Weekly Schedule
        </ThemedText>
        <ThemedText style={styles.summary}>
          {scheduledDays} day{scheduledDays !== 1 ? "s" : ""}/week
        </ThemedText>
      </View>

      <View style={styles.grid}>
        {DAY_LABELS.map((label, dow) => {
          const workoutIdx = schedule[dow];
          const hasWorkout = workoutIdx !== undefined;
          const workoutName = hasWorkout
            ? workouts[workoutIdx]?.name || `W${workoutIdx + 1}`
            : null;

          return (
            <View key={dow} style={styles.tileWrapper}>
              <Menu
                visible={openMenuDow === dow}
                onDismiss={() => setOpenMenuDow(null)}
                anchor={
                  <Pressable
                    style={[
                      styles.dayTile,
                      hasWorkout && styles.dayTileActive,
                      disabled && styles.dayTileDisabled,
                    ]}
                    onPress={() => !disabled && setOpenMenuDow(dow)}
                    disabled={disabled}
                  >
                    <ThemedText
                      style={[
                        styles.dayLabel,
                        hasWorkout && styles.dayLabelActive,
                      ]}
                    >
                      {label}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.workoutLabel,
                        hasWorkout && styles.workoutLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {hasWorkout ? workoutName : "–"}
                    </ThemedText>
                  </Pressable>
                }
              >
                {workouts.map((w, idx) => (
                  <Menu.Item
                    key={idx}
                    title={w.name || `Workout ${idx + 1}`}
                    leadingIcon={workoutIdx === idx ? "check" : undefined}
                    onPress={() => {
                      onChange({ ...schedule, [dow]: idx });
                      setOpenMenuDow(null);
                    }}
                  />
                ))}
                <Menu.Item
                  title="Rest"
                  leadingIcon={hasWorkout ? undefined : "check"}
                  onPress={() => {
                    const updated = { ...schedule };
                    delete updated[dow];
                    onChange(updated);
                    setOpenMenuDow(null);
                  }}
                />
              </Menu>
            </View>
          );
        })}
      </View>

      <Button
        mode="outlined"
        onPress={handleAutoSuggest}
        disabled={disabled}
        style={styles.autoButton}
        labelStyle={styles.autoButtonLabel}
        textColor={Colors.dark.tint}
      >
        Auto-suggest ({weeklyGoal} days)
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
  },
  dayTile: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.icon,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 1,
    minHeight: 56,
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
    marginTop: 3,
  },
  workoutLabelActive: {
    color: Colors.dark.text,
  },
  autoButton: {
    marginTop: 14,
    borderColor: Colors.dark.tint,
  },
  autoButtonLabel: {
    fontSize: 13,
  },
});
