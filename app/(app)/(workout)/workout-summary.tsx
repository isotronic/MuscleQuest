import { useState, useEffect, useMemo } from "react";
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
import { AppIcon } from "@/components/ui";
import { Trans, Plural } from "@lingui/react/macro";
import { t, plural } from "@lingui/core/macro";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import React from "react";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import {
  useCompletedWorkoutsQuery,
  useWorkoutSessionHistoryQuery,
  type CompletedWorkout,
} from "@/hooks/useCompletedWorkoutsQuery";
import { startOfWeek, endOfWeek } from "date-fns";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import ProgressionSummaryCard from "@/components/ProgressionSummaryCard";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";

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
      borderRadius: radii.sm,
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
    return t`best ${maxTime}s`;
  }
  if (exercise.exercise_tracking_type === "distance") {
    const maxDist = Math.max(...exercise.sets.map((s) => s.distance ?? 0));
    return maxDist > 0 ? t`best ${maxDist}${distanceUnit}` : "";
  }
  const best = exercise.sets.reduce((b, s) => {
    const vol = (s.weight ?? 0) * (s.reps ?? 0);
    const bVol = (b.weight ?? 0) * (b.reps ?? 0);
    return vol > bVol ? s : b;
  }, exercise.sets[0]);
  if (best.weight != null && best.weight > 0 && best.reps != null) {
    return t`best ${best.weight}${weightUnit} × ${best.reps}`;
  }
  if (best.reps != null) return t`best ${best.reps} reps`;
  return "";
}

