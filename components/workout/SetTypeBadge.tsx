import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export type SetBadgeKind = "pr" | "warmup" | "drop" | "failure" | "note";

/** A set's type or PR, as the coloured badges on the focus screen. */
export function SetTypeBadge({
  kind,
  small = false,
  onPress,
  accessibilityLabel,
}: {
  kind: SetBadgeKind;
  /** A smaller badge, for rows of sets. */
  small?: boolean;
  /** Makes the badge a button, e.g. a note that opens for editing. */
  onPress?: () => void;
  /** Replaces the spoken label, e.g. to read out the note. */
  accessibilityLabel?: string;
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
    note: {
      icon: "note-text-outline",
      bg: colors.surfaceHighlight,
      fg: colors.contentPrimary,
      label: <Trans>Note</Trans>,
      spoken: t`Set note`,
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

  const content = (
    <>
      <AppIcon
        set="mci"
        name={spec.icon}
        size={small ? 12 : 16}
        color={spec.fg}
        style={small ? styles.iconSmall : styles.icon}
      />
      <ThemedText
        style={[styles.label, small && styles.labelSmall, { color: spec.fg }]}
      >
        {spec.label}
      </ThemedText>
    </>
  );
  const style = [
    styles.badge,
    small && styles.small,
    { backgroundColor: spec.bg },
  ];
  const label = accessibilityLabel ?? spec.spoken;

  if (onPress) {
    return (
      <TouchableOpacity
        style={style}
        onPress={onPress}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View
      style={style}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="text"
    >
      {content}
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
    small: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    iconSmall: {
      marginRight: 3,
    },
    labelSmall: {
      fontSize: 11,
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
