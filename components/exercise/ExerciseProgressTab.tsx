import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { ActivityIndicator, Divider } from "react-native-paper";
import { TimeRangeSelector } from "@/components/stats/TimeRangeSelector";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { ExerciseProgressionChart } from "@/components/charts/ExerciseProgressionChart";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useExerciseDetailQuery } from "@/hooks/useExerciseDetailQuery";
import { useExerciseHistoryQuery } from "@/hooks/useExerciseHistoryQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { localDateKeyToDate } from "@/utils/dates";
import { nearlyEqual } from "@/utils/units";
import { formatNumber } from "@/utils/numberFormat";
import {
  formatHistorySet,
  formatOneRepMax,
  formatProgressMetric,
  formatProgressSet,
} from "@/utils/exerciseProgressFormat";

/**
 * Chart, PRs and recent sessions for one exercise. Reads its own settings
 * (units, time range, warm-up and deload exclusions).
 */
export function ExerciseProgressTab({ exerciseId }: { exerciseId: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const excludeWarmup = settings?.excludeWarmupSets === "true";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const doubleWeightForPaired = settings?.doubleWeightForPaired === "true";
  const excludeDeload = settings?.exclude_deload_from_stats === "1";
  // Fallback body weight in the user's unit, for assisted sets logged before
  // any body measurement.
  const currentBodyWeight = Number(settings?.bodyWeight ?? 0);
  const [timeRange, setTimeRange] = useState("30");

  useEffect(() => {
    if (settings?.timeRange) setTimeRange(settings.timeRange);
  }, [settings?.timeRange]);

  const { data, isLoading } = useExerciseDetailQuery(
    exerciseId,
    timeRange,
    weightUnit,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
    excludeDeload,
  );
  const { data: history, isLoading: historyLoading } =
    useExerciseHistoryQuery(exerciseId);

  if (isLoading || historyLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </View>
    );
  }

  const sessions = history?.sections ?? [];
  if (sessions.length < 2) {
    const bestSet = sessions[0]?.data.find((set) => set.is_pr);
    return (
      <ScrollView contentContainerStyle={styles.emptyState}>
        <AppIcon
          set="mci"
          name="chart-line"
          size={48}
          color={colors.contentSecondary}
        />
        <ThemedText style={styles.emptyText}>
          <Trans>Log this exercise twice to see a trend</Trans>
        </ThemedText>
        {bestSet && (
          <View style={styles.bestSet}>
            <ThemedText style={styles.pillLabel}>
              <Trans>Best set so far</Trans>
            </ThemedText>
            <ThemedText style={styles.pillValue}>
              {formatHistorySet(
                bestSet,
                history?.trackingType ?? null,
                weightUnit,
                distanceUnit,
                currentBodyWeight,
              )}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    );
  }

  const prValue = data?.allTimePR ?? 0;
  const latestMetric = data?.latestMetric ?? null;
  const deltaPercent =
    prValue > 0 && latestMetric != null && !nearlyEqual(latestMetric, prValue)
      ? Math.round(((latestMetric - prValue) / prValue) * 1000) / 10
      : null;
  const trackingType = data?.trackingType ?? null;
  const metric = (value: number | null) =>
    formatProgressMetric(value, trackingType, weightUnit, distanceUnit);
  const setText = (set: Parameters<typeof formatProgressSet>[0]) =>
    formatProgressSet(set, trackingType, weightUnit, distanceUnit);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
      <Divider style={styles.divider} />

      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <ThemedText style={styles.pillLabel}>
            <Trans>All-time PR</Trans>
          </ThemedText>
          <ThemedText style={styles.pillValue}>
            {metric(prValue || null)}
          </ThemedText>
        </View>
        <View style={styles.pillDivider} />
        <View style={styles.pill}>
          <ThemedText style={styles.pillLabel}>
            <Trans>Latest</Trans>
          </ThemedText>
          <ThemedText style={styles.pillValue}>
            {metric(latestMetric)}
          </ThemedText>
        </View>
        {deltaPercent != null && (
          <>
            <View style={styles.pillDivider} />
            <View style={styles.pill}>
              <ThemedText style={styles.pillLabel}>
                <Trans>vs PR</Trans>
              </ThemedText>
              <ThemedText
                style={[
                  styles.pillValue,
                  {
                    color: deltaPercent >= 0 ? colors.success : colors.danger,
                  },
                ]}
              >
                {deltaPercent >= 0 ? "▲" : "▼"}{" "}
                {formatNumber(Math.abs(deltaPercent), 1)}%
              </ThemedText>
            </View>
          </>
        )}
      </View>

      {data?.trackedExercise && (
        <View style={styles.section}>
          <ExerciseProgressionChart
            exercise={data.trackedExercise}
            timeRange={timeRange}
            weightUnit={weightUnit}
            distanceUnit={distanceUnit}
            prValue={prValue > 0 ? prValue : undefined}
            preRangeBaseline={data.preRangeBaseline}
            showTableToggle
          />
        </View>
      )}

      {data?.topPRSets && data.topPRSets.length > 0 && (
        <View style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            <Trans>Top PR Sets</Trans>
          </ThemedText>
          {data.topPRSets.map((set, i) => {
            const oneRepMax = formatOneRepMax(set.oneRepMax, weightUnit);
            const date = localDateKeyToDate(
              set.date_completed,
            ).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <View key={i} style={styles.listRow}>
                <ThemedText style={styles.listMain}>{setText(set)}</ThemedText>
                <ThemedText style={styles.listSub}>
                  {oneRepMax ? `${oneRepMax}  ·  ${date}` : date}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}

      {data?.recentSessions && data.recentSessions.length > 0 && (
        <View style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            <Trans>Recent Sessions</Trans>
          </ThemedText>
          {data.recentSessions.map((session, i) => {
            const oneRepMax = formatOneRepMax(
              session.bestSet.oneRepMax,
              weightUnit,
            );
            return (
              <View key={i} style={styles.listRow}>
                <ThemedText style={styles.listMain}>
                  {localDateKeyToDate(
                    session.date_completed,
                  ).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </ThemedText>
                <ThemedText style={styles.listSub}>
                  {setText(session.bestSet)}
                  {oneRepMax ? `  ·  ${oneRepMax}` : ""}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}

      {!data?.trackedExercise && (
        <ThemedText style={styles.noData}>
          <Trans>No data for this period.</Trans>
        </ThemedText>
      )}
    </ScrollView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 50,
    },
    divider: { marginBottom: 16 },
    pillRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      marginBottom: 20,
      paddingVertical: 14,
      justifyContent: "space-evenly",
      alignItems: "center",
    },
    pill: { alignItems: "center", flex: 1 },
    pillLabel: {
      fontSize: 11,
      color: colors.contentSecondary,
      marginBottom: 4,
    },
    pillValue: { fontSize: 16, fontWeight: "bold" },
    pillDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.contentSecondary + "40",
    },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
    listRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.card,
    },
    listMain: { fontSize: 14, fontWeight: "600" },
    listSub: { fontSize: 12, color: colors.contentSecondary, marginTop: 2 },
    noData: { color: colors.contentSecondary, textAlign: "center" },
    emptyState: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 16,
      gap: 8,
      backgroundColor: colors.surface,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.contentSecondary,
      textAlign: "center",
    },
    bestSet: {
      marginTop: 16,
      paddingVertical: 14,
      paddingHorizontal: 24,
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.md,
    },
  });
}
