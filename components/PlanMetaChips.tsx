import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ThemedText } from "@/components/ThemedText";
import {
  PLAN_EQUIPMENT_LABELS,
  PLAN_GOAL_LABELS,
  PLAN_LEVEL_LABELS,
  premadePlanMeta,
} from "@/constants/premadePlanMeta";
import { formatDurationEstimate } from "@/utils/estimateWorkoutDuration";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export function planDaysLabel(days: number): string {
  return plural(days, { one: "# day a week", other: "# days a week" });
}

export function sessionLengthLabel(minutes: number): string {
  const length = formatDurationEstimate({
    minSeconds: minutes * 60,
    maxSeconds: minutes * 60,
  });
  return t`~${length}`;
}

/**
 * Level, days a week and session length of a premade plan; with `detailed`,
 * also its goal and equipment. Renders nothing for a user plan.
 */
export function PlanMetaChips({
  appPlanId,
  detailed = false,
  style,
}: {
  appPlanId: number | null | undefined;
  detailed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const meta = premadePlanMeta(appPlanId);
  if (!meta) return null;

  const chips = [
    _(PLAN_LEVEL_LABELS[meta.level]),
    planDaysLabel(meta.daysPerWeek),
    sessionLengthLabel(meta.sessionMinutes),
  ];
  if (detailed) {
    chips.push(
      _(PLAN_GOAL_LABELS[meta.goal]),
      _(PLAN_EQUIPMENT_LABELS[meta.equipment]),
    );
  }

  return (
    <View style={[styles.row, style]}>
      {chips.map((label) => (
        <View key={label} style={styles.chip}>
          <ThemedText style={styles.chipText}>{label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      backgroundColor: colors.surfaceHighlight,
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    chipText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.contentPrimary,
    },
  });
}
