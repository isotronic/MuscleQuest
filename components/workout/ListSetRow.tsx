import React, { forwardRef, useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
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
import { SetTypeBadge } from "@/components/workout/SetTypeBadge";
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

const isWeightType = (trackingType: string) =>
  trackingType === "weight" || trackingType === "assisted" || !trackingType;

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
  const weighted = isWeightType(trackingType);
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
  const inputStyle = [styles.input, completed && styles.inputDone];

  return (
    <View style={styles.row}>
      <View style={styles.titleCell}>
        <ThemedText
          style={[styles.title, completed && styles.titleDone]}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
        <View style={styles.badges}>
          {isPR && <SetTypeBadge kind="pr" compact />}
          {set.isWarmup && <SetTypeBadge kind="warmup" compact />}
          {set.isDropSet && <SetTypeBadge kind="drop" compact />}
          {set.isToFailure && <SetTypeBadge kind="failure" compact />}
        </View>
      </View>
      <ThemedText
        style={styles.last}
        numberOfLines={2}
        accessibilityLabel={last ? t`Last time: ${last.spoken}` : undefined}
      >
        {last?.text ?? "–"}
      </ThemedText>
      <View style={styles.inputs}>
        {weighted && (
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
            submitBehavior="submit"
            style={[inputStyle, styles.inputWide]}
          />
        )}
        {hasReps && (
          <TextInput
            ref={weighted ? repsRef : firstInputRef}
            value={values.reps}
            onChangeText={(text) =>
              onChange("reps", sanitizeIntegerInput(text))
            }
            keyboardType="numeric"
            accessibilityLabel={t`Reps, set ${setNumber}`}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={onSubmitLast}
            style={inputStyle}
          />
        )}
        {trackingType === "time" && (
          <TimeInput
            ref={firstInputRef}
            onSubmitEditing={onSubmitLast}
            value={formatTimeInput(values.time)}
            onChange={(v) => onChange("time", v.replace(/[^0-9]/g, ""))}
            accessibilityLabel={t`Time, set ${setNumber}`}
            style={[inputStyle, styles.timeInput]}
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
            style={[inputStyle, styles.inputWide]}
          />
        )}
      </View>
      <AppIconButton
        icon="check"
        mode={completed ? "contained" : "outlined"}
        containerColor={completed ? colors.success : undefined}
        iconColor={completed ? colors.onAccent : colors.accent}
        size={22}
        onPress={onComplete}
        disabled={completed}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed, disabled: completed }}
        accessibilityLabel={setRowLabel(setNumber, shown?.spoken, completed)}
        accessibilityHint={completed ? undefined : t`Completes the set`}
        style={[styles.check, completed && styles.checkDone]}
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
  return (
    <View
      style={styles.header}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <ThemedText style={[styles.label, styles.titleCell]}>
        <Trans>Set</Trans>
      </ThemedText>
      <ThemedText style={[styles.label, styles.last]}>
        <Trans>Last time</Trans>
      </ThemedText>
      <View style={styles.inputs}>
        {isWeightType(trackingType) && (
          <ThemedText style={[styles.label, styles.labelWide]}>
            {weightUnit}
          </ThemedText>
        )}
        {trackingType !== "time" && trackingType !== "distance" && (
          <ThemedText style={[styles.label, styles.labelInput]}>
            <Trans>Reps</Trans>
          </ThemedText>
        )}
        {trackingType === "time" && (
          <ThemedText style={[styles.label, styles.timeInput]}>
            <Trans>Time</Trans>
          </ThemedText>
        )}
        {trackingType === "distance" && (
          <ThemedText style={[styles.label, styles.labelWide]}>
            {distanceUnit}
          </ThemedText>
        )}
      </View>
      <View style={styles.checkSpace} />
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingBottom: 6,
    },
    label: {
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    labelInput: {
      width: 56,
    },
    labelWide: {
      width: 72,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.contentSecondary,
    },
    titleCell: {
      width: 64,
      gap: 4,
      alignItems: "flex-start",
      textAlign: "left",
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
    },
    titleDone: {
      color: colors.contentSecondary,
    },
    badges: {
      flexDirection: "row",
      gap: 4,
    },
    last: {
      flex: 1,
      fontSize: 14,
      color: colors.contentSecondary,
    },
    inputs: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    input: {
      width: 56,
      minHeight: 48,
      paddingHorizontal: 4,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      textAlign: "center",
      fontSize: 20,
      color: colors.contentPrimary,
    },
    inputDone: {
      color: colors.contentSecondary,
    },
    inputWide: {
      width: 72,
    },
    timeInput: {
      width: 104,
    },
    check: {
      margin: 0,
      borderColor: colors.accent,
    },
    checkDone: {
      borderColor: colors.success,
    },
    checkSpace: {
      width: 44,
    },
  });
}
