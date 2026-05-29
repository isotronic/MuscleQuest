import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import { ProgressionAction } from "@/types/progression";
import { t } from "@lingui/core/macro";

interface ProgressionSuggestionChipProps {
  action: ProgressionAction;
  suggestedWeight?: number;
  suggestedRepsMin?: number;
  suggestedRepsMax?: number;
  weightUnit?: string;
  onPress?: () => void;
}

function chipLabel(
  action: ProgressionAction,
  suggestedWeight?: number,
  suggestedRepsMin?: number,
  suggestedRepsMax?: number,
  weightUnit?: string,
): string | null {
  const unit = weightUnit ?? "kg";
  switch (action) {
    case "increase_load":
      return suggestedWeight != null ? t`+${unit} suggested` : t`Load up`;
    case "increase_reps":
      if (suggestedRepsMin != null && suggestedRepsMax != null) {
        return suggestedRepsMin === suggestedRepsMax
          ? t`${suggestedRepsMin} reps suggested`
          : t`${suggestedRepsMin}-${suggestedRepsMax} reps suggested`;
      }
      return t`More reps suggested`;
    case "reduce_load":
      return t`Reduce load`;
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
  suggestedRepsMin,
  suggestedRepsMax,
  weightUnit,
  onPress,
}: ProgressionSuggestionChipProps) {
  const { colors } = useAppTheme();
  const label = chipLabel(
    action,
    suggestedWeight,
    suggestedRepsMin,
    suggestedRepsMax,
    weightUnit,
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
