import { useMemo, useState, useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { ActivityIndicator, Divider } from "react-native-paper";
import { TimeRangeSelector } from "@/components/stats/TimeRangeSelector";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useExerciseDetailQuery } from "@/hooks/useExerciseDetailQuery";
import { ExerciseProgressionChart } from "@/components/charts/ExerciseProgressionChart";
import { formatToHoursMinutes } from "@/utils/utility";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export default function ExerciseDetailScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { exerciseId, name } = useLocalSearchParams<{
    exerciseId: string;
    name: string;
  }>();
  const navigation = useNavigation();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const excludeWarmup = settings?.excludeWarmupSets === "true";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const doubleWeightForPaired = settings?.doubleWeightForPaired === "true";
  const excludeDeload = settings?.exclude_deload_from_stats === "1";
  const [timeRange, setTimeRange] = useState("30");

  useEffect(() => {
    if (name) navigation.setOptions({ title: name });
  }, [name, navigation]);

  useEffect(() => {
    if (settings?.timeRange) setTimeRange(settings.timeRange);
  }, [settings?.timeRange]);

  const { data, isLoading } = useExerciseDetailQuery(
    parseInt(exerciseId ?? "0"),
    timeRange,
    weightUnit,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
    excludeDeload,
  );

  const convFactor = weightUnit === "lbs" ? 2.2046226 : 1;

  const prValue = data?.allTimePR ?? 0;
  const latestMetric = data?.latestMetric ?? null;
  const deltaPercent =
    prValue > 0 && latestMetric != null && latestMetric !== prValue
      ? (((latestMetric - prValue) / prValue) * 100).toFixed(1)
      : null;

  const formatMetric = (
    val: number | null,
    trackingType: string | null,
  ): string => {
    if (val == null) return "—";
    if (trackingType === "reps") return `${Math.round(val)} reps`;
    if (trackingType === "time") return `${Math.round(val)}s`;
    if (trackingType === "distance") return `${val.toFixed(1)} ${distanceUnit}`;
    return `${(val * convFactor).toFixed(1)} ${weightUnit}`;
  };

  const trackingType = data?.trackingType ?? null;

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Time range selector */}
        <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
        <Divider style={styles.divider} />

        {/* Stat pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <ThemedText style={styles.pillLabel}>
              <Trans>All-time PR</Trans>
            </ThemedText>
            <ThemedText style={styles.pillValue}>
              {formatMetric(prValue || null, trackingType)}
            </ThemedText>
          </View>
          <View style={styles.pillDivider} />
          <View style={styles.pill}>
            <ThemedText style={styles.pillLabel}>
              <Trans>Latest</Trans>
            </ThemedText>
            <ThemedText style={styles.pillValue}>
              {formatMetric(latestMetric, trackingType)}
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
                      color:
                        parseFloat(deltaPercent) >= 0
                          ? colors.success
                          : colors.danger,
                    },
                  ]}
                >
                  {parseFloat(deltaPercent) >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(parseFloat(deltaPercent))}%
                </ThemedText>
              </View>
            </>
          )}
        </View>

        {/* Progression chart */}
        {data?.trackedExercise && (
          <View style={styles.section}>
            <ExerciseProgressionChart
              exercise={data.trackedExercise}
              timeRange={timeRange}
              weightUnit={weightUnit}
              distanceUnit={distanceUnit}
              prValue={prValue > 0 ? prValue : undefined}
              preRangeBaseline={data.preRangeBaseline}
            />
          </View>
        )}

        {/* Top PR sets */}
        {data?.topPRSets && data.topPRSets.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Top PR Sets</Trans>
            </ThemedText>
            {data.topPRSets.map((set, i) => (
              <View key={i} style={styles.listRow}>
                <ThemedText style={styles.listMain}>
                  {set.distance != null
                    ? `${set.distance.toFixed(1)} ${distanceUnit}`
                    : set.weight != null
                      ? `${(set.weight * convFactor).toFixed(1)} ${weightUnit} × ${set.reps} reps`
                      : set.reps != null
                        ? `${set.reps} reps`
                        : set.time != null
                          ? formatToHoursMinutes(set.time)
                          : "—"}
                </ThemedText>
                <ThemedText style={styles.listSub}>
                  {set.oneRepMax != null
                    ? `1RM ${(set.oneRepMax * convFactor).toFixed(1)} ${weightUnit}  ·  `
                    : ""}
                  {new Date(set.date_completed).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Recent sessions */}
        {data?.recentSessions && data.recentSessions.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Recent Sessions</Trans>
            </ThemedText>
            {data.recentSessions.map((session, i) => (
              <View key={i} style={styles.listRow}>
                <ThemedText style={styles.listMain}>
                  {new Date(session.date_completed).toLocaleDateString(
                    undefined,
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    },
                  )}
                </ThemedText>
                <ThemedText style={styles.listSub}>
                  {session.bestSet.distance != null
                    ? `${session.bestSet.distance.toFixed(1)} ${distanceUnit}`
                    : session.bestSet.weight != null
                      ? `${(session.bestSet.weight * convFactor).toFixed(1)} ${weightUnit} × ${session.bestSet.reps} reps`
                      : session.bestSet.reps != null
                        ? `${session.bestSet.reps} reps`
                        : session.bestSet.time != null
                          ? `${session.bestSet.time}s`
                          : "—"}
                  {session.bestSet.oneRepMax != null
                    ? `  ·  1RM ${(session.bestSet.oneRepMax * convFactor).toFixed(1)} ${weightUnit}`
                    : ""}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {!data?.trackedExercise && (
          <ThemedText
            style={{ color: colors.contentSecondary, textAlign: "center" }}
          >
            <Trans>No data for this period.</Trans>
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    container: {
      flex: 1,
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
  });
}
