import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const RANGES = [
  { label: msg`30d`, value: "30" },
  { label: msg`90d`, value: "90" },
  { label: msg`1yr`, value: "365" },
  { label: msg`All Time`, value: "0" },
];

interface TimeRangeSelectorProps {
  selected: string;
  onChange: (value: string) => void;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selected,
  onChange,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  return (
    <View style={styles.row}>
      {RANGES.map((r) => {
        const active = selected === r.value;
        return (
          <TouchableOpacity
            key={r.value}
            onPress={() => onChange(r.value)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.label, active && styles.labelActive]}>
              {_(r.label)}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 8,
    },
    pill: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radii.full,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    pillActive: {
      backgroundColor: colors.accentSubtle,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    label: {
      fontSize: 12,
      color: colors.contentSecondary,
      fontWeight: "600",
    },
    labelActive: {
      color: colors.accent,
    },
  });
}
