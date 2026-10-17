import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { useLoggingStyle } from "@/hooks/useLoggingStyle";
import { useHasCompletedWorkoutQuery } from "@/hooks/useWorkoutSummariesQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * A one-time nudge on the workout overview, from the second session on,
 * towards the list logging style. Gone once answered or once the style was
 * changed another way.
 */
export function ListViewHint() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { style, setStyle, hintSeen, dismissHint } = useLoggingStyle();
  const { data: hasCompletedWorkout } = useHasCompletedWorkoutQuery();

  if (style !== "focus" || hintSeen || hasCompletedWorkout !== true) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon
          set="mci"
          name="format-list-checks"
          size={20}
          color={colors.accent}
        />
        <ThemedText style={styles.text}>
          <Trans>
            Prefer to see all of an exercise's sets at once? Try list view.
          </Trans>
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Button mode="text" onPress={dismissHint}>
          <Trans>Keep one set at a time</Trans>
        </Button>
        <Button mode="contained" onPress={() => setStyle("list")}>
          <Trans>Try list view</Trans>
        </Button>
      </View>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: 16,
      marginBottom: 12,
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    text: {
      flex: 1,
      fontSize: 15,
      color: colors.contentPrimary,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
  });
}
