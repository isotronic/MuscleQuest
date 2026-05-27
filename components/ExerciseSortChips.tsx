import React, { useMemo } from "react";
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { t } from "@lingui/core/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export type SortMode = "default" | "activePlan" | "recent" | "frequent";

interface ExerciseSortChipsProps {
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

export default function ExerciseSortChips({
  sortMode,
  onSortModeChange,
}: ExerciseSortChipsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chips: { mode: SortMode; label: string }[] = [
    { mode: "default", label: t`Default` },
    { mode: "activePlan", label: t`Active Plan` },
    { mode: "recent", label: t`Recent` },
    { mode: "frequent", label: t`Frequent` },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map(({ mode, label }) => (
          <TouchableOpacity
            key={mode}
            style={[styles.chip, sortMode === mode && styles.chipActive]}
            onPress={() => onSortModeChange(mode)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                sortMode === mode && styles.chipTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      paddingBottom: 8,
    },
    scrollContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    chip: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    chipActive: {
      backgroundColor: colors.accent,
    },
    chipText: {
      color: colors.contentPrimary,
      fontSize: 13,
      fontWeight: "500",
    },
    chipTextActive: {
      color: colors.background,
      fontWeight: "700",
    },
  });
}
