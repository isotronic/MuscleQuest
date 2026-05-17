import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

interface Props {
  workoutsThisWeek: CompletedWorkout[];
  allCompletedWorkouts: CompletedWorkout[];
  weeklyGoal: number;
  weightUnit: string;
  streak: number;
  excludeWarmup?: boolean;
  countUnilateralDouble?: boolean;
  doubleWeightForPaired?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getProgressionMetric(
  weight: number | null,
  reps: number | null,
  time: number | null,
  trackingType: string,
  weightM: number = 1,
  repM: number = 1,
): number | null {
  if (trackingType === "reps") return reps != null ? reps * repM : null;
  if (trackingType === "time") return time;
  // weight, assisted, or null → Epley 1RM (weightM applies; repM does not affect 1RM)
  if (weight != null && reps != null)
    return weight * weightM * (1 + reps / 30.0);
  return null;
}

interface BestAchievement {
  exerciseName: string;
  trackingType: string;
  thisWeekBest: number;
  delta: number;
  weightUnit: string;
}

function computeBestAchievement(
  workoutsThisWeek: CompletedWorkout[],
  allCompletedWorkouts: CompletedWorkout[],
  weightUnit: string,
  excludeWarmup: boolean = false,
  countUnilateralDouble: boolean = false,
  doubleWeightForPaired: boolean = false,
): BestAchievement | null {
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(currentWeekStart, 1);
  const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });

  const lastWeekWorkouts = allCompletedWorkouts.filter((w) => {
    const d = new Date(w.date_completed);
    return d >= lastWeekStart && d <= lastWeekEnd;
  });

  // Build map of exercise_id → best metric for last week
  const lastWeekBest = new Map<number, number>();
  for (const workout of lastWeekWorkouts) {
    for (const ex of workout.exercises) {
      const weightM = doubleWeightForPaired && ex.double_weight ? 2 : 1;
      const repM = countUnilateralDouble && ex.is_unilateral ? 2 : 1;
      for (const set of ex.sets) {
        if (excludeWarmup && set.is_warmup) continue;
        const metric = getProgressionMetric(
          set.weight,
          set.reps,
          set.time,
          ex.exercise_tracking_type,
          weightM,
          repM,
        );
        if (metric == null) continue;
        const prev = lastWeekBest.get(ex.exercise_id) ?? -Infinity;
        if (metric > prev) lastWeekBest.set(ex.exercise_id, metric);
      }
    }
  }

  // Build map of exercise_id → { name, trackingType, best } for this week
  const thisWeekBest = new Map<
    number,
    { name: string; trackingType: string; best: number }
  >();
  for (const workout of workoutsThisWeek) {
    for (const ex of workout.exercises) {
      const weightM = doubleWeightForPaired && ex.double_weight ? 2 : 1;
      const repM = countUnilateralDouble && ex.is_unilateral ? 2 : 1;
      for (const set of ex.sets) {
        if (excludeWarmup && set.is_warmup) continue;
        const metric = getProgressionMetric(
          set.weight,
          set.reps,
          set.time,
          ex.exercise_tracking_type,
          weightM,
          repM,
        );
        if (metric == null) continue;
        const prev = thisWeekBest.get(ex.exercise_id);
        if (!prev || metric > prev.best) {
          thisWeekBest.set(ex.exercise_id, {
            name: ex.exercise_name,
            trackingType: ex.exercise_tracking_type,
            best: metric,
          });
        }
      }
    }
  }

  let bestAchievement: BestAchievement | null = null;
  let bestPercentage = 0;

  thisWeekBest.forEach(({ name, trackingType, best }, exerciseId) => {
    const lastBest = lastWeekBest.get(exerciseId);
    if (!lastBest) return; // no baseline from last week, skip
    const delta = best - lastBest;
    if (delta <= 0) return;
    const percentage = delta / lastBest;
    if (percentage > bestPercentage) {
      bestPercentage = percentage;
      bestAchievement = {
        exerciseName: name,
        trackingType,
        thisWeekBest: best,
        delta,
        weightUnit,
      };
    }
  });

  return bestAchievement;
}

function formatAchievement(a: BestAchievement): {
  label: string;
  value: string;
} {
  const unit = a.weightUnit;
  const pct = Math.round((a.delta / (a.thisWeekBest - a.delta)) * 100);
  const pctStr = `+${pct}%`;
  if (a.trackingType === "reps") {
    return {
      label: "Rep PR",
      value: `${a.exerciseName}: ${Math.round(a.thisWeekBest)} reps (+${Math.round(a.delta)}, ${pctStr})`,
    };
  }
  if (a.trackingType === "time") {
    return {
      label: "Time PR",
      value: `${a.exerciseName}: ${Math.round(a.thisWeekBest)}s (+${Math.round(a.delta)}s, ${pctStr})`,
    };
  }
  return {
    label: "1RM",
    value: `${a.exerciseName}: ${a.thisWeekBest.toFixed(1)}${unit} (+${a.delta.toFixed(1)}${unit}, ${pctStr})`,
  };
}

