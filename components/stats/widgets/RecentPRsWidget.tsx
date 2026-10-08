import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { t, plural } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { formatDaysAgo } from "@/components/stats/ExerciseCompactCard";
import { useRecentPRsQuery } from "@/hooks/useWorkoutSummariesQuery";
import type { RecentPR } from "@/utils/db/workoutStats";
import { formatWeight } from "@/utils/units";
import { planDistanceToDisplay } from "@/utils/planDistance";
import { formatFromTotalSeconds } from "@/utils/utility";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { useWidgetRange } from "./useWidgetRange";
import { WidgetSection } from "./WidgetSection";

/** The record set, and what it improved on, in the user's units. */
export const describePR = (
  pr: RecentPR,
  weightUnit: string,
  distanceUnit: string,
): { set: string; gain: string } => {
  const gain = pr.value - pr.previous;
  switch (pr.tracking_type) {
    case "reps":
      return {
        set: plural(Math.round(pr.value), { one: "# rep", other: "# reps" }),
        gain: `+${Math.round(gain)}`,
      };
    case "time":
      return {
        set: formatFromTotalSeconds(Math.round(pr.value)),
        gain: `+${Math.round(gain)}s`,
      };
    case "distance":
      return {
        set: `${planDistanceToDisplay(pr.value, distanceUnit)} ${distanceUnit}`,
        gain: `+${planDistanceToDisplay(gain, distanceUnit)} ${distanceUnit}`,
      };
    default: {
      const weight = formatWeight(pr.weight ?? 0, weightUnit);
      const reps = pr.reps ?? 0;
      const e1rm = formatWeight(pr.value, weightUnit);
      const delta = formatWeight(gain, weightUnit);
      return {
        set:
          pr.tracking_type === "assisted"
            ? t`${weight} ${weightUnit} assist × ${reps}`
            : `${weight} ${weightUnit} × ${reps}`,
        gain: t`Est. 1RM ${e1rm} ${weightUnit} (+${delta})`,
      };
    }
  }
};

export const RecentPRsWidget: React.FC<{
  config: WidgetConfigs["recentPRs"];
}> = ({ config }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { weightUnit, distanceUnit, openWorkout } = useStatsWidgetContext();
  const { rangeDays, badge } = useWidgetRange(config.range);
  const prs = useRecentPRsQuery(
    rangeDays,
    config.scope === "tracked",
    Number(config.limit),
  );

  return (
    <WidgetSection
      title={t`Recent PRs`}
      rangeBadge={badge}
      loading={prs.isLoading}
      error={!!prs.error}
    >
      {(prs.data?.length ?? 0) === 0 ? (
        <ThemedText style={styles.muted}>
          {config.scope === "tracked" ? (
            <Trans>
              No new personal records for your tracked exercises in this period.
            </Trans>
          ) : (
            <Trans>No new personal records in this period.</Trans>
          )}
        </ThemedText>
      ) : (
        <View style={styles.card}>
          {prs.data!.map((pr, index) => {
            const { set, gain } = describePR(pr, weightUnit, distanceUnit);
            const when = formatDaysAgo(pr.local_date);
            return (
              <TouchableOpacity
                key={`${pr.completed_workout_id}-${pr.exercise_id}`}
                accessibilityRole="button"
                accessibilityLabel={t`New record: ${pr.name}, ${set}, ${gain}, ${when}`}
                onPress={() => openWorkout(pr.completed_workout_id)}
                style={[styles.row, index > 0 && styles.divider]}
                activeOpacity={0.7}
              >
                <AppIcon
                  set="mci"
                  name="trophy"
                  size={20}
                  color={colors.accent}
                />
                <View style={styles.text}>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {pr.name}
                  </ThemedText>
                  <ThemedText style={styles.sub} numberOfLines={1}>
                    {set}
                    {"  ·  "}
                    {gain}
                  </ThemedText>
                </View>
                <ThemedText style={styles.when}>{when}</ThemedText>
              </TouchableOpacity>
            );
          })}
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
      paddingHorizontal: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 10,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.accentBorder,
    },
    text: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: "bold",
    },
    sub: {
      fontSize: 12,
      color: colors.contentSecondary,
      marginTop: 2,
    },
    when: {
      fontSize: 11,
      color: colors.contentSecondary,
    },
    muted: {
      color: colors.contentSecondary,
    },
  });
}
