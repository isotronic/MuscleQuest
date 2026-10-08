import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface WidgetSectionProps {
  title: string;
  /** Buttons beside the title. */
  actions?: React.ReactNode;
  /** A pinned time range, shown beside the title so it is not mistaken for the screen's. */
  rangeBadge?: string | null;
  loading?: boolean;
  error?: boolean;
  children?: React.ReactNode;
}

/** The heading and spacing every stats widget shares. */
export const WidgetSection: React.FC<WidgetSectionProps> = ({
  title,
  actions,
  rangeBadge,
  loading,
  error,
  children,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {rangeBadge ? (
            <ThemedText style={styles.badge}>{rangeBadge}</ThemedText>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : error ? (
        <ThemedText style={styles.muted}>
          <Trans>Could not load this section. Pull down to try again.</Trans>
        </ThemedText>
      ) : (
        children
      )}
    </View>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 28,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 32,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: "bold",
      flexShrink: 1,
    },
    badge: {
      fontSize: 11,
      color: colors.contentSecondary,
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      borderRadius: 8,
      paddingHorizontal: 6,
      lineHeight: 16,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
    },
    loading: {
      marginVertical: 24,
    },
    muted: {
      color: colors.contentSecondary,
    },
  });
}
