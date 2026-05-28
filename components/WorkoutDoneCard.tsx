import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { AppIcon } from "@/components/ui";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PlanScheduleEntry } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import { Trans } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const DAY_NAMES = [
  msg`Monday`,
  msg`Tuesday`,
  msg`Wednesday`,
  msg`Thursday`,
  msg`Friday`,
  msg`Saturday`,
  msg`Sunday`,
];

interface Props {
  schedule: PlanScheduleEntry[];
  workouts: Workout[];
  todayDow: number; // 0=Mon … 6=Sun
  onPress?: () => void;
}

export default function WorkoutDoneCard({
  schedule,
  workouts,
  todayDow,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const todayEntry = schedule.find((e) => e.day_of_week === todayDow);
  const todayWorkoutName =
    workouts.find((w) => w.id === todayEntry?.workout_id)?.name ?? null;

  let nextLabel: string | null = null;
  for (let i = 1; i <= 7; i++) {
    const nextDow = (todayDow + i) % 7;
    const entry = schedule.find((e) => e.day_of_week === nextDow);
    if (entry) {
      const workout = workouts.find((w) => w.id === entry.workout_id);
      const workoutName = workout?.name ?? t`Workout`;
      nextLabel = t`Next: ${workoutName} on ${_(DAY_NAMES[nextDow])}`;
      break;
    }
  }

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ThemedView style={styles.card}>
        <AppIcon
          set="mci"
          name="check-circle-outline"
          size={28}
          color={colors.success}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <ThemedText type="subtitle" style={styles.title}>
            <Trans>{todayWorkoutName ?? t`Workout`} Complete!</Trans>
          </ThemedText>
          {nextLabel ? (
            <ThemedText style={styles.subtitle}>{nextLabel}</ThemedText>
          ) : (
            <ThemedText style={styles.subtitle}>
              <Trans>Great work today!</Trans>
            </ThemedText>
          )}
        </View>
        {onPress && (
          <AppIcon
            set="mci"
            name="chevron-right"
            size={20}
            color={colors.contentSecondary}
          />
        )}
      </ThemedView>
    </Pressable>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radii.lg,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.success,
    },
    icon: {
      marginRight: 14,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 16,
    },
    subtitle: {
      fontSize: 13,
      color: colors.contentSecondary,
      marginTop: 2,
    },
  });
}
