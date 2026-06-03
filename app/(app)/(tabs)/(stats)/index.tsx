import { useState, useEffect, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
} from "react-native-paper";
import { TimeRangeSelector } from "@/components/stats/TimeRangeSelector";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import {
  CompletedWorkout,
  useCompletedWorkoutsQuery,
  usePreviousPeriodWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import {
  startOfWeek,
  endOfWeek,
  format,
  differenceInCalendarMonths,
} from "date-fns";
import { useWeeklyStreak } from "@/hooks/useWeeklyStreak";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { WorkoutHistorySection } from "@/components/stats/WorkoutHistorySection";
import { WorkoutCalendarModal } from "@/components/stats/WorkoutCalendarModal";
import { InsightsStrip } from "@/components/stats/InsightsStrip";
import { StatsTile } from "@/components/stats/StatsTile";
import { ExerciseCompactCard } from "@/components/stats/ExerciseCompactCard";
import { useRouter } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useBodyMeasurementSessionsQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import { useTrackedExercisesQuery } from "@/hooks/useTrackedExercisesQuery";
import { useReorderTrackedExercisesMutation } from "@/hooks/useReorderTrackedExercisesMutation";
import { useStatsInsights } from "@/hooks/useStatsInsights";
import Sortable from "react-native-sortables";
import { WorkoutBarChart } from "@/components/charts/WorkoutBarChart";
import { VolumeBarChart } from "@/components/charts/VolumeBarChart";
import BodyPartChart from "@/components/charts/BodyPartChart";
import { updateSettings } from "@/utils/database";
import { useQueryClient } from "@tanstack/react-query";
import { formatToHoursMinutes } from "@/utils/utility";
import { bodyMetricTranslations } from "@/constants/dbTranslations";
import Bugsnag from "@bugsnag/expo";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const computeStats = (
  workouts: CompletedWorkout[],
  weightUnit: string,
  excludeWarmup: boolean,
  countUnilateralDouble: boolean = false,
  doubleWeightForPaired: boolean = false,
) => {
  const tonDivisor = weightUnit === "lbs" ? 2000 : 1000;
  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce(
    (acc, w) =>
      acc +
      w.exercises.reduce(
        (a, e) =>
          a + e.sets.filter((s) => !excludeWarmup || !s.is_warmup).length,
        0,
      ),
    0,
  );
  const totalVolume = workouts.reduce(
    (acc, w) =>
      acc +
      w.exercises.reduce((a, e) => {
        const weightM = doubleWeightForPaired && e.double_weight ? 2 : 1;
        const repM = countUnilateralDouble && e.is_unilateral ? 2 : 1;
        return (
          a +
          e.sets.reduce(
            (s, set) =>
              (!excludeWarmup || !set.is_warmup) && set.weight && set.reps
                ? s + set.weight * weightM * set.reps * repM
                : s,
            0,
          )
        );
      }, 0),
    0,
  );
  const totalTimeSeconds = workouts.reduce((acc, w) => acc + w.duration, 0);
  return {
    totalWorkouts,
    totalSets,
    totalVolumeTons: totalVolume / tonDivisor,
    totalTimeSeconds,
    avgDurationSeconds:
      totalWorkouts > 0 ? Math.round(totalTimeSeconds / totalWorkouts) : 0,
  };
};

export default function StatsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const sizeUnit = (settings?.sizeUnit || "cm") as "cm" | "in";
  const excludeWarmup = settings?.excludeWarmupSets === "true";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const doubleWeightForPaired = settings?.doubleWeightForPaired === "true";
  const excludeDeload = settings?.exclude_deload_from_stats === "1";
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    settings?.timeRange || "30",
  );
  const [historyVisible, setHistoryVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const reorderMutation = useReorderTrackedExercisesMutation();

  useEffect(() => {
    if (settings?.timeRange) setSelectedTimeRange(settings.timeRange);
  }, [settings?.timeRange]);

  const {
    data: exercises,
    isLoading: isLoadingExercises,
    error: exercisesError,
  } = useExercisesQuery();
  const {
    data: trackedExercises,
    isLoading: isLoadingTracked,
    error: trackedError,
  } = useTrackedExercisesQuery(
    selectedTimeRange,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
    excludeDeload,
  );
  const {
    data: completedWorkouts,
    isLoading: isLoadingWorkouts,
    error,
  } = useCompletedWorkoutsQuery(
    weightUnit,
    distanceUnit,
    parseInt(selectedTimeRange),
  );

  const { data: prevWorkouts } = usePreviousPeriodWorkoutsQuery(
    weightUnit,
    distanceUnit,
    parseInt(selectedTimeRange),
  );

  const { data: latestMeasurements } = useBodyMeasurementSessionsQuery(
    { weightUnit: weightUnit as "kg" | "lbs", sizeUnit },
    1,
  );

  const {
    data: allWorkouts,
    isLoading: isLoadingAllWorkouts,
    error: allWorkoutsError,
  } = useCompletedWorkoutsQuery(weightUnit, distanceUnit);

  useEffect(() => {
    const anyError =
      error || exercisesError || trackedError || allWorkoutsError;
    if (anyError) {
      Bugsnag.notify(
        anyError instanceof Error ? anyError : new Error(String(anyError)),
      );
    }
  }, [error, exercisesError, trackedError, allWorkoutsError]);

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekWorkouts = allWorkouts?.filter((w) => {
    const d = new Date(w.date_completed);
    return d >= thisWeekStart && d <= thisWeekEnd;
  });
  const uniqueWorkoutDaysCount = new Set(
    thisWeekWorkouts?.map((w) => new Date(w.date_completed).toDateString()),
  ).size;
  const weeklyGoal = Number(settings?.weeklyGoal ?? 0);
  const weeklyGoalReached =
    uniqueWorkoutDaysCount >= weeklyGoal && weeklyGoal > 0;
  const { streak } = useWeeklyStreak(
    allWorkouts,
    weeklyGoal,
    uniqueWorkoutDaysCount,
    weeklyGoalReached,
  );

  const insights = useStatsInsights(
    completedWorkouts,
    trackedExercises,
    exercises?.otherExercises,
    parseInt(selectedTimeRange),
    weightUnit,
    distanceUnit,
    excludeWarmup,
  );

  const handleTimeRangeChange = useCallback(
    async (range: string) => {
      setSelectedTimeRange(range);
      try {
        await updateSettings("timeRange", range);
      } catch (err: any) {
        Bugsnag.notify(err);
      } finally {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      }
    },
    [queryClient],
  );

  const handleWorkoutPress = useCallback(
    (id: number) => router.push(`/history-details?id=${id}`),
    [router],
  );

  const allWorkoutsByDate = useMemo(() => {
    const map: Record<string, CompletedWorkout[]> = {};
    for (const w of allWorkouts ?? []) {
      const key = format(new Date(w.date_completed), "yyyy-MM-dd");
      (map[key] ??= []).push(w);
    }
    return map;
  }, [allWorkouts]);

  const calendarPastScrollRange = useMemo(() => {
    if (!allWorkouts?.length) return 12;
    const oldest = allWorkouts.reduce((min, w) =>
      new Date(w.date_completed) < new Date(min.date_completed) ? w : min,
    );
    return (
      differenceInCalendarMonths(new Date(), new Date(oldest.date_completed)) +
      1
    );
  }, [allWorkouts]);

  const markedDates = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const marks: Record<string, object> = {};
    for (const date of Object.keys(allWorkoutsByDate)) {
      marks[date] = {
        customStyles: {
          container: {
            borderWidth: 1.5,
            borderColor: colors.accent,
            borderRadius: radii.xl,
          },
          text: {
            color: date === today ? colors.accent : colors.contentPrimary,
            fontWeight:
              date === today ? ("bold" as const) : ("normal" as const),
          },
        },
      };
    }
    // Ensure today is always bold even when it has no workout
    if (!marks[today]) {
      marks[today] = {
        customStyles: {
          container: {},
          text: {
            color: colors.accent,
            fontWeight: "bold" as const,
          },
        },
      };
    }
    if (selectedDate) {
      marks[selectedDate] = {
        customStyles: {
          container: {
            backgroundColor: colors.accent,
            borderRadius: radii.xl,
          },
          text: {
            color: colors.background,
            fontWeight:
              selectedDate === today ? ("bold" as const) : ("normal" as const),
          },
        },
      };
    }
    return marks;
  }, [allWorkoutsByDate, selectedDate, colors]);

  const handleOpenCalendar = useCallback(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const fallback = Object.keys(allWorkoutsByDate).sort().reverse()[0] ?? null;
    setSelectedDate(allWorkoutsByDate[today] ? today : fallback);
    setHistoryVisible(true);
  }, [allWorkoutsByDate]);

  const handleExercisePress = useCallback(
    (exerciseId: number, name: string) =>
      router.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathname: "/(app)/(tabs)/(stats)/exercise-detail" as any,
        params: { exerciseId: exerciseId.toString(), name },
      }),
    [router],
  );

  const handleManageExercisesPress = useCallback(() => {
    router.push({
      pathname: "/(app)/(tabs)/(stats)/exercises",
      params: {
        selectedExercises: JSON.stringify(
          trackedExercises?.map((te) => te.exercise_id),
        ),
      },
    });
  }, [router, trackedExercises]);

  const isLoading =
    isLoadingWorkouts ||
    isLoadingExercises ||
    isLoadingTracked ||
    isLoadingAllWorkouts;

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  const anyError = error || exercisesError || trackedError || allWorkoutsError;
  if (anyError) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>
          <Trans>Error loading stats. Please try again.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  const current = computeStats(
    completedWorkouts ?? [],
    weightUnit,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
  );
  const prev = prevWorkouts
    ? computeStats(
        prevWorkouts,
        weightUnit,
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
      )
    : null;

  const volumeUnit = weightUnit === "lbs" ? "tn" : "t";
  const formattedVolume = current.totalVolumeTons.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const workoutsDelta = prev
    ? current.totalWorkouts - prev.totalWorkouts
    : null;
  const volumeDelta =
    prev != null
      ? parseFloat((current.totalVolumeTons - prev.totalVolumeTons).toFixed(2))
      : null;
  const timeDeltaMinutes =
    prev != null
      ? Math.round((current.totalTimeSeconds - prev.totalTimeSeconds) / 60)
      : null;
  const timeDeltaFormatted = (() => {
    if (timeDeltaMinutes == null) return undefined;
    const abs = Math.abs(timeDeltaMinutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  })();

  return (
    <ThemedView>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Time range selector */}
        <TimeRangeSelector
          selected={selectedTimeRange}
          onChange={handleTimeRangeChange}
        />
        <Divider style={styles.divider} />

        {/* Insights strip */}
        {(completedWorkouts?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Insights</Trans>
            </ThemedText>
            <InsightsStrip
              workoutsPerWeek={insights.workoutsPerWeek}
              biggestGainLabel={insights.biggestGainLabel}
              biggestGainValue={insights.biggestGainValue}
              topBodyPart={insights.topBodyPart}
              streak={streak}
              weightUnit={weightUnit}
            />
          </View>
        )}

        {/* Summary tiles */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            <Trans>Summary</Trans>
          </ThemedText>
          <View style={styles.tileGrid}>
            <StatsTile
              label={t`Workouts`}
              value={String(current.totalWorkouts)}
              delta={workoutsDelta}
            />
            <StatsTile
              label={t`Volume (${volumeUnit})`}
              value={formattedVolume}
              delta={volumeDelta}
              deltaLabel={volumeUnit}
            />
            <StatsTile
              label={t`Total Time`}
              value={formatToHoursMinutes(current.totalTimeSeconds)}
              delta={timeDeltaMinutes}
              deltaText={timeDeltaFormatted}
            />
            <StatsTile
              label={t`Avg Duration`}
              value={formatToHoursMinutes(current.avgDurationSeconds)}
            />
          </View>
        </View>

        {/* Workout history */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Workout History</Trans>
            </ThemedText>
            {(completedWorkouts?.length ?? 0) > 0 && (
              <IconButton
                icon="calendar-month"
                size={20}
                iconColor={colors.accent}
                style={{ margin: 0 }}
                onPress={handleOpenCalendar}
              />
            )}
          </View>
          <WorkoutHistorySection
            completedWorkouts={completedWorkouts ?? []}
            onWorkoutPress={handleWorkoutPress}
            excludeWarmup={excludeWarmup}
          />
        </View>

        {/* Workouts over time */}
        {(completedWorkouts?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Workouts per Week</Trans>
            </ThemedText>
            <WorkoutBarChart
              completedWorkouts={completedWorkouts!}
              timeRange={selectedTimeRange}
            />
          </View>
        )}

        {/* Volume over time */}
        {(completedWorkouts?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Volume per Week ({volumeUnit})</Trans>
            </ThemedText>
            <VolumeBarChart
              completedWorkouts={completedWorkouts!}
              timeRange={selectedTimeRange}
              weightUnit={weightUnit}
              excludeWarmup={excludeWarmup}
              countUnilateralDouble={countUnilateralDouble}
              doubleWeightForPaired={doubleWeightForPaired}
            />
          </View>
        )}

        {/* Training split */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            <Trans>Training Split (by sets)</Trans>
          </ThemedText>
          <BodyPartChart
            completedWorkouts={completedWorkouts}
            exercises={exercises?.otherExercises}
            excludeWarmup={excludeWarmup}
          />
        </View>

        {/* Exercises */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Tracked Exercises</Trans>
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {!isReorderMode && (
                <Button
                  mode="text"
                  compact
                  labelStyle={{ color: colors.accent, fontSize: 13 }}
                  onPress={handleManageExercisesPress}
                >
                  {trackedExercises && trackedExercises.length > 0 ? (
                    <Trans>Manage</Trans>
                  ) : (
                    <Trans>+ Add</Trans>
                  )}
                </Button>
              )}
              {trackedExercises && trackedExercises.length > 1 && (
                <Button
                  mode="text"
                  compact
                  labelStyle={{
                    color: isReorderMode ? colors.accent : colors.contentSecondary,
                    fontSize: 13,
                  }}
                  onPress={() => setIsReorderMode((v) => !v)}
                >
                  {isReorderMode ? <Trans>Done</Trans> : <Trans>Reorder</Trans>}
                </Button>
              )}
            </View>
          </View>
          {trackedExercises && trackedExercises.length > 0 ? (
            isReorderMode ? (
              <Sortable.Grid
                columns={1}
                data={trackedExercises}
                keyExtractor={(item) => item.exercise_id.toString()}
                renderItem={({ item }) => (
                  <ExerciseCompactCard
                    exercise={item}
                    weightUnit={weightUnit}
                    distanceUnit={distanceUnit}
                    isReorderMode
                    onPress={() => {}}
                  />
                )}
                onDragEnd={({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
                  if (fromIndex === toIndex) return;
                  const reordered = [...trackedExercises];
                  const [moved] = reordered.splice(fromIndex, 1);
                  reordered.splice(toIndex, 0, moved);
                  reorderMutation.mutate(reordered.map((e) => e.exercise_id));
                }}
                showDropIndicator
              />
            ) : (
              trackedExercises.map((exercise) => (
                <ExerciseCompactCard
                  key={exercise.exercise_id}
                  exercise={exercise}
                  weightUnit={weightUnit}
                  distanceUnit={distanceUnit}
                  onPress={() =>
                    handleExercisePress(exercise.exercise_id, exercise.name)
                  }
                />
              ))
            )
          ) : (
            <ThemedText style={{ color: colors.contentSecondary }}>
              <Trans>No exercises tracked yet. Tap + Add to start.</Trans>
            </ThemedText>
          )}
        </View>

        {/* Body Measurements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Body Measurements</Trans>
            </ThemedText>
            <Button
              mode="text"
              compact
              labelStyle={{ color: colors.accent, fontSize: 13 }}
              onPress={() =>
                router.push("/(app)/(tabs)/(stats)/measurements" as never)
              }
            >
              <Trans>View All</Trans>
            </Button>
          </View>
          {latestMeasurements && latestMeasurements.length > 0 ? (
            <TouchableOpacity
              style={styles.measurementTile}
              activeOpacity={0.7}
              onPress={() =>
                router.push("/(app)/(tabs)/(stats)/measurements" as never)
              }
            >
              <View style={styles.measurementGrid}>
                {latestMeasurements[0].values.map((v) => (
                  <ThemedText key={v.metric.id} style={styles.measurementValue}>
                    {bodyMetricTranslations[v.metric.key]
                      ? _(bodyMetricTranslations[v.metric.key])
                      : v.metric.label}
                    {": "}
                    {v.displayValue} {v.displayUnit}
                  </ThemedText>
                ))}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                router.push("/(app)/(tabs)/(stats)/measurements" as never)
              }
            >
              <ThemedText style={{ color: colors.contentSecondary }}>
                <Trans>No measurements yet. Tap to log your first entry.</Trans>
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <WorkoutCalendarModal
        visible={historyVisible}
        onDismiss={() => setHistoryVisible(false)}
        markedDates={markedDates}
        selectedDate={selectedDate}
        onDayPress={(dateString) => setSelectedDate(dateString)}
        workoutsForSelectedDate={
          selectedDate ? (allWorkoutsByDate[selectedDate] ?? []) : []
        }
        onWorkoutPress={(id) => {
          setHistoryVisible(false);
          handleWorkoutPress(id);
        }}
        excludeWarmup={excludeWarmup}
        loading={isLoadingWorkouts}
        pastScrollRange={calendarPastScrollRange}
      />
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 50,
    },
    divider: {
      marginBottom: 16,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "bold",
    },
    tileGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    measurementTile: {
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: colors.card,
    },
    measurementGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    measurementValue: {
      width: "50%",
      fontSize: 13,
      lineHeight: 19,
      color: colors.contentSecondary,
    },
  });
}
