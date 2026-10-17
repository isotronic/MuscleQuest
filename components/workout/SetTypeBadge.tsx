import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export type SetBadgeKind = "pr" | "warmup" | "drop" | "failure";

/** A set's type or PR, as the coloured badges on the focus screen. */
export function SetTypeBadge({
  kind,
  compact = false,
}: {
  kind: SetBadgeKind;
  /** Icon only, for tight rows; the label is still spoken. */
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const specs: Record<
    SetBadgeKind,
    {
      icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
      bg: string;
      fg: string;
      label: React.ReactNode;
      spoken: string;
    }
  > = {
    pr: {
      icon: "trophy",
      bg: colors.accent,
      fg: colors.onAccent,
      label: <Trans>PR</Trans>,
      spoken: t`Personal record`,
    },
    warmup: {
      icon: "speedometer-slow",
      bg: colors.badgeWarmup,
      fg: colors.contentPrimary,
      label: <Trans>Warm-up</Trans>,
      spoken: t`Warm-up set`,
    },
    drop: {
      icon: "arrow-down-bold",
      bg: colors.badgeDrop,
      fg: colors.contentPrimary,
      label: <Trans>Drop Set</Trans>,
      spoken: t`Drop set`,
    },
    failure: {
      icon: "fire",
      bg: colors.badgeFailure,
      fg: colors.contentPrimary,
      label: <Trans>To Failure</Trans>,
      spoken: t`To failure`,
    },
  };
  const spec = specs[kind];

  return (
    <View
      style={[
        styles.badge,
        compact && styles.compact,
        { backgroundColor: spec.bg },
      ]}
      accessible={true}
      accessibilityLabel={spec.spoken}
      accessibilityRole="text"
    >
      <AppIcon
        set="mci"
        name={spec.icon}
        size={compact ? 14 : 16}
        color={spec.fg}
        style={compact ? undefined : styles.icon}
      />
      {!compact && (
        <ThemedText style={[styles.label, { color: spec.fg }]}>
          {spec.label}
        </ThemedText>
      )}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.md,
    },
    compact: {
      paddingHorizontal: 5,
      paddingVertical: 3,
    },
    icon: {
      marginRight: 4,
    },
    label: {
      fontSize: 13,
      color: colors.contentPrimary,
      fontWeight: "600",
    },
  });
}
