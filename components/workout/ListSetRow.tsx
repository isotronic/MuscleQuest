import React, { forwardRef, useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { TimeInput } from "@/components/TimeInput";
import {
  describePreviousSet,
  type PreviousSet,
} from "@/components/LastTimeLine";
import {
  describeSetValues,
  setRowLabel,
} from "@/components/workout/OverviewSetRows";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { Set as PlanSet } from "@/store/workoutStore";
import type { SetValues } from "@/hooks/useCompleteSet";
import { sanitizeIntegerInput } from "@/utils/numberFormat";
import { formatTimeInput } from "@/utils/utility";

interface Props {
  /** The set number, or the exercise name in a superset round. */
  title: string;
  setNumber: number;
  set: PlanSet;
  trackingType: string;
  values: SetValues;
  lastTime: PreviousSet | null;
  completed: boolean;
  isPR: boolean;
  weightUnit: string;
  distanceUnit: string;
  onChange: (field: keyof SetValues, value: string) => void;
  onComplete: () => void;
  /** Moves focus on from this row's last input. */
  onSubmitLast?: () => void;
}

/**
 * One set in the list logging mode: inline inputs for its tracking type,
 * last time's values and a check that completes it. The forwarded ref is
 * the row's first text input, for moving focus here.
 */
export const ListSetRow = forwardRef<TextInput, Props>(function ListSetRow(
  {
    title,
    setNumber,
    set,
    trackingType,
    values,
    lastTime,
    completed,
    isPR,
    weightUnit,
    distanceUnit,
    onChange,
    onComplete,
    onSubmitLast,
  },
  firstInputRef,
) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const repsRef = React.useRef<TextInput>(null);
  const isWeightType =
    trackingType === "weight" || trackingType === "assisted" || !trackingType;
  const hasReps = trackingType !== "time" && trackingType !== "distance";
  const last = lastTime
    ? describePreviousSet(lastTime, trackingType, weightUnit, distanceUnit)
    : null;
  const shown = describeSetValues(
    values,
    trackingType,
    weightUnit,
    distanceUnit,
  );
  const marker = set.isWarmup
    ? { label: t`Warm-up`, color: colors.badgeWarmup }
    : set.isDropSet
      ? { label: t`Drop set`, color: colors.badgeDrop }
      : set.isToFailure
        ? { label: t`To failure`, color: colors.badgeFailure }
        : null;

  return (
    <View style={[styles.row, completed && styles.rowDone]}>
      <View style={styles.titleCell}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {marker && (
          <View style={[styles.marker, { backgroundColor: marker.color }]}>
            <ThemedText style={styles.markerText} numberOfLines={1}>
              {marker.label}
            </ThemedText>
          </View>
        )}
        {isPR && (
          <AppIcon
            set="mci"
            name="trophy"
            size={14}
            color={colors.accent}
            accessibilityLabel={t`New personal record`}
          />
        )}
      </View>
      <ThemedText
        style={styles.last}
        numberOfLines={2}
        accessibilityLabel={last ? t`Last time: ${last.spoken}` : undefined}
      >
        {last?.text ?? "–"}
      </ThemedText>
      <View style={styles.inputs}>
        {isWeightType && (
          <DecimalInput
            ref={firstInputRef}
            value={values.weight}
            onChangeValue={(v) => onChange("weight", v)}
            accessibilityLabel={
              trackingType === "assisted"
                ? t`Assistance in ${weightUnit}, set ${setNumber}`
                : t`Weight in ${weightUnit}, set ${setNumber}`
            }
            selectTextOnFocus
            returnKeyType="next"
            onSubmitEditing={() => repsRef.current?.focus()}
            blurOnSubmit={false}
            style={[styles.input, styles.inputWide]}
          />
        )}
        {hasReps && (
          <TextInput
            ref={isWeightType ? repsRef : firstInputRef}
            value={values.reps}
            onChangeText={(text) =>
              onChange("reps", sanitizeIntegerInput(text))
            }
            keyboardType="numeric"
            accessibilityLabel={t`Reps, set ${setNumber}`}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={onSubmitLast}
            style={styles.input}
          />
        )}
        {trackingType === "time" && (
          <TimeInput
            ref={firstInputRef}
            onSubmitEditing={onSubmitLast}
            value={formatTimeInput(values.time)}
            onChange={(v) => onChange("time", v.replace(/[^0-9]/g, ""))}
            accessibilityLabel={t`Time, set ${setNumber}`}
            style={styles.timeInput}
          />
        )}
        {trackingType === "distance" && (
          <DecimalInput
            ref={firstInputRef}
            value={values.distance}
            onChangeValue={(v) => onChange("distance", v)}
            accessibilityLabel={t`Distance in ${distanceUnit}, set ${setNumber}`}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={onSubmitLast}
            style={[styles.input, styles.inputWide]}
          />
        )}
      </View>
      <AppIconButton
        icon={completed ? "check-circle" : "checkbox-blank-circle-outline"}
        iconColor={completed ? colors.success : colors.contentSecondary}
        size={28}
        onPress={onComplete}
        disabled={completed}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed, disabled: completed }}
        accessibilityLabel={setRowLabel(setNumber, shown?.spoken, completed)}
        accessibilityHint={completed ? undefined : t`Completes the set`}
        style={styles.check}
      />
    </View>
  );
});

/** Column titles over the rows. */
export function ListSetHeader({
  trackingType,
  weightUnit,
  distanceUnit,
}: {
  trackingType: string;
  weightUnit: string;
  distanceUnit: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isWeightType =
    trackingType === "weight" || trackingType === "assisted" || !trackingType;
  return (
    <View
      style={styles.header}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <ThemedText style={[styles.headerText, styles.titleCell]}>
        <Trans>Set</Trans>
      </ThemedText>
      <ThemedText style={[styles.headerText, styles.last]}>
        <Trans>Last time</Trans>
      </ThemedText>
      <View style={styles.inputs}>
        {isWeightType && (
          <ThemedText style={[styles.headerText, styles.inputWide]}>
            {weightUnit}
          </ThemedText>
        )}
        {trackingType !== "time" && trackingType !== "distance" && (
          <ThemedText style={[styles.headerText, styles.headerInput]}>
            <Trans>Reps</Trans>
          </ThemedText>
        )}
        {trackingType === "time" && (
          <ThemedText style={[styles.headerText, styles.timeInput]}>
            <Trans>Time</Trans>
          </ThemedText>
        )}
        {trackingType === "distance" && (
          <ThemedText style={[styles.headerText, styles.inputWide]}>
            {distanceUnit}
          </ThemedText>
        )}
      </View>
      <View style={styles.check} />
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    headerText: {
      fontSize: 12,
      color: colors.contentSecondary,
      textAlign: "center",
    },
    headerInput: {
      width: 52,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      marginBottom: 6,
    },
    rowDone: {
      backgroundColor: colors.cardSecondary,
    },
    titleCell: {
      width: 64,
      gap: 2,
      alignItems: "flex-start",
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
    },
    marker: {
      paddingHorizontal: 5,
      borderRadius: radii.sm,
      maxWidth: 64,
    },
    markerText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    last: {
      flex: 1,
      fontSize: 13,
      color: colors.contentSecondary,
    },
    inputs: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    input: {
      width: 52,
      minHeight: 44,
      textAlign: "center",
      fontSize: 16,
      color: colors.contentPrimary,
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
    },
    inputWide: {
      width: 64,
    },
    timeInput: {
      width: 96,
    },
    check: {
      width: 44,
      height: 44,
      margin: 0,
    },
  });
}
