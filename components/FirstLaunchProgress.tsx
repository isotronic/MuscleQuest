import React from "react";
import { StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import type { StartupProgress } from "@/utils/startup";

/** Determinate progress for the one-time library and plan setup. */
export function FirstLaunchProgress({
  progress,
}: {
  progress: StartupProgress;
}) {
  const { colors } = useAppTheme();
  const { stage, done, total } = progress;
  const fraction = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.stage}>
        {stage === "exercises" ? (
          <Trans>
            Setting up your exercise library ({done} of {total})
          </Trans>
        ) : (
          <Trans>Adding ready-made training plans</Trans>
        )}
      </ThemedText>
      <View
        style={[styles.track, { backgroundColor: colors.accentSubtle }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
      >
        <View
          style={[
            styles.fill,
            { width: `${fraction * 100}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>
      <ThemedText style={styles.note}>
        <Trans>This only happens once.</Trans>
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "80%", maxWidth: 360, alignItems: "center", gap: 12 },
  stage: { textAlign: "center" },
  track: {
    alignSelf: "stretch",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
  note: { fontSize: 13, opacity: 0.7, textAlign: "center" },
});
