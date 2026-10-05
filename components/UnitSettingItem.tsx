import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { Trans } from "@lingui/react/macro";
import { AppIcon } from "@/components/ui/AppIcon";
import { ThemedText } from "@/components/ThemedText";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface UnitSettingItemProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  onPress: () => void;
}

/**
 * A unit setting row on the settings screen. Locked while a workout is in
 * progress: the session holds entered values in the display unit, so changing
 * the unit mid-workout would reinterpret them.
 */
export function UnitSettingItem({
  icon,
  label,
  value,
  onPress,
}: UnitSettingItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locked = useActiveWorkoutStore((s) => s.isWorkoutInProgress());

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      disabled={locked}
      style={[styles.item, locked && styles.locked]}
      onPress={onPress}
    >
      <AppIcon
        set="mci"
        name={icon}
        size={24}
        color={colors.contentSecondary}
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <ThemedText style={styles.itemText}>{label}</ThemedText>
        <ThemedText style={styles.currentSetting}>{value}</ThemedText>
        {locked && (
          <ThemedText style={styles.currentSetting}>
            <Trans>Finish or cancel your workout to change units.</Trans>
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      justifyContent: "space-between",
    },
    locked: {
      opacity: 0.6,
    },
    textContainer: {
      flex: 1,
      marginLeft: 8,
    },
    itemText: {
      fontSize: 16,
      color: colors.contentPrimary,
    },
    currentSetting: {
      fontSize: 14,
      color: colors.contentSecondary,
    },
    icon: {
      marginRight: 8,
    },
  });
}
