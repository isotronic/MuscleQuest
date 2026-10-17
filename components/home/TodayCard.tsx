import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Button } from "react-native-paper";
import { Plural, Trans } from "@lingui/react/macro";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui/AppIcon";
import { WorkoutDurationInfo } from "@/components/home/WorkoutDurationInfo";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { Workout } from "@/store/workoutStore";
import type { TodayHero } from "@/utils/homeToday";

const DAY_NAMES = [
  msg`Monday`,
  msg`Tuesday`,
  msg`Wednesday`,
  msg`Thursday`,
  msg`Friday`,
  msg`Saturday`,
  msg`Sunday`,
];

interface Props {
  /** The done-for-today state is WorkoutDoneCard's job, not this card's. */
  hero: Exclude<TodayHero, { kind: "done" }>;
  planName?: string;
  isDeload?: boolean;
  countUnilateralDouble: boolean;
  disabled?: boolean;
  onStart: (workout: Workout, workoutIndex: number) => void;
  onOpen: (workoutIndex: number) => void;
  onBrowsePlans: () => void;
  /** Opens the active plan in the plan editor. */
  onEditPlan: () => void;
}

/** Home's main action: the workout to do next, with a large Start. */
export default function TodayCard({
  hero,
  planName,
  isDeload = false,
  countUnilateralDouble,
  disabled = false,
  onStart,
  onOpen,
  onBrowsePlans,
  onEditPlan,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();

  if (hero.kind === "noPlan") {
    return (
      <View style={[styles.card, styles.cardHighlight]}>
        <ThemedText
          type="subtitle"
          accessibilityRole="header"
          style={styles.title}
        >
          <Trans>No active plan</Trans>
        </ThemedText>
        <ThemedText style={styles.meta}>
          <Trans>Pick a plan or start a quick workout.</Trans>
        </ThemedText>
        <Button
          mode="contained"
          icon="clipboard-list-outline"
          onPress={onBrowsePlans}
          style={styles.startButton}
          contentStyle={styles.startButtonContent}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Explore plans</Trans>
        </Button>
      </View>
    );
  }

  if (hero.kind === "emptyPlan") {
    return (
      <View style={[styles.card, styles.cardHighlight]}>
        <ThemedText
          type="subtitle"
          accessibilityRole="header"
          style={styles.title}
        >
          {planName}
        </ThemedText>
        <ThemedText style={styles.meta}>
          <Trans>This plan has no workouts yet.</Trans>
        </ThemedText>
        <Button
          mode="contained"
          icon="plus"
          onPress={onEditPlan}
          style={styles.startButton}
          contentStyle={styles.startButtonContent}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Add workouts</Trans>
        </Button>
      </View>
    );
  }

  const { workout, workoutIndex, restDay, scheduledToday, nextDow } = hero;
  const workoutName = workout.name || t`Workout ${workoutIndex + 1}`;
  const nextDay = nextDow != null ? _(DAY_NAMES[nextDow]) : null;
  let eyebrow: string;
  if (restDay) {
    eyebrow = nextDay ? t`Rest day, next on ${nextDay}` : t`Rest day`;
  } else if (scheduledToday) {
    eyebrow = t`Today`;
  } else if (nextDay) {
    eyebrow = t`Next on ${nextDay}`;
  } else {
    eyebrow = t`Next up`;
  }
  const days = hero.lastDoneDaysAgo;

  return (
    <View style={[styles.card, !restDay && styles.cardHighlight]}>
      <View style={styles.eyebrowRow}>
        <ThemedText
          style={[styles.eyebrow, restDay && styles.eyebrowMuted]}
          numberOfLines={1}
        >
          {eyebrow}
        </ThemedText>
        {isDeload && (
          <View style={styles.deloadBadge}>
            <ThemedText style={styles.deloadBadgeText}>
              <Trans>Deload Week</Trans>
            </ThemedText>
          </View>
        )}
      </View>
      {/* Details and Start are siblings so a screen reader can reach both. */}
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t`Shows the workout's exercises`}
        onPress={() => onOpen(workoutIndex)}
        style={styles.body}
      >
        <View style={styles.bodyText}>
          <ThemedText type="subtitle" style={styles.title}>
            {workoutName}
          </ThemedText>
          {planName ? (
            <ThemedText style={styles.meta} numberOfLines={1}>
              {planName}
            </ThemedText>
          ) : null}
          <WorkoutDurationInfo
            exercises={workout.exercises}
            countUnilateralDouble={countUnilateralDouble}
            style={styles.meta}
          />
          {days != null && (
            <ThemedText style={styles.meta}>
              {days === 0 ? (
                <Trans>Last done today</Trans>
              ) : days === 1 ? (
                <Trans>Last done yesterday</Trans>
              ) : (
                <Plural
                  value={days}
                  one="Last done # day ago"
                  other="Last done # days ago"
                />
              )}
            </ThemedText>
          )}
        </View>
        <AppIcon
          set="mci"
          name="chevron-right"
          size={22}
          color={colors.contentSecondary}
        />
      </Pressable>
      <Button
        mode={restDay ? "outlined" : "contained"}
        icon="play"
        onPress={() => onStart(workout, workoutIndex)}
        disabled={disabled}
        style={styles.startButton}
        contentStyle={styles.startButtonContent}
        labelStyle={styles.startButtonLabel}
        accessibilityLabel={t`Start ${workoutName}`}
      >
        <Trans>Start</Trans>
      </Button>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.contentSecondary,
    },
    cardHighlight: {
      borderColor: colors.accent,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    eyebrow: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.accent,
    },
    eyebrowMuted: {
      color: colors.contentSecondary,
    },
    deloadBadge: {
      backgroundColor: colors.accentSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.sm,
    },
    deloadBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    body: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bodyText: {
      flex: 1,
    },
    title: {
      color: colors.contentPrimary,
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 2,
    },
    meta: {
      color: colors.contentSecondary,
      fontSize: 14,
    },
    startButton: {
      marginTop: 16,
      borderRadius: radii.md,
    },
    startButtonContent: {
      minHeight: 50,
    },
    startButtonLabel: {
      fontSize: 18,
      lineHeight: 27,
    },
  });
}
