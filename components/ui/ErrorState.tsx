import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme, spacing } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { AppIcon } from "./AppIcon";

type Props = {
  // A translated, screen-specific message; defaults to a generic one.
  message?: string;
  // Usually the failed query's refetch. Leave out when retrying cannot help.
  onRetry?: () => void;
  // Hide "Go home" on the home screen itself.
  showHome?: boolean;
};

// Shown instead of a screen whose data failed to load. Never renders
// error.message: the global query cache handler already reports to Bugsnag.
export function ErrorState({ message, onRetry, showHome = true }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <AppIcon
        set="ion"
        name="alert-circle-outline"
        size={48}
        color={colors.contentSecondary}
      />
      <ThemedText style={styles.message}>
        {message ?? <Trans>Something went wrong loading this.</Trans>}
      </ThemedText>
      <View style={styles.actions}>
        {onRetry && (
          <Button mode="contained" onPress={() => onRetry()}>
            <Trans>Try again</Trans>
          </Button>
        )}
        {showHome && (
          <Button
            mode="outlined"
            onPress={() => router.replace("/(app)/(tabs)")}
          >
            <Trans>Go home</Trans>
          </Button>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
      backgroundColor: colors.background,
    },
    message: {
      textAlign: "center",
      color: colors.contentPrimary,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
    },
  });
}
