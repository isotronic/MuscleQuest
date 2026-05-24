import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { PlanScheduleEntry } from "@/utils/database";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Trans, Plural } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
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

interface WorkoutRef {
  id?: number | null;
  name: string;
}

interface Props {
  workouts: WorkoutRef[];
  scheduleEntries: PlanScheduleEntry[];
}

export default function WeeklyScheduleDisplay({
  workouts,
  scheduleEntries,
}: Props) {
  const { _ } = useLingui();
  const scheduleMap = useMemo(() => {
    const workoutById = new Map(
      workouts
        .filter(
          (w): w is WorkoutRef & { id: number } => typeof w.id === "number",
        )
        .map((w) => [w.id, w]),
    );
    const sMap: Record<number, string | null> = {};
    for (const entry of scheduleEntries) {
      const workout = workoutById.get(entry.workout_id);
      sMap[entry.day_of_week] = workout?.name ?? null;
    }
    return sMap;
  }, [workouts, scheduleEntries]);

  const scheduledCount = scheduleEntries.length;

  if (scheduleEntries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="calendar-blank-outline"
          size={14}
          color={Colors.dark.icon}
          style={styles.emptyIcon}
        />
        <ThemedText style={styles.emptyText}>
          <Trans>No schedule set</Trans>
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>
          <Trans>Weekly Schedule</Trans>
        </ThemedText>
        <ThemedText style={styles.summary}>
          <Plural value={scheduledCount} one="# day/week" other="# days/week" />
        </ThemedText>
      </View>
      <View style={styles.grid}>
        {DAY_LABELS.map((label, dow) => {
          const hasWorkout = scheduleMap[dow] !== undefined;
          const workoutName = scheduleMap[dow] || t`Workout`;
          return (
            <View key={dow} style={styles.tileWrapper}>
              <ThemedText
                style={[styles.dayLabel, hasWorkout && styles.dayLabelActive]}
              >
                {_(label)}
              </ThemedText>
              <View
                style={[styles.dayTile, hasWorkout && styles.dayTileActive]}
              >
                <Text
                  style={[
                    styles.workoutLabel,
                    hasWorkout && styles.workoutLabelActive,
                  ]}
                  numberOfLines={2}
                >
                  {hasWorkout ? workoutName : t`Rest`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  summary: {
    fontSize: 12,
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
  dayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.icon,
    marginBottom: 4,
  },
  dayLabelActive: {
    color: Colors.dark.tint,
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
  workoutLabel: {
    fontSize: 8,
    color: Colors.dark.icon,
    textAlign: "center",
  },
  workoutLabelActive: {
    color: Colors.dark.text,
  },
  emptyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  emptyIcon: {
    marginRight: 5,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.dark.icon,
  },
});
