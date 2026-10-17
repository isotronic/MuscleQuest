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
  /** This set's note for the session. */
  note?: string;
  onEditNote?: () => void;
  /** The set's ⋮ menu. */
  menu?: React.ReactNode;
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
    note,
    onEditNote,
    menu,
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
  const trimmedNote = note?.trim() ?? "";
  const hasFlags =
    isPR || set.isWarmup || set.isDropSet || set.isToFailure || !!trimmedNote;

  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <View style={styles.titleCell}>
          <ThemedText
            style={[styles.title, completed && styles.titleDone]}
            numberOfLines={1}
          >
            {title}
          </ThemedText>
          <View
            style={styles.lastLine}
            accessible
            accessibilityLabel={last ? t`Last time: ${last.spoken}` : undefined}
          >
            <AppIcon
              set="mci"
              name="history"
              size={14}
              color={colors.contentSecondary}
            />
            <ThemedText style={styles.last} numberOfLines={1}>
              {last?.text ?? "–"}
            </ThemedText>
          </View>
        </View>
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
          // Stays enabled, so a done set keeps its green check.
          onPress={() => {
            if (!completed) onComplete();
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed, disabled: completed }}
          accessibilityLabel={setRowLabel(setNumber, shown?.spoken, completed)}
          accessibilityHint={completed ? undefined : t`Completes the set`}
          style={[styles.check, completed && styles.checkDone]}
        />
        {menu}
      </View>
      {hasFlags && (
        <View style={styles.flags}>
          {isPR && <SetTypeBadge kind="pr" />}
          {set.isWarmup && <SetTypeBadge kind="warmup" />}
          {set.isDropSet && <SetTypeBadge kind="drop" />}
          {set.isToFailure && <SetTypeBadge kind="failure" />}
          {!!trimmedNote && (
            <SetTypeBadge
              kind="note"
              onPress={onEditNote}
              accessibilityLabel={
                onEditNote
                  ? t`Set note: ${trimmedNote}. Edit`
                  : t`Set note: ${trimmedNote}`
              }
            />
          )}
        </View>
      )}
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
      <View style={styles.menuSpace} />
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
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
    rowWrap: {
      paddingVertical: 10,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.contentSecondary,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    titleCell: {
      flex: 1,
      gap: 2,
      alignItems: "flex-start",
      textAlign: "left",
    },
    lastLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    flags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
    },
    titleDone: {
      color: colors.contentSecondary,
    },
    last: {
      flexShrink: 1,
      fontSize: 13,
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
    menuSpace: {
      width: 32,
    },
  });
}
