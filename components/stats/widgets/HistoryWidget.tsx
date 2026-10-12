import React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { t } from "@lingui/core/macro";
import { AppIconButton } from "@/components/ui";
import { WorkoutHistorySection } from "@/components/stats/WorkoutHistorySection";
import { useWorkoutSummariesQuery } from "@/hooks/useWorkoutSummariesQuery";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useAppTheme } from "@/theme";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { WidgetSection } from "./WidgetSection";

export const HistoryWidget: React.FC<{
  config: WidgetConfigs["history"];
}> = ({ config }) => {
  const { colors } = useAppTheme();
  const { globalRange, statsOptions, openCalendar, openWorkout } =
    useStatsWidgetContext();
  const workouts = useWorkoutSummariesQuery(
    parseInt(globalRange, 10) || 0,
    statsOptions,
  );
  const list = workouts.data ?? [];
  const shown =
    config.limit === "all" ? list : list.slice(0, Number(config.limit));

  return (
    <WidgetSection
      title={t`Workout History`}
      loading={workouts.isLoading}
      error={!!workouts.error}
      actions={
        <View style={styles.actions}>
          <AppIconButton
            accessibilityLabel={t`Log past workout`}
            icon="calendar-plus"
            size={20}
            iconColor={colors.accent}
            style={styles.action}
            onPress={() => router.push("/(app)/log-workout")}
          />
          {list.length > 0 && (
            <AppIconButton
              accessibilityLabel={t`Open workout calendar`}
              icon="calendar-month"
              size={20}
              iconColor={colors.accent}
              style={styles.action}
              onPress={() => openCalendar()}
            />
          )}
        </View>
      }
    >
      <WorkoutHistorySection
        completedWorkouts={shown}
        onWorkoutPress={openWorkout}
        excludeWarmup={statsOptions.excludeWarmup}
      />
    </WidgetSection>
  );
};

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { margin: 0 },
});
