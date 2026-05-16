import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
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
  onPress?: () => void;
}

export default function WorkoutDoneCard({
  schedule,
  workouts,
  todayDow,
  onPress,
}: Props) {
  const todayEntry = schedule.find((e) => e.day_of_week === todayDow);
  const todayWorkoutName =
    workouts.find((w) => w.id === todayEntry?.workout_id)?.name ?? null;

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
    <Pressable onPress={onPress} disabled={!onPress}>
      <ThemedView style={styles.card}>
        <MaterialCommunityIcons
          name="check-circle-outline"
          size={28}
          color={Colors.dark.completed}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <ThemedText type="subtitle" style={styles.title}>
            {todayWorkoutName ?? "Workout"} Complete!
          </ThemedText>
          {nextLabel ? (
            <ThemedText style={styles.subtitle}>{nextLabel}</ThemedText>
          ) : (
            <ThemedText style={styles.subtitle}>Great work today!</ThemedText>
          )}
        </View>
        {onPress && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={Colors.dark.icon}
          />
        )}
      </ThemedView>
    </Pressable>
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
    borderColor: Colors.dark.completed,
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
