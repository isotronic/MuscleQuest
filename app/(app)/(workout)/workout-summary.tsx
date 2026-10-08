import { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Button } from "react-native-paper";
import { AppIcon } from "@/components/ui";
import { Trans, Plural } from "@lingui/react/macro";
import { t, plural } from "@lingui/core/macro";
import React from "react";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompletedWorkoutByIdQuery } from "@/hooks/useCompletedWorkoutByIdQuery";
import {
  RECENT_HISTORY_DAYS,
  useCompletedWorkoutsQuery,
  useWorkoutSessionHistoryQuery,
  type CompletedWorkout,
} from "@/hooks/useCompletedWorkoutsQuery";
import { startOfWeek, endOfWeek } from "date-fns";
import { isLocalDateInRange, localDateKeyToDate } from "@/utils/dates";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import ProgressionSummaryCard from "@/components/ProgressionSummaryCard";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { useClearFinishedWorkout } from "@/hooks/useClearFinishedWorkout";
import { ConfettiAnimation } from "@/components/ConfettiAnimation";

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
        accessibilityRole="button"
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityState={{ expanded }}
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
  const { completedWorkoutId, fresh, durationTrimmed } = useLocalSearchParams<{
    completedWorkoutId: string;
    fresh?: string;
    durationTrimmed?: string;
  }>();
  const showConfetti = fresh === "true";
  useClearFinishedWorkout(fresh);
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
  const { isCurrentWeekDeload } = useDeloadWeekQuery(
    workout?.plan_id ?? undefined,
  );
  const { data: history } = useWorkoutSessionHistoryQuery(
    workoutId,
    weightUnit,
    distanceUnit,
  );
  // Only this week's workouts are counted below.
  const { data: allWorkouts } = useCompletedWorkoutsQuery(
    weightUnit,
    distanceUnit,
    RECENT_HISTORY_DAYS,
  );

  const weeklyGoal = Number(settings?.weeklyGoal ?? 0);

  const workoutsThisWeek = useMemo(() => {
    if (!allWorkouts) return 0;
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const thisWeek = allWorkouts.filter((w) =>
      isLocalDateInRange(w.local_date, weekStart, weekEnd),
    );
    return new Set(thisWeek.map((w) => w.local_date)).size;
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
  const savedDay = localDateKeyToDate(workout.local_date).toLocaleDateString(
    undefined,
    { weekday: "long", day: "numeric", month: "long" },
  );

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

        {durationTrimmed === "true" && (
          <ThemedText style={styles.durationNote}>
            <Trans>Duration trimmed to your last logged set</Trans>
            {"\n"}
            {t`Saved to ${savedDay}, when you logged your last set.`}
          </ThemedText>
        )}

        {prevWorkout && !workout.is_deload && !prevWorkout.is_deload && (
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
        {prevWorkout && !!workout.is_deload && (
          <View style={styles.deloadNote}>
            <ThemedText style={styles.deloadNoteText}>
              <Trans>Deload week — comparison paused.</Trans>
            </ThemedText>
          </View>
        )}
        {prevWorkout && !workout.is_deload && !!prevWorkout.is_deload && (
          <View style={styles.deloadNote}>
            <ThemedText style={styles.deloadNoteText}>
              <Trans>Last session was a deload — comparison skipped.</Trans>
            </ThemedText>
          </View>
        )}

        {weeklyGoal > 0 && (
          <WeeklyGoalBanner completed={workoutsThisWeek} goal={weeklyGoal} />
        )}

        {progressionSettings.enabled && workoutId > 0 && (
          <ProgressionSummaryCard
            workoutId={workoutId}
            weightUnit={weightUnit}
            isCurrentWeekDeload={isCurrentWeekDeload}
          />
        )}

        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
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
    durationNote: {
      color: colors.contentSecondary,
      textAlign: "center",
      fontSize: 13,
      marginTop: 8,
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
    deloadNote: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
      alignItems: "center",
    },
    deloadNoteText: {
      fontSize: 13,
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
