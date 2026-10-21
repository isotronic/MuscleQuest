import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import {
  buildMuscleSetsRows,
  MuscleSetBars,
  useMuscleName,
} from "@/components/MuscleSetBars";
import { useMuscleSetsSettings } from "@/hooks/useMuscleSetsSettings";
import {
  planMuscleSets,
  untrainedMuscles,
  type PlannedExercise,
} from "@/utils/plannedMuscleSets";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * Planned working sets per muscle across a plan, per week when it has a
 * schedule. Major muscles with no sets stay listed below the header, even
 * collapsed, since they are what the card is for.
 */
export function PlanMuscleSetsCard({
  workouts,
  scheduledWorkoutIndices,
}: {
  workouts: readonly { exercises: readonly PlannedExercise[] }[];
  /** The workout index on each scheduled day; empty without a schedule. */
  scheduledWorkoutIndices: readonly number[];
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { secondaryWeight, target } = useMuscleSetsSettings();
  const nameOf = useMuscleName();
  const [open, setOpen] = useState(false);

  const { totals, weekly } = useMemo(
    () => planMuscleSets(workouts, scheduledWorkoutIndices, secondaryWeight),
    [workouts, scheduledWorkoutIndices, secondaryWeight],
  );
  // A target is per week, so it only applies to a scheduled plan.
  const shownTarget = weekly ? target : null;
  const rows = useMemo(
    () => buildMuscleSetsRows(totals, 1, shownTarget),
    [totals, shownTarget],
  );
  if (rows.length === 0) return null;

  const untrained = untrainedMuscles(totals).map(nameOf).join(", ");
  const title = weekly ? t`Weekly sets per muscle` : t`Sets per muscle`;

  const footnote = [
    weekly
      ? t`Planned working sets per week, from the schedule.`
      : t`Planned working sets for one round of the plan's workouts. Add a schedule to see them per week.`,
    shownTarget
      ? t`Shaded: target of ${shownTarget.min} to ${shownTarget.max} sets.`
      : null,
    secondaryWeight > 0 ? t`Secondary muscles count as half a set.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.header}
        hitSlop={8}
      >
        <ThemedText type="defaultSemiBold" style={styles.title}>
          {title}
        </ThemedText>
        <AppIcon
          set="ion"
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.contentSecondary}
        />
      </Pressable>
      {untrained ? (
        <ThemedText style={styles.untrained}>
          <Trans>Not trained: {untrained}</Trans>
        </ThemedText>
      ) : (
        <ThemedText style={styles.muted}>
          <Trans>Every major muscle gets some work.</Trans>
        </ThemedText>
      )}
      {open && (
        <View style={styles.body}>
          <MuscleSetBars
            rows={rows}
            target={shownTarget}
            nameOf={nameOf}
            rowLabel={(name, sets, zone) =>
              weekly
                ? zone
                  ? t`${name}, ${sets} sets per week, ${zone}`
                  : t`${name}, ${sets} sets per week`
                : t`${name}, ${sets} sets`
            }
          />
          <ThemedText style={styles.footnote}>{footnote}</ThemedText>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
      gap: 4,
      marginVertical: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    title: {
      flex: 1,
    },
    untrained: {
      fontSize: 13,
      color: colors.contentPrimary,
    },
    muted: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    body: {
      gap: 8,
      marginTop: 8,
    },
    footnote: {
      fontSize: 11,
      color: colors.contentSecondary,
      marginTop: 4,
    },
  });
}