function formatSetValue(
  set: CompletedWorkout["exercises"][0]["sets"][0],
  trackingType: string,
  weightUnit: string,
  distanceUnit: string,
): string {
  if (trackingType === "time") return t`${set.time ?? 0}s`;
  if (trackingType === "distance") {
    return set.distance != null ? t`${set.distance}${distanceUnit}` : "—";
  }
  if (set.weight != null && set.reps != null) {
    return t`${set.weight}${weightUnit} × ${set.reps}`;
  }
  if (set.reps != null) return t`${set.reps} reps`;
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
  icon: Extract<React.ComponentProps<typeof AppIcon>, { set: "mci" }>["name"];
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statChip}>
      <AppIcon set="mci" name={icon} size={22} color={colors.accent} />
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isNeutral = diff === 0 || neutral;
  const isPositive = diff > 0;
  const color =
    !isNeutral && isPositive === higherIsBetter
      ? colors.success
      : colors.contentSecondary;

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            <Plural value={exercise.sets.length} one="# set" other="# sets" />
            {bestLabel ? ` · ${bestLabel}` : ""}
          </ThemedText>
        </View>
        <AppIcon
          set="mci"
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.contentSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.setsContainer}>
          {exercise.sets.map((set) => (
            <View key={set.set_id} style={styles.setRow}>
              <ThemedText style={styles.setNumber}>
                <Trans>Set {set.set_number}</Trans>
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
      ? t`${completed} workouts this week. You've smashed your goal!`
      : t`You've hit your weekly goal. Incredible work!`;
  }
  const remaining = goal - completed;
  if (completed === 1) return t`Great start to the week!`;
  if (remaining === 1) return t`One more workout to hit your goal!`;
  return t`Keep the momentum going!`;
}

function WeeklyGoalBanner({
  completed,
  goal,
}: {
  completed: number;
  goal: number;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const goalReached = completed >= goal;
  const accentColor = goalReached ? colors.success : colors.accent;

  return (
    <View style={styles.weeklyGoalCard}>
      <View style={styles.weeklyGoalTop}>
        <AppIcon
          set="mci"
          name={goalReached ? "check-decagram" : "fire"}
          size={18}
          color={accentColor}
        />
        <ThemedText style={[styles.weeklyGoalCount, { color: accentColor }]}>
          <Plural
            value={goal}
            one={`${completed} of # workout this week`}
            other={`${completed} of # workouts this week`}
          />
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
                  i < completed ? accentColor : colors.cardSecondary,
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { completedWorkoutId, fresh } = useLocalSearchParams<{
    completedWorkoutId: string;
    fresh?: string;
  }>();
  const showConfetti = fresh === "true";
  const insets = useSafeAreaInsets();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit ?? "kg";
  const distanceUnit = settings?.distanceUnit ?? "m";
  const progressionSettings = useProgressionSettingsQuery();
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
          (acc, e) => acc + e.sets.filter((s) => !s.is_warmup).length,
          0,
        )
      : w.total_sets_completed;

  if (isLoading) {
    return (
      <View
        style={[styles.container, styles.center, { paddingTop: insets.top }]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isValidId || isError || !workout) {
    return (
      <View
        style={[styles.container, styles.center, { paddingTop: insets.top }]}
      >
        <ThemedText style={{ marginBottom: 16 }}>
          <Trans>Workout not found.</Trans>
        </ThemedText>
        <Button
          mode="contained"
          onPress={() => router.push("/(app)/(tabs)")}
          style={styles.doneButton}
          labelStyle={styles.doneButtonLabel}
        >
          <Trans>Go Home</Trans>
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
  const setsUnit = ` ${plural(Math.abs(setsDiff), { one: "set", other: "sets" })}`;
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
          <AppIcon set="mci" name="trophy" size={56} color={colors.accent} />
          <ThemedText type="title" style={styles.completeTitle}>
            <Trans>Workout Complete!</Trans>
          </ThemedText>
          <ThemedText style={styles.workoutName}>
            {workout.workout_name}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <StatChip
            label={t`Duration`}
            value={formatDuration(workout.duration)}
            icon="clock-outline"
          />
          <View style={styles.statsDivider} />
          <StatChip
            label={t`Sets`}
            value={String(countSets(workout))}
            icon="dumbbell"
          />
          <View style={styles.statsDivider} />
          <StatChip label={t`Volume`} value={volumeDisplay} icon="scale" />
        </View>

        {prevWorkout && (
          <View style={styles.progressionCard}>
            <ThemedText style={styles.progressionTitle}>
              <Trans>vs. last "{workout.workout_name}"</Trans>
            </ThemedText>
            <View style={styles.diffRow}>
              <DiffChip
                label={t`Duration`}
                diff={durationDiffMin}
                unit="m"
                higherIsBetter={false}
                neutral
              />
              <View style={styles.statsDivider} />
              <DiffChip
                label={t`Sets`}
                diff={setsDiff}
                unit={setsUnit}
                higherIsBetter={true}
              />
              <View style={styles.statsDivider} />
              <DiffChip
                label={t`Volume`}
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

        <ThemedText style={styles.sectionTitle}>
          <Trans>Exercises</Trans>
        </ThemedText>
        {workout.exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.exercise_id}
            exercise={exercise}
            weightUnit={weightUnit}
            distanceUnit={distanceUnit}
          />
        ))}

        {progressionSettings.enabled && workoutId > 0 && (
          <ProgressionSummaryCard
            workoutId={workoutId}
            weightUnit={weightUnit}
          />
        )}

        <Button
          mode="contained"
          onPress={() => router.replace("/(app)/(tabs)")}
          style={styles.doneButton}
          labelStyle={styles.doneButtonLabel}
        >
          <Trans>Done</Trans>
        </Button>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.contentSecondary,
      textAlign: "center",
      fontSize: 16,
    },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: radii.lg,
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
      color: colors.contentPrimary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.contentSecondary,
    },
    statsDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.cardSecondary,
    },
    progressionCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      paddingTop: 14,
      paddingBottom: 16,
      paddingHorizontal: 8,
      marginBottom: 16,
      gap: 14,
    },
    progressionTitle: {
      color: colors.contentSecondary,
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
      color: colors.contentSecondary,
    },
    sectionTitle: {
      marginBottom: 10,
      fontSize: 12,
      color: colors.contentSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    exerciseCard: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
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
      color: colors.contentPrimary,
    },
    exerciseMeta: {
      fontSize: 13,
      color: colors.contentSecondary,
      marginTop: 2,
    },
    setsContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.cardSecondary,
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
      color: colors.contentSecondary,
    },
    setValue: {
      fontSize: 13,
      color: colors.contentPrimary,
    },
    doneButton: {
      marginTop: 24,
      borderRadius: radii.md,
      backgroundColor: colors.accent,
    },
    doneButtonLabel: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "700",
      paddingVertical: 4,
    },
    weeklyGoalCard: {
      backgroundColor: colors.card,
      alignItems: "center",
      borderRadius: radii.lg,
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
      borderRadius: radii.sm,
    },
    weeklyGoalMessage: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
  });
}
