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

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import {
  useCompletedWorkoutsQuery,
  useWorkoutSessionHistoryQuery,
  type CompletedWorkout,
} from "@/hooks/useCompletedWorkoutsQuery";
import { startOfWeek, endOfWeek } from "date-fns";

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

// Deterministic pseudo-random in [0, 1) from a seed
function pr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

type ParticleConfig = {
  id: number;
  startX: number;
  color: string;
  size: number;
  rotationSpeed: number;
  driftAmplitude: number;
  driftFreq: number;
  delay: number;
  duration: number;
};

const PARTICLE_CONFIGS: ParticleConfig[] = Array.from(
  { length: 40 },
  (_, i) => ({
    id: i,
    startX: pr(i * 7 + 1) * SCREEN_WIDTH,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 7 + (i % 5) * 2,
    rotationSpeed: 120 + (i % 7) * 60,
    driftAmplitude: 10 + pr(i * 7 + 4) * 30,
    driftFreq: 0.6 + pr(i * 7 + 5) * 0.8,
    delay: Math.floor(pr(i * 7 + 2) * 1400),
    duration: Math.floor(2200 + pr(i * 7 + 3) * 1800),
  }),
);

function ConfettiParticle({ config }: { config: ParticleConfig }) {
  const progress = useSharedValue(0);
  const {
    startX,
    driftFreq,
    driftAmplitude,
    rotationSpeed,
    size,
    color,
    delay,
    duration,
  } = config;

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration }));
  }, [delay, duration, progress]);

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
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLE_CONFIGS.map((config) => (
        <ConfettiParticle key={config.id} config={config} />
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

function computeVolume(
  workout: CompletedWorkout,
  excludeWarmup: boolean = false,
  countUnilateralDouble: boolean = false,
  doubleWeightForPaired: boolean = false,
): number {
  return workout.exercises.reduce((total, exercise) => {
    const weightM = doubleWeightForPaired && exercise.double_weight ? 2 : 1;
    const repM = countUnilateralDouble && exercise.is_unilateral ? 2 : 1;
    return (
      total +
      exercise.sets.reduce((setTotal, set) => {
        if (
          (!excludeWarmup || !set.is_warmup) &&
          set.weight != null &&
          set.reps != null
        ) {
          return setTotal + set.weight * weightM * set.reps * repM;
        }
        return setTotal;
      }, 0)
    );
  }, 0);
}

function getBestSetLabel(
  exercise: CompletedWorkout["exercises"][0],
  weightUnit: string,
  distanceUnit: string,
): string {
  if (exercise.sets.length === 0) return "";
  if (exercise.exercise_tracking_type === "time") {
    const maxTime = Math.max(...exercise.sets.map((s) => s.time ?? 0));
    return `best ${maxTime}s`;
  }
  if (exercise.exercise_tracking_type === "distance") {
    const maxDist = Math.max(...exercise.sets.map((s) => s.distance ?? 0));
    return maxDist > 0 ? `best ${maxDist}${distanceUnit}` : "";
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
  distanceUnit: string,
): string {
  if (trackingType === "time") return `${set.time ?? 0}s`;
  if (trackingType === "distance") {
    return set.distance != null ? `${set.distance}${distanceUnit}` : "—";
  }
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
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}) {
  return (
    <View style={styles.statChip}>
      <MaterialCommunityIcons name={icon} size={22} color={Colors.dark.tint} />
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
  const color =
    !isNeutral && isPositive === higherIsBetter
      ? Colors.dark.completed
      : Colors.dark.subText;

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
  distanceUnit,
}: {
  exercise: CompletedWorkout["exercises"][0];
  weightUnit: string;
  distanceUnit: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const bestLabel = getBestSetLabel(exercise, weightUnit, distanceUnit);

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
                  distanceUnit,
                )}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// --- Weekly goal banner ---

function getGoalMessage(completed: number, goal: number): string {
  if (completed >= goal) {
    return completed > goal
      ? `${completed} workouts this week. You've smashed your goal!`
      : "You've hit your weekly goal. Incredible work!";
  }
  const remaining = goal - completed;
  if (completed === 1) return "Great start to the week!";
  if (remaining === 1) return "One more workout to hit your goal!";
  return "Keep the momentum going!";
}

function WeeklyGoalBanner({
  completed,
  goal,
}: {
  completed: number;
  goal: number;
}) {
  const goalReached = completed >= goal;
  const accentColor = goalReached ? Colors.dark.completed : Colors.dark.tint;

  return (
    <View style={styles.weeklyGoalCard}>
      <View style={styles.weeklyGoalTop}>
        <MaterialCommunityIcons
          name={goalReached ? "check-decagram" : "fire"}
          size={18}
          color={accentColor}
        />
        <ThemedText style={[styles.weeklyGoalCount, { color: accentColor }]}>
          {completed} of {goal} workouts this week
        </ThemedText>
      </View>
      <View style={styles.weeklyGoalPips}>
        {Array.from({ length: goal }, (_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              {
                backgroundColor:
                  i < completed ? accentColor : Colors.dark.cardBackground2,
              },
            ]}
          />
        ))}
      </View>
      <ThemedText style={styles.weeklyGoalMessage}>
        {getGoalMessage(completed, goal)}
      </ThemedText>
    </View>
  );
}

