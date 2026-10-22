import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Sortable from "react-native-sortables";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui/AppIcon";
import { describePreviousSet } from "@/components/LastTimeLine";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { UserExercise } from "@/store/workoutStore";
import type { SetValues } from "@/hooks/useCompleteSet";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { convertTimeStrToSeconds } from "@/utils/utility";

type SetRef = { exerciseIndex: number; setIndex: number };

interface SharedProps {
  getValues: (exerciseIndex: number, setIndex: number) => SetValues;
  completedSets: Record<number, Record<number, boolean>>;
  /** Set indices with a new PR, per exercise index. */
  sessionPRs: Record<number, number[]>;
  weightUnit: string;
  distanceUnit: string;
  onOpenSet: (ref: SetRef) => void;
  onCompleteSet: (ref: SetRef) => void;
}

const toNumber = (value: string) => {
  // Session values are canonical strings with ".".
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

/** "60 kg × 8" (and the spoken form) for a set's shown values. */
export function describeSetValues(
  values: SetValues,
  trackingType: string,
  weightUnit: string,
  distanceUnit: string,
) {
  const reps = toNumber(values.reps);
  return describePreviousSet(
    {
      weight: toNumber(values.weight),
      reps: reps == null ? null : Math.trunc(reps),
      time: values.time ? convertTimeStrToSeconds(values.time) : null,
      distance: toNumber(values.distance),
    },
    trackingType,
    weightUnit,
    distanceUnit,
  );
}

/** "Set 2, 60 kilograms, 8 reps, not completed". */
export function setRowLabel(
  setNumber: number,
  spoken: string | undefined,
  completed: boolean,
) {
  return [
    t`Set ${setNumber}`,
    spoken,
    completed ? t`completed` : t`not completed`,
  ]
    .filter(Boolean)
    .join(", ");
}

function SetRow({
  title,
  exercise,
  exerciseIndex,
  setIndex,
  shared,
  styles,
  colors,
}: {
  /** The set number, or the exercise name in a superset round. */
  title: string;
  exercise: UserExercise;
  exerciseIndex: number;
  setIndex: number;
  shared: SharedProps;
  styles: ReturnType<typeof createStyles>;
  colors: AppThemeColors;
}) {
  const set = exercise.sets[setIndex];
  const completed = shared.completedSets[exerciseIndex]?.[setIndex] === true;
  const isPR = shared.sessionPRs[exerciseIndex]?.includes(setIndex) ?? false;
  const described = describeSetValues(
    shared.getValues(exerciseIndex, setIndex),
    resolvedTrackingType(exercise),
    shared.weightUnit,
    shared.distanceUnit,
  );
  const ref = { exerciseIndex, setIndex };
  const markers = [
    set.isWarmup && { key: "w", label: t`Warm-up`, color: colors.badgeWarmup },
    set.isDropSet && { key: "d", label: t`Drop set`, color: colors.badgeDrop },
    set.isToFailure && {
      key: "f",
      label: t`To failure`,
      color: colors.badgeFailure,
    },
  ].filter(Boolean) as { key: string; label: string; color: string }[];

  return (
    <View style={styles.row}>
      <Sortable.Touchable
        onTap={() => shared.onOpenSet(ref)}
        style={styles.rowMain}
        accessible
        accessibilityRole="button"
        accessibilityLabel={[
          setRowLabel(setIndex + 1, described?.spoken, completed),
          ...markers.map((m) => m.label),
          isPR ? t`New personal record` : null,
        ]
          .filter(Boolean)
          .join(", ")}
        accessibilityHint={t`Opens this set`}
      >
        <ThemedText
          style={[styles.rowTitle, completed && styles.rowDone]}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
        <ThemedText
          style={[styles.rowValues, completed && styles.rowDone]}
          numberOfLines={1}
        >
          {described?.text ?? "–"}
        </ThemedText>
        {markers.map((m) => (
          <View
            key={m.key}
            style={[styles.marker, { backgroundColor: m.color }]}
          >
            <ThemedText style={styles.markerText} numberOfLines={1}>
              {m.label}
            </ThemedText>
          </View>
        ))}
        {isPR && (
          <View style={styles.prBadge}>
            <AppIcon
              set="mci"
              name="trophy"
              size={11}
              color={colors.onAccent}
            />
            <ThemedText style={styles.prBadgeText}>
              <Trans>PR</Trans>
            </ThemedText>
          </View>
        )}
      </Sortable.Touchable>
      <Sortable.Touchable
        onTap={() => {
          if (!completed) shared.onCompleteSet(ref);
        }}
        style={styles.check}
        testID={`overview-set-check-${exerciseIndex}-${setIndex}`}
        accessible
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed, disabled: completed }}
        accessibilityLabel={t`Complete set ${setIndex + 1}`}
      >
        <AppIcon
          set="mci"
          name={completed ? "check-circle" : "checkbox-blank-circle-outline"}
          size={26}
          color={completed ? colors.success : colors.contentSecondary}
        />
      </Sortable.Touchable>
    </View>
  );
}

/** One exercise's sets on the overview card. */
export function OverviewSetRows({
  exercise,
  exerciseIndex,
  ...shared
}: SharedProps & { exercise: UserExercise; exerciseIndex: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      {exercise.sets.map((_, setIndex) => (
        <SetRow
          key={setIndex}
          title={String(setIndex + 1)}
          exercise={exercise}
          exerciseIndex={exerciseIndex}
          setIndex={setIndex}
          shared={shared}
          styles={styles}
          colors={colors}
        />
      ))}
    </View>
  );
}

/** A superset's sets by round: both exercises' set N together. */
export function SupersetRoundRows({
  exercises,
  exerciseIndices,
  names,
  ...shared
}: SharedProps & {
  exercises: [UserExercise, UserExercise];
  exerciseIndices: [number, number];
  names: [string, string];
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rounds = Math.max(exercises[0].sets.length, exercises[1].sets.length);
  return (
    <View style={styles.container}>
      {Array.from({ length: rounds }, (_, round) => (
        <View key={round} style={styles.round}>
          <ThemedText style={styles.roundTitle} accessibilityRole="header">
            <Trans>Round {round + 1}</Trans>
          </ThemedText>
          {exercises.map((exercise, i) =>
            round < exercise.sets.length ? (
              <SetRow
                key={i}
                title={names[i]}
                exercise={exercise}
                exerciseIndex={exerciseIndices[i]}
                setIndex={round}
                shared={shared}
                styles={styles}
                colors={colors}
              />
            ) : null,
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    round: {
      paddingTop: 4,
    },
    roundTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.contentSecondary,
      paddingTop: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardSecondary,
    },
    rowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
    },
    rowTitle: {
      minWidth: 20,
      maxWidth: "45%",
      fontSize: 14,
      color: colors.contentSecondary,
    },
    rowValues: {
      flexShrink: 1,
      fontSize: 15,
      color: colors.contentPrimary,
    },
    rowDone: {
      color: colors.contentSecondary,
    },
    marker: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.sm,
      flexShrink: 1,
    },
    markerText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    prBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      backgroundColor: colors.accent,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radii.sm,
    },
    prBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.onAccent,
    },
    check: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
