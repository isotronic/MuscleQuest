import { useState, useEffect, useCallback, useMemo } from "react";
import { AppIconButton } from "@/components/ui";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ActivityIndicator, Button, Divider } from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  startOfWeek,
  endOfWeek,
  format,
  differenceInCalendarMonths,
} from "date-fns";
import { TimeRangeSelector } from "@/components/stats/TimeRangeSelector";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { WorkoutCalendarModal } from "@/components/stats/WorkoutCalendarModal";
import {
  StatsWidgetContext,
  type StatsWidgetContextValue,
} from "@/components/stats/widgets/StatsWidgetContext";
import { WIDGETS } from "@/components/stats/widgets/registry";
import { useWorkoutSummariesQuery } from "@/hooks/useWorkoutSummariesQuery";
import { useWeeklyStreak } from "@/hooks/useWeeklyStreak";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useStatsLayout } from "@/hooks/useStatsLayout";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import type { WorkoutSummary } from "@/utils/db/workoutStats";
import type { StatsWidget } from "@/utils/statsLayout";
import { isLocalDateInRange, localDateKeyToDate } from "@/utils/dates";
import { updateSettings } from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useAppTheme, radii } from "@/theme";

const STATS_QUERY_ROOTS = [
  "trackedExercises",
  "completedWorkouts",
  "bodyMeasurements",
];

const renderWidget = (widget: StatsWidget) => {
  const { Component } = WIDGETS[widget.id] as {
    Component: React.ComponentType<{ config: StatsWidget["config"] }>;
  };
  return <Component key={widget.id} config={widget.config} />;
};

export default function StatsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: settings, isLoading: isLoadingSettings } = useSettingsQuery();
  const { layout } = useStatsLayout();
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
  // Refetch only this screen's data, so a slow query on another mounted
  // screen cannot hold the spinner.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    queryClient.refetchQueries({
      type: "active",
      predicate: (query) =>
        STATS_QUERY_ROOTS.includes(String(query.queryKey[0])),
    }),
  );

  useEffect(() => {
    if (settings?.timeRange) setSelectedTimeRange(settings.timeRange);
  }, [settings?.timeRange]);

  // Every workout figure on this screen comes from per-workout totals and
  // per-body-part counts computed in SQL; no individual sets are loaded.
  const statsOptions = useMemo(
    () => ({ excludeWarmup, countUnilateralDouble, doubleWeightForPaired }),
    [excludeWarmup, countUnilateralDouble, doubleWeightForPaired],
  );

  // The whole history feeds the calendar, the heatmap and the streak. The
  // streak also records finished weeks, so it runs whatever is shown.
  const { data: allWorkouts } = useWorkoutSummariesQuery(0, statsOptions);

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const uniqueWorkoutDaysCount = new Set(
    allWorkouts
      ?.filter((w) =>
        isLocalDateInRange(w.local_date, thisWeekStart, thisWeekEnd),
      )
      .map((w) => w.local_date),
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

  const handleTimeRangeChange = useCallback(
    async (range: string) => {
      setSelectedTimeRange(range);
      try {
        await updateSettings("timeRange", range);
      } catch (err: unknown) {
        notifyBugsnag(err as Error);
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
    const map: Record<string, WorkoutSummary[]> = {};
    for (const w of allWorkouts ?? []) {
      (map[w.local_date] ??= []).push(w);
    }
    return map;
  }, [allWorkouts]);

  const calendarPastScrollRange = useMemo(() => {
    if (!allWorkouts?.length) return 12;
    const oldest = allWorkouts.reduce((min, w) =>
      w.local_date < min.local_date ? w : min,
    );
    return (
      differenceInCalendarMonths(
        new Date(),
        localDateKeyToDate(oldest.local_date),
      ) + 1
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

  const handleOpenCalendar = useCallback(
    (date?: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const fallback =
        Object.keys(allWorkoutsByDate).sort().reverse()[0] ?? null;
      setSelectedDate(date ?? (allWorkoutsByDate[today] ? today : fallback));
      setHistoryVisible(true);
    },
    [allWorkoutsByDate],
  );

  const widgetContext = useMemo<StatsWidgetContextValue>(
    () => ({
      globalRange: selectedTimeRange,
      weightUnit,
      distanceUnit,
      sizeUnit,
      statsOptions,
      excludeDeload,
      weeklyGoal,
      streak,
      allWorkouts,
      openCalendar: handleOpenCalendar,
      openWorkout: handleWorkoutPress,
    }),
    [
      selectedTimeRange,
      weightUnit,
      distanceUnit,
      sizeUnit,
      statsOptions,
      excludeDeload,
      weeklyGoal,
      streak,
      allWorkouts,
      handleOpenCalendar,
      handleWorkoutPress,
    ],
  );

  const openCustomize = useCallback(
    () => router.push("/(app)/(tabs)/(stats)/customize" as never),
    [router],
  );

  const headerRight = useCallback(
    () => (
      <AppIconButton
        accessibilityLabel={t`Customize stats`}
        icon="pencil-outline"
        size={22}
        iconColor={colors.contentPrimary}
        onPress={openCustomize}
      />
    ),
    [colors.contentPrimary, openCustomize],
  );

  if (isLoadingSettings) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  const visibleWidgets = layout.widgets.filter((w) => w.visible);

  return (
    <ThemedView>
      <Stack.Screen options={{ headerRight }} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        <TimeRangeSelector
          selected={selectedTimeRange}
          onChange={handleTimeRangeChange}
        />
        <Divider style={styles.divider} />

        <StatsWidgetContext.Provider value={widgetContext}>
          {visibleWidgets.map(renderWidget)}
        </StatsWidgetContext.Provider>

        {visibleWidgets.length === 0 && (
          <View style={styles.empty}>
            <ThemedText style={{ color: colors.contentSecondary }}>
              <Trans>Every section is hidden.</Trans>
            </ThemedText>
            <Button
              mode="text"
              textColor={colors.accent}
              onPress={openCustomize}
            >
              <Trans>Customize</Trans>
            </Button>
          </View>
        )}
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
        loading={!allWorkouts}
        pastScrollRange={calendarPastScrollRange}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
});