// --- Main screen ---

export default function WorkoutSummaryScreen() {
  const { completedWorkoutId, fresh } = useLocalSearchParams<{
    completedWorkoutId: string;
    fresh?: string;
  }>();
  const showConfetti = fresh === "true";
  const insets = useSafeAreaInsets();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit ?? "kg";
  const distanceUnit = settings?.distanceUnit ?? "m";
  const excludeWarmup = settings?.excludeWarmupSets === "true";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const doubleWeightForPaired = settings?.doubleWeightForPaired === "true";

  const id = Number(completedWorkoutId);
  const isValidId = Number.isFinite(id) && id > 0;
  const {
    data: workout,
    isLoading,
    isError,
  } = useCompletedWorkoutByIdQuery(id, weightUnit, distanceUnit);

  const workoutId = workout?.workout_id ?? 0;
  const { data: history } = useWorkoutSessionHistoryQuery(
    workoutId,
    weightUnit,
    distanceUnit,
  );
  const { data: allWorkouts } = useCompletedWorkoutsQuery(
    weightUnit,
    distanceUnit,
  );

  const weeklyGoal = Number(settings?.weeklyGoal ?? 0);

  const workoutsThisWeek = useMemo(() => {
    if (!allWorkouts) return 0;
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const thisWeek = allWorkouts.filter((w) => {
      const d = new Date(w.date_completed);
      return d >= weekStart && d <= weekEnd;
    });
    const uniqueDays = new Set(
      thisWeek.map((w) => new Date(w.date_completed).toDateString()),
    );
    return uniqueDays.size;
  }, [allWorkouts]);

  const prevWorkout = useMemo(() => {
    if (!history || !workout) return null;
    return history.find((w) => w.id !== workout.id) ?? null;
  }, [history, workout]);

  const currentVolume = useMemo(
    () =>
      workout
        ? computeVolume(
            workout,
            excludeWarmup,
            countUnilateralDouble,
            doubleWeightForPaired,
          )
        : 0,
    [workout, excludeWarmup, countUnilateralDouble, doubleWeightForPaired],
  );
  const prevVolume = useMemo(
    () =>
      prevWorkout
        ? computeVolume(
            prevWorkout,
            excludeWarmup,
            countUnilateralDouble,
            doubleWeightForPaired,
          )
        : 0,
    [prevWorkout, excludeWarmup, countUnilateralDouble, doubleWeightForPaired],
  );

  const countSets = (w: CompletedWorkout) =>
    excludeWarmup
      ? w.exercises.reduce(
          (t, e) => t + e.sets.filter((s) => !s.is_warmup).length,
          0,
        )
      : w.total_sets_completed;

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
    ? countSets(workout) - countSets(prevWorkout)
    : 0;
  const volumeDiff = currentVolume - prevVolume;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {showConfetti && <ConfettiAnimation />}
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
            value={String(countSets(workout))}
            icon="dumbbell"
          />
          <View style={styles.statsDivider} />
          <StatChip label="Volume" value={volumeDisplay} icon="scale" />
        </View>

        {prevWorkout && (
          <View style={styles.progressionCard}>
            <ThemedText style={styles.progressionTitle}>
              vs. last &ldquo;{workout.workout_name}&rdquo;
            </ThemedText>
            <View style={styles.diffRow}>
              <DiffChip
                label="Duration"
                diff={durationDiffMin}
                unit="m"
                higherIsBetter={false}
                neutral
              />
              <View style={styles.statsDivider} />
              <DiffChip
                label="Sets"
                diff={setsDiff}
                unit=""
                higherIsBetter={true}
              />
              <View style={styles.statsDivider} />
              <DiffChip
                label="Volume"
                diff={volumeDiff}
                unit={weightUnit}
                higherIsBetter={true}
              />
            </View>
          </View>
        )}

        {weeklyGoal > 0 && (
          <WeeklyGoalBanner completed={workoutsThisWeek} goal={weeklyGoal} />
        )}

        <ThemedText style={styles.sectionTitle}>Exercises</ThemedText>
        {workout.exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.exercise_id}
            exercise={exercise}
            weightUnit={weightUnit}
            distanceUnit={distanceUnit}
          />
        ))}

        <Button
          mode="contained"
          onPress={() => router.replace("/(app)/(tabs)")}
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
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 8,
    marginBottom: 16,
    gap: 14,
  },
  progressionTitle: {
    color: Colors.dark.subText,
    textAlign: "center",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 6,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  diffChip: {
    flex: 1,
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
  weeklyGoalCard: {
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  weeklyGoalTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  weeklyGoalCount: {
    fontSize: 15,
    fontWeight: "600",
  },
  weeklyGoalPips: {
    flexDirection: "row",
    gap: 6,
  },
  pip: {
    width: 28,
    height: 6,
    borderRadius: 3,
  },
  weeklyGoalMessage: {
    fontSize: 13,
    color: Colors.dark.subText,
  },
});
