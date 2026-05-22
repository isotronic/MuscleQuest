import React from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { PlanScheduleEntry } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import { Trans } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

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
}

export default function RestDayCard({ schedule, workouts, todayDow }: Props) {
  const { _ } = useLingui();
  // Find next scheduled workout day (looking forward, wrapping the week)
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
    <ThemedView style={styles.card}>
      <MaterialCommunityIcons
        name="sleep"
        size={28}
        color={Colors.dark.icon}
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <ThemedText type="subtitle" style={styles.title}>
          <Trans>Rest Day</Trans>
        </ThemedText>
        {nextLabel && (
          <ThemedText style={styles.subtitle}>{nextLabel}</ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.icon,
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
    color: Colors.dark.icon,
    marginTop: 2,
  },
});
