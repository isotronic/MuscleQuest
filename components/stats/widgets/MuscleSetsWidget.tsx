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
import { buildMuscleSetsRows, MuscleSetBars } from "@/components/MuscleSetBars";

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

  const nameOf = (key: string) => {
    const table =
      config.groupBy === "muscle" ? muscleTranslations : bodyPartTranslations;
    return table[key] ? capitalizeWords(_(table[key])) : capitalizeWords(key);
  };

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
          <MuscleSetBars
            rows={rows}
            target={target}
            nameOf={nameOf}
            rowLabel={(name, sets, zone) =>
              zone
                ? t`${name}, ${sets} sets per week, ${zone}`
                : t`${name}, ${sets} sets per week`
            }
          />
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
