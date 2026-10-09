import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { ThemedText } from "@/components/ThemedText";
import { useTrainingSplitQuery } from "@/hooks/useWorkoutSummariesQuery";
import {
  bodyPartTranslations,
  muscleTranslations,
} from "@/constants/dbTranslations";
import { capitalizeWords } from "@/utils/utility";
import { localDateKeyToDate } from "@/utils/dates";
import { mergeSplitRows, weeksInRange } from "@/utils/workoutStats";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { useWidgetRange } from "./useWidgetRange";
import { WidgetSection } from "./WidgetSection";
import { DEVICE_LOCALE } from "@/utils/numberFormat";

type Zone = "below" | "within" | "above";

export interface MuscleSetsRow {
  key: string;
  perWeek: number;
  zone: Zone | null;
}

/** Average weekly sets per group, largest first, with each one's target zone. */
export const buildMuscleSetsRows = (
  totals: Record<string, number>,
  weeks: number,
  target: { min: number; max: number } | null,
): MuscleSetsRow[] =>
  Object.entries(totals)
    .map(([key, total]) => {
      const perWeek = Math.round((total / weeks) * 10) / 10;
      const zone: Zone | null = !target
        ? null
        : perWeek < target.min
          ? "below"
          : perWeek > target.max
            ? "above"
            : "within";
      return { key, perWeek, zone };
    })
    .filter((row) => row.perWeek > 0)
    .sort((a, b) => b.perWeek - a.perWeek || a.key.localeCompare(b.key));

const formatSets = (value: number) =>
  value.toLocaleString(DEVICE_LOCALE, { maximumFractionDigits: 1 });

export const MuscleSetsWidget: React.FC<{
  config: WidgetConfigs["muscleSets"];
}> = ({ config }) => {
  const { _ } = useLingui();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { statsOptions, allWorkouts } = useStatsWidgetContext();
  const { rangeDays, badge } = useWidgetRange(config.range);
  const split = useTrainingSplitQuery(rangeDays, config.groupBy, statsOptions);

  const oldest = allWorkouts?.length
    ? allWorkouts[allWorkouts.length - 1].local_date
    : null;
  const target = useMemo(
    () =>
      config.showTarget
        ? { min: config.targetMin, max: config.targetMax }
        : null,
    [config.showTarget, config.targetMin, config.targetMax],
  );

  const rows = useMemo(() => {
    if (!split.data) return [];
    const secondaryWeight =
      config.groupBy === "muscle" && config.secondaryHalf ? 0.5 : 0;
    const totals = mergeSplitRows(
      split.data,
      config.groupBy,
      "sets",
      secondaryWeight,
    );
    const weeks = weeksInRange(
      rangeDays,
      oldest ? localDateKeyToDate(oldest) : null,
    );
    return buildMuscleSetsRows(totals, weeks, target);
  }, [
    split.data,
    config.groupBy,
    config.secondaryHalf,
    rangeDays,
    oldest,
    target,
  ]);

  const scaleMax = Math.max(
    1,
    ...rows.map((r) => r.perWeek),
    target ? target.max * 1.15 : 0,
  );
  const pct = (value: number) => `${Math.min(100, (value / scaleMax) * 100)}%`;

  const nameOf = (key: string) => {
    const table =
      config.groupBy === "muscle" ? muscleTranslations : bodyPartTranslations;
    return table[key] ? capitalizeWords(_(table[key])) : capitalizeWords(key);
  };

  const zoneText = (zone: Zone | null) =>
    zone === "below"
      ? t`below target`
      : zone === "above"
        ? t`above target`
        : zone === "within"
          ? t`within target`
          : "";

  const barColor = (zone: Zone | null) =>
    zone === "below" ? colors.accentBorderStrong : colors.accent;

  return (
    <WidgetSection
      title={t`Sets per Muscle / Week`}
      rangeBadge={badge}
      loading={split.isLoading}
      error={!!split.error}
    >
      {rows.length === 0 ? (
        <ThemedText style={styles.muted}>
          <Trans>No sets logged in this period.</Trans>
        </ThemedText>
      ) : (
        <View style={styles.card}>
          {rows.map((row) => {
            const name = nameOf(row.key);
            const sets = formatSets(row.perWeek);
            const zone = zoneText(row.zone);
            return (
              <View
                key={row.key}
                style={styles.row}
                accessible
                accessibilityLabel={
                  zone
                    ? t`${name}, ${sets} sets per week, ${zone}`
                    : t`${name}, ${sets} sets per week`
                }
              >
                <ThemedText style={styles.name} numberOfLines={1}>
                  {name}
                </ThemedText>
                <View style={styles.track}>
                  {target ? (
                    <View
                      style={[
                        styles.band,
                        {
                          left: pct(target.min) as `${number}%`,
                          width: `${
                            ((target.max - target.min) / scaleMax) * 100
                          }%`,
                        },
                      ]}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.bar,
                      {
                        width: pct(row.perWeek) as `${number}%`,
                        backgroundColor: barColor(row.zone),
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.value}>{sets}</ThemedText>
              </View>
            );
          })}
          <ThemedText style={styles.footnote}>
            {target
              ? config.groupBy === "muscle" && config.secondaryHalf
                ? t`Average working sets per week. Shaded: target of ${target.min} to ${target.max} sets. Secondary muscles count as half a set.`
                : t`Average working sets per week. Shaded: target of ${target.min} to ${target.max} sets.`
              : config.groupBy === "muscle" && config.secondaryHalf
                ? t`Average working sets per week. Secondary muscles count as half a set.`
                : t`Average working sets per week.`}
          </ThemedText>
        </View>
      )}
    </WidgetSection>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
      gap: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    name: {
      width: 96,
      fontSize: 13,
    },
    track: {
      flex: 1,
      height: 14,
      justifyContent: "center",
    },
    band: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: colors.accentSubtle,
      borderRadius: radii.sm,
    },
    bar: {
      height: 10,
      borderRadius: radii.sm,
    },
    value: {
      width: 36,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "right",
    },
    footnote: {
      fontSize: 11,
      color: colors.contentSecondary,
      marginTop: 4,
    },
    muted: {
      color: colors.contentSecondary,
    },
  });
}