export default function WeeklySummaryCard({
  workoutsThisWeek,
  allCompletedWorkouts,
  weeklyGoal,
  weightUnit,
  streak,
  excludeWarmup = false,
  countUnilateralDouble = false,
  doubleWeightForPaired = false,
}: Props) {
  const totalDuration = useMemo(
    () => workoutsThisWeek.reduce((sum, w) => sum + (w.duration ?? 0), 0),
    [workoutsThisWeek],
  );

  const totalVolume = useMemo(() => {
    let vol = 0;
    for (const workout of workoutsThisWeek) {
      for (const ex of workout.exercises) {
        const weightM = doubleWeightForPaired && ex.double_weight ? 2 : 1;
        const repM = countUnilateralDouble && ex.is_unilateral ? 2 : 1;
        for (const set of ex.sets) {
          if (
            (!excludeWarmup || !set.is_warmup) &&
            set.weight != null &&
            set.reps != null
          ) {
            vol += set.weight * weightM * set.reps * repM;
          }
        }
      }
    }
    return vol;
  }, [
    workoutsThisWeek,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
  ]);

  const bestAchievement = useMemo(
    () =>
      computeBestAchievement(
        workoutsThisWeek,
        allCompletedWorkouts,
        weightUnit,
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
      ),
    [
      workoutsThisWeek,
      allCompletedWorkouts,
      weightUnit,
      excludeWarmup,
      countUnilateralDouble,
      doubleWeightForPaired,
    ],
  );

  const volumeLabel = `${Math.round(totalVolume).toLocaleString()} ${weightUnit}`;

  const achievementFormatted = bestAchievement
    ? formatAchievement(bestAchievement)
    : null;

  return (
    <ThemedView style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="trophy-outline"
          size={22}
          color={Colors.dark.tint}
        />
        <ThemedText type="subtitle" style={styles.title}>
          Weekly Goal Complete!
        </ThemedText>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsGrid}>
        <View style={styles.statRow}>
          <MaterialCommunityIcons
            name="calendar-check-outline"
            size={16}
            color={Colors.dark.icon}
          />
          <ThemedText style={styles.statLabel}>Workouts</ThemedText>
          <ThemedText style={styles.statValue}>
            {workoutsThisWeek.length} / {weeklyGoal}
          </ThemedText>
        </View>

        <View style={styles.statRow}>
          <MaterialCommunityIcons
            name="weight-kilogram"
            size={16}
            color={Colors.dark.icon}
          />
          <ThemedText style={styles.statLabel}>Volume</ThemedText>
          <ThemedText style={styles.statValue}>{volumeLabel}</ThemedText>
        </View>

        <View style={styles.statRow}>
          <MaterialCommunityIcons
            name="timer-outline"
            size={16}
            color={Colors.dark.icon}
          />
          <ThemedText style={styles.statLabel}>Time</ThemedText>
          <ThemedText style={styles.statValue}>
            {formatDuration(totalDuration)}
          </ThemedText>
        </View>

        {achievementFormatted && (
          <View style={styles.statRow}>
            <MaterialCommunityIcons
              name="trending-up"
              size={16}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.statLabel}>
              {achievementFormatted.label}
            </ThemedText>
            <ThemedText style={[styles.statValue, styles.achievementValue]}>
              {achievementFormatted.value}
            </ThemedText>
          </View>
        )}

        {streak > 0 && (
          <View style={styles.statRow}>
            <MaterialCommunityIcons
              name="fire"
              size={16}
              color={Colors.dark.tint}
            />
            <ThemedText style={styles.statLabel}>Streak</ThemedText>
            <ThemedText style={[styles.statValue, styles.streakValue]}>
              {streak} {streak === 1 ? "week" : "weeks"} in a row
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.tint,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    color: Colors.dark.tint,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.tint,
    opacity: 0.2,
    marginBottom: 12,
  },
  statsGrid: {
    gap: 10,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.icon,
  },
  statValue: {
    fontSize: 13,
    textAlign: "right",
  },
  achievementValue: {
    flex: 2,
    textAlign: "right",
  },
  streakValue: {
    color: Colors.dark.tint,
  },
});
