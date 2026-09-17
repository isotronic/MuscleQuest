import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import { ProgressionAction } from "@/types/progression";
import { t } from "@lingui/core/macro";
import { suggestedWeightForDisplay } from "@/utils/weightUnits";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { parsePlateInventory, smallestLoadStep } from "@/utils/plateCalculator";

interface ProgressionSuggestionChipProps {
  action: ProgressionAction;
  suggestedWeight?: number;
  suggestedRepsPerSet?: number[];
  // Required so every call site states the unit; suggestedWeight is kg.
  weightUnit: string;
  onPress?: () => void;
}

function chipLabel(
  action: ProgressionAction,
  suggestedWeight: number | undefined,
  suggestedRepsPerSet: number[] | undefined,
  unit: string,
  lbsStep: number | null,
): string | null {
  // Suggestions are computed in kg; show them in the user's unit, rounded the
  // same way as the weight they pre-fill. The expression stays inline so the
  // catalog placeholder remains {0}.
  switch (action) {
    case "increase_load":
      return suggestedWeight != null
        ? t`${suggestedWeightForDisplay(suggestedWeight, unit, lbsStep)}${unit} suggested`
        : t`Load up`;
    case "increase_reps": {
      if (suggestedRepsPerSet && suggestedRepsPerSet.length > 0) {
        const joined = suggestedRepsPerSet.join(", ");
        return t`Try: ${joined} reps`;
      }
      return t`More reps suggested`;
    }
    case "reduce_load":
      return suggestedWeight != null
        ? t`Reduce to ${suggestedWeightForDisplay(suggestedWeight, unit, lbsStep)}${unit}`
        : t`Reduce load`;
    case "add_set":
      return t`Add a set`;
    case "remove_set":
      return t`Remove a set`;
    case "hold":
    default:
      return null;
  }
}

export default function ProgressionSuggestionChip({
  action,
  suggestedWeight,
  suggestedRepsPerSet,
  weightUnit,
  onPress,
}: ProgressionSuggestionChipProps) {
  const { colors } = useAppTheme();
  const { data: settings } = useSettingsQuery();
  const lbsStep = useMemo(
    () =>
      smallestLoadStep(parsePlateInventory(settings?.plateInventoryLbs, "lbs")),
    [settings?.plateInventoryLbs],
  );
  const label = chipLabel(
    action,
    suggestedWeight,
    suggestedRepsPerSet,
    weightUnit,
    lbsStep,
  );

  if (!label) return null;

  const isPositive =
    action === "increase_load" ||
    action === "increase_reps" ||
    action === "add_set";
  const backgroundColor = isPositive ? colors.accentSubtle : colors.dangerMuted;
  const textColor = isPositive ? colors.accent : colors.danger;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View style={[styles.chip, { backgroundColor }]}>
        <ThemedText style={[styles.label, { color: textColor }]}>
          {label}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
