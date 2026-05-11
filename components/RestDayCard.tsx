import React from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { PlanScheduleEntry } from "@/utils/database";
import { Workout } from "@/store/workoutStore";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface Props {
  schedule: PlanScheduleEntry[];
  workouts: Workout[];
  todayDow: number; // 0=Mon … 6=Sun
}

export default function RestDayCard({ schedule, workouts, todayDow }: Props) {
  // Find next scheduled workout day (looking forward, wrapping the week)
  let nextLabel: string | null = null;
  for (let i = 1; i <= 7; i++) {
    const nextDow = (todayDow + i) % 7;
    const entry = schedule.find((e) => e.day_of_week === nextDow);
    if (entry) {
      const workout = workouts.find((w) => w.id === entry.workout_id);
      const workoutName = workout?.name ?? "Workout";
      nextLabel = `Next: ${workoutName} on ${DAY_NAMES[nextDow]}`;
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
          Rest Day
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
