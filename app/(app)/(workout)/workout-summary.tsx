import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import {
  useWorkoutSessionHistoryQuery,
  type CompletedWorkout,
} from "@/hooks/useCompletedWorkoutsQuery";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Reanimated 4: Animated.View types don't include children in strict TS
const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  children?: React.ReactNode;
}>;

// --- Confetti ---

const CONFETTI_COLORS = [
  "#ebaa39",
  "#4CAF50",
  "#e74043",
  "#9B59B6",
  "#3498DB",
  "#E67E22",
  "#1ABC9C",
];

type ParticleConfig = {
  id: number;
  startX: number;
  color: string;
  size: number;
  rotationSpeed: number;
  driftAmplitude: number;
  driftFreq: number;
};

const PARTICLE_CONFIGS: ParticleConfig[] = Array.from(
  { length: 35 },
  (_, i) => ({
    id: i,
    startX: (i / 35) * SCREEN_WIDTH + Math.sin(i * 2.3) * 20,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 7 + (i % 5) * 2,
    rotationSpeed: 120 + (i % 7) * 60,
    driftAmplitude: 12 + (i % 5) * 10,
    driftFreq: 0.8 + (i % 4) * 0.35,
  }),
);

function ConfettiParticle({
  config,
  progress,
}: {
  config: ParticleConfig;
  progress: SharedValue<number>;
}) {
  const { startX, driftFreq, driftAmplitude, rotationSpeed, size, color } =
    config;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const y = -30 + p * (SCREEN_HEIGHT + 60);
    const x = startX + Math.sin(p * Math.PI * 2 * driftFreq) * driftAmplitude;
    const rotation = p * rotationSpeed;
    const opacity = p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1;
    return {
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: size,
      height: Math.ceil(size * 0.5),
      backgroundColor: color,
      borderRadius: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotation}deg` },
      ] as any,
      opacity,
    };
  });

  return <AnimatedView style={animatedStyle} />;
}

function ConfettiAnimation() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(400, withTiming(1, { duration: 3000 }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLE_CONFIGS.map((config) => (
        <ConfettiParticle key={config.id} config={config} progress={progress} />
      ))}
    </View>
  );
}

// --- Helpers ---

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function computeVolume(workout: CompletedWorkout): number {
  return workout.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.reduce((setTotal, set) => {
        if (set.weight != null && set.reps != null) {
          return setTotal + set.weight * set.reps;
        }
        return setTotal;
      }, 0),
    0,
  );
}

function getBestSetLabel(
  exercise: CompletedWorkout["exercises"][0],
  weightUnit: string,
): string {
  if (exercise.sets.length === 0) return "";
  if (exercise.exercise_tracking_type === "time") {
    const maxTime = Math.max(...exercise.sets.map((s) => s.time ?? 0));
    return `best ${maxTime}s`;
  }
  const best = exercise.sets.reduce((b, s) => {
    const vol = (s.weight ?? 0) * (s.reps ?? 0);
    const bVol = (b.weight ?? 0) * (b.reps ?? 0);
    return vol > bVol ? s : b;
  }, exercise.sets[0]);
  if (best.weight != null && best.reps != null) {
    return `best ${best.weight}${weightUnit} × ${best.reps}`;
  }
  if (best.reps != null) return `best ${best.reps} reps`;
  return "";
}

function formatSetValue(
  set: CompletedWorkout["exercises"][0]["sets"][0],
  trackingType: string,
  weightUnit: string,
): string {
  if (trackingType === "time") return `${set.time ?? 0}s`;
  if (set.weight != null && set.reps != null) {
    return `${set.weight}${weightUnit} × ${set.reps}`;
  }
  if (set.reps != null) return `${set.reps} reps`;
  return "—";
}

// --- Sub-components ---

function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <View style={styles.statChip}>
      <MaterialCommunityIcons
        name={icon as any}
        size={22}
        color={Colors.dark.tint}
      />
      <ThemedText type="defaultSemiBold" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function DiffChip({
  label,
  diff,
  unit,
  higherIsBetter,
  neutral = false,
}: {
  label: string;
  diff: number;
  unit: string;
  higherIsBetter: boolean;
  neutral?: boolean;
}) {
  const isNeutral = diff === 0 || neutral;
  const isPositive = diff > 0;
  const color = isNeutral
    ? Colors.dark.subText
    : isPositive === higherIsBetter
      ? Colors.dark.completed
      : Colors.dark.highlight;

  const sign = diff > 0 ? "+" : "";
  const displayVal = Number.isInteger(diff)
    ? `${sign}${diff}${unit}`
    : `${sign}${diff.toFixed(1)}${unit}`;

  return (
    <View style={styles.diffChip}>
      <ThemedText style={[styles.diffValue, { color }]}>
        {displayVal}
      </ThemedText>
      <ThemedText style={styles.diffLabel}>{label}</ThemedText>
    </View>
  );
}

function ExerciseRow({
  exercise,
  weightUnit,
}: {
  exercise: CompletedWorkout["exercises"][0];
  weightUnit: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const bestLabel = getBestSetLabel(exercise, weightUnit);

  return (
    <View style={styles.exerciseCard}>
      <TouchableOpacity
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.exerciseHeader}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseHeaderText}>
          <ThemedText type="defaultSemiBold" style={styles.exerciseName}>
            {exercise.exercise_name}
          </ThemedText>
          <ThemedText style={styles.exerciseMeta}>
            {exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"}
            {bestLabel ? ` · ${bestLabel}` : ""}
          </ThemedText>
        </View>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={Colors.dark.icon}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.setsContainer}>
          {exercise.sets.map((set) => (
            <View key={set.set_id} style={styles.setRow}>
              <ThemedText style={styles.setNumber}>
                Set {set.set_number}
              </ThemedText>
              <ThemedText style={styles.setValue}>
                {formatSetValue(
                  set,
                  exercise.exercise_tracking_type,
                  weightUnit,
                )}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// --- Main screen ---

export default function WorkoutSummaryScreen() {
  const { completedWorkoutId } = useLocalSearchParams<{
    completedWorkoutId: string;
  }>();
  const insets = useSafeAreaInsets();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit ?? "kg";

  const id = Number(completedWorkoutId);
  const isValidId = Number.isFinite(id) && id > 0;
  const {
    data: workout,
    isLoading,
    isError,
  } = useCompletedWorkoutByIdQuery(id, weightUnit);

  const workoutId = workout?.workout_id ?? 0;
  const { data: history } = useWorkoutSessionHistoryQuery(
    workoutId,
    weightUnit,
  );

  const prevWorkout = useMemo(() => {
    if (!history || !workout) return null;
    return history.find((w) => w.id !== workout.id) ?? null;
  }, [history, workout]);

  const currentVolume = useMemo(
    () => (workout ? computeVolume(workout) : 0),
    [workout],
  );
  const prevVolume = useMemo(
    () => (prevWorkout ? computeVolume(prevWorkout) : 0),
    [prevWorkout],
  );

  if (isLoading) {
    return (
      <View
        style={[styles.container, styles.center, { paddingTop: insets.top }]}
      >
        <ActivityIndicator size="large" color={Colors.dark.tint} />
      </View>
    );
  }

  if (!isValidId || isError || !workout) {
    return (
      <View
        style={[styles.container, styles.center, { paddingTop: insets.top }]}
      >
        <ThemedText style={{ marginBottom: 16 }}>Workout not found.</ThemedText>
        <Button
          mode="contained"
          onPress={() => router.push("/(app)/(tabs)")}
          style={styles.doneButton}
          labelStyle={styles.doneButtonLabel}
        >
          Go Home
        </Button>
      </View>
    );
  }

  const volumeDisplay =
    currentVolume > 0
      ? `${Number.isInteger(currentVolume) ? currentVolume : currentVolume.toFixed(1)}${weightUnit}`
      : "—";

  const durationDiffMin = prevWorkout
    ? Math.round((workout.duration - prevWorkout.duration) / 60)
    : 0;
  const setsDiff = prevWorkout
    ? workout.total_sets_completed - prevWorkout.total_sets_completed
    : 0;
  const volumeDiff = currentVolume - prevVolume;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ConfettiAnimation />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <MaterialCommunityIcons
            name="trophy"
            size={56}
            color={Colors.dark.tint}
          />
          <ThemedText type="title" style={styles.completeTitle}>
            Workout Complete!
          </ThemedText>
          <ThemedText style={styles.workoutName}>
            {workout.workout_name}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <StatChip
            label="Duration"
            value={formatDuration(workout.duration)}
            icon="clock-outline"
          />
          <View style={styles.statsDivider} />
          <StatChip
            label="Sets"
            value={String(workout.total_sets_completed)}
            icon="dumbbell"
          />
          <View style={styles.statsDivider} />
          <StatChip label="Volume" value={volumeDisplay} icon="scale" />
        </View>

        {prevWorkout && (
          <View style={styles.progressionCard}>
            <ThemedText style={styles.progressionTitle}>
              vs. Previous Session
            </ThemedText>
            <View style={styles.diffRow}>
              <DiffChip
                label="Duration"
                diff={durationDiffMin}
                unit="m"
                higherIsBetter={false}
                neutral
              />
              <DiffChip
                label="Sets"
                diff={setsDiff}
                unit=""
                higherIsBetter={true}
              />
              <DiffChip
                label="Volume"
                diff={volumeDiff}
                unit={weightUnit}
                higherIsBetter={true}
              />
            </View>
          </View>
        )}

        <ThemedText style={styles.sectionTitle}>Exercises</ThemedText>
        {workout.exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.exercise_id}
            exercise={exercise}
            weightUnit={weightUnit}
          />
        ))}

        <Button
          mode="contained"
          onPress={() => router.push("/(app)/(tabs)")}
          style={styles.doneButton}
          labelStyle={styles.doneButtonLabel}
        >
          Done
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 32,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 28,
    gap: 8,
  },
  completeTitle: {
    marginTop: 8,
    textAlign: "center",
  },
  workoutName: {
    color: Colors.dark.subText,
    textAlign: "center",
    fontSize: 16,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.subText,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.dark.cardBackground2,
  },
  progressionCard: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  progressionTitle: {
    color: Colors.dark.subText,
    marginBottom: 12,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  diffRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  diffChip: {
    alignItems: "center",
    gap: 4,
  },
  diffValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  diffLabel: {
    fontSize: 12,
    color: Colors.dark.subText,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 12,
    color: Colors.dark.subText,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  exerciseCard: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  exerciseHeaderText: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    color: Colors.dark.text,
  },
  exerciseMeta: {
    fontSize: 13,
    color: Colors.dark.subText,
    marginTop: 2,
  },
  setsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.cardBackground2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  setNumber: {
    fontSize: 13,
    color: Colors.dark.subText,
  },
  setValue: {
    fontSize: 13,
    color: Colors.dark.text,
  },
  doneButton: {
    marginTop: 24,
    borderRadius: 8,
    backgroundColor: Colors.dark.tint,
  },
  doneButtonLabel: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 4,
  },
});
