import React, { useMemo } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SparklineChart } from "@/components/charts/SparklineChart";
import { TrackedExerciseWithSets } from "@/hooks/useTrackedExercisesQuery";
import { Colors } from "@/constants/Colors";

interface ExerciseCompactCardProps {
  exercise: TrackedExerciseWithSets;
  weightUnit: string;
  distanceUnit: string;
  onPress: () => void;
}

const formatDaysAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
};

const formatPRLabel = (
  exercise: TrackedExerciseWithSets,
  unit: string,
  distanceUnit: string,
): string => {
  const convFactor = unit === "lbs" ? 2.2046226 : 1;
  const pr = exercise.allTimePR;
  if (!pr) return "—";
  switch (exercise.tracking_type) {
    case "reps":
      return `${Math.round(pr)} reps`;
    case "time":
      return `${Math.round(pr)}s`;
    case "distance":
      return `${pr.toFixed(1)} ${distanceUnit}`;
    default:
      return `1RM ${(pr * convFactor).toFixed(1)} ${unit}`;
  }
};

export const ExerciseCompactCard: React.FC<ExerciseCompactCardProps> =
  React.memo(({ exercise, weightUnit, distanceUnit, onPress }) => {
    const latestSet = exercise.completed_sets[0];
    const daysAgo = latestSet ? formatDaysAgo(latestSet.date_completed) : null;
    const prLabel = formatPRLabel(exercise, weightUnit, distanceUnit);

    const sparkData = useMemo(
      () =>
        [...exercise.completed_sets]
          .reverse()
          .slice(-12)
          .map((s) => ({ value: s.progressionMetric })),
      [exercise.completed_sets],
    );

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.card}
      >
        <View style={styles.left}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {exercise.name}
          </ThemedText>
          <ThemedText style={styles.sub}>
            {prLabel}
            {daysAgo ? `  ·  ${daysAgo}` : ""}
          </ThemedText>
        </View>
        <View style={styles.right}>
          <SparklineChart data={sparkData} width={100} height={30} />
          <ThemedText style={styles.chevron}>›</ThemedText>
        </View>
      </TouchableOpacity>
    );
  });
ExerciseCompactCard.displayName = "ExerciseCompactCard";

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  left: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: "bold",
  },
  sub: {
    fontSize: 12,
    color: Colors.dark.subText,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chevron: {
    fontSize: 22,
    color: Colors.dark.subText,
    lineHeight: 26,
  },
});
