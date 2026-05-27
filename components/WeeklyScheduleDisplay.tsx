import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { PlanScheduleEntry } from "@/utils/database";

import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          color={colors.contentSecondary}
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

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: 20,
      padding: 16,
      borderRadius: radii.md,
      backgroundColor: colors.card,
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
      color: colors.contentPrimary,
    },
    summary: {
      fontSize: 12,
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
    dayLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.contentSecondary,
      marginBottom: 4,
    },
    dayLabelActive: {
      color: colors.accent,
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
    workoutLabel: {
      fontSize: 8,
      color: colors.contentSecondary,
      textAlign: "center",
    },
    workoutLabelActive: {
      color: colors.contentPrimary,
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
      color: colors.contentSecondary,
    },
  });
}
