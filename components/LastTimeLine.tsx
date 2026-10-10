import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { t, plural } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { formatNumber } from "@/utils/numberFormat";
import { formatFromTotalSeconds } from "@/utils/utility";
import { localDateKeyToDate } from "@/utils/dates";

/** The matching set from history, in display units. */
export interface PreviousSet {
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  /** The training day it was logged on, "YYYY-MM-DD". */
  localDate?: string;
}

interface LastTimeLineProps {
  previous: PreviousSet;
  trackingType: string;
  weightUnit: string;
  distanceUnit: string;
  /** A progression suggestion's prefilled weight for this set. */
  suggestedWeight?: number;
  /** Copies the values into the inputs. Read-only when absent. */
  onPress?: () => void;
}

const isWeightType = (trackingType: string) =>
  trackingType === "weight" || trackingType === "assisted" || !trackingType;

/**
 * What the set was last time, as shown and as spoken, or null when history
 * has nothing to show for this tracking type.
 */
function describePreviousSet(
  previous: PreviousSet,
  trackingType: string,
  weightUnit: string,
  distanceUnit: string,
): { text: string; spoken: string } | null {
  const { weight, reps, time, distance } = previous;
  switch (trackingType) {
    case "reps":
      if (reps == null) return null;
      return {
        text: plural(reps, { one: "# rep", other: "# reps" }),
        spoken: plural(reps, { one: "# rep", other: "# reps" }),
      };
    case "time": {
      if (time == null) return null;
      const formatted = formatFromTotalSeconds(time);
      return { text: formatted, spoken: formatted };
    }
    case "distance": {
      if (distance == null) return null;
      const value = formatNumber(distance, 2);
      return {
        text: `${value} ${distanceUnit}`,
        spoken: `${value} ${distanceUnit}`,
      };
    }
    default: {
      if (weight == null || reps == null) return null;
      const value = formatNumber(weight, 2);
      const spokenWeight =
        weightUnit === "lbs" ? t`${value} pounds` : t`${value} kilograms`;
      const spokenReps = plural(reps, { one: "# rep", other: "# reps" });
      return trackingType === "assisted"
        ? {
            text: t`${value} ${weightUnit} assist × ${reps}`,
            spoken: t`${spokenWeight} assistance, ${spokenReps}`,
          }
        : {
            text: `${value} ${weightUnit} × ${reps}`,
            spoken: `${spokenWeight}, ${spokenReps}`,
          };
    }
  }
}

/** A short date such as "12 Sep", in the device's order. */
const shortDay = (localDate: string) =>
  localDateKeyToDate(localDate).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export default function LastTimeLine({
  previous,
  trackingType,
  weightUnit,
  distanceUnit,
  suggestedWeight,
  onPress,
}: LastTimeLineProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const described = describePreviousSet(
    previous,
    trackingType,
    weightUnit,
    distanceUnit,
  );
  if (!described) return null;

  const value = described.text;
  const day = previous.localDate ? shortDay(previous.localDate) : null;
  let text: string;
  if (suggestedWeight != null && isWeightType(trackingType)) {
    const suggested = formatNumber(suggestedWeight, 2);
    text = day
      ? t`Last: ${value} (${day}) · Suggested: ${suggested} ${weightUnit}`
      : t`Last: ${value} · Suggested: ${suggested} ${weightUnit}`;
  } else if (day) {
    text = t`Last time: ${value} (${day})`;
  } else {
    text = t`Last time: ${value}`;
  }

  const line = (
    <ThemedText style={styles.text} numberOfLines={2}>
      {text}
    </ThemedText>
  );
  if (!onPress) return line;

  const spoken = described.spoken;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t`Use last time's values: ${spoken}`}
      hitSlop={{ top: 8, bottom: 8 }}
      style={styles.touchable}
    >
      {line}
    </TouchableOpacity>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    touchable: {
      alignSelf: "center",
    },
    text: {
      fontSize: 14,
      color: colors.contentSecondary,
      textAlign: "center",
    },
  });
}
