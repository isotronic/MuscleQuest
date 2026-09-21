import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Trans, Plural } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { ThemedText } from "@/components/ThemedText";
// Imported directly rather than via the barrel: the barrel also pulls in
// AppBottomSheet, dragging reanimated into anything that renders this card.
import { AppIcon } from "@/components/ui/AppIcon";
import { bodyMetricTranslations } from "@/constants/dbTranslations";
import { selectQuickLogSummary } from "@/utils/measurementQuickLog";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type {
  BodyMetricDefinition,
  BodyMeasurementSession,
} from "@/utils/database";

interface MeasurementQuickLogCardProps {
  metrics: BodyMetricDefinition[] | undefined;
  /** Sessions already carry display values, so the card needs no unit settings. */
  sessions: BodyMeasurementSession[] | undefined;
  onPress: () => void;
}

export function MeasurementQuickLogCard({
  metrics,
  sessions,
  onPress,
}: MeasurementQuickLogCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();

  const summary = useMemo(
    () => selectQuickLogSummary(metrics, sessions, new Date()),
    [metrics, sessions],
  );

  if (!summary.metric) return null;

  const metricLabel = bodyMetricTranslations[summary.metric.key]
    ? _(bodyMetricTranslations[summary.metric.key])
    : summary.metric.label;

  return (
    <Pressable
      testID="measurement-quick-log-card"
      accessibilityRole="button"
      style={[styles.card, summary.isStale ? styles.cardStale : null]}
      onPress={onPress}
    >
      <AppIcon
        set="mci"
        name="tape-measure"
        size={28}
        color={summary.isStale ? colors.accent : colors.contentSecondary}
      />
      <View style={styles.textContainer}>
        {summary.latest ? (
          <>
            <ThemedText style={styles.title}>{metricLabel}</ThemedText>
            <ThemedText style={styles.value}>
              {summary.latest.displayValue} {summary.latest.displayUnit}
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {summary.daysSinceLastLog === 0 ? (
                <Trans>Logged today</Trans>
              ) : (
                <Plural
                  value={summary.daysSinceLastLog ?? 0}
                  one="Logged 1 day ago"
                  other="Logged # days ago"
                />
              )}
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText style={styles.title}>{metricLabel}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {summary.hasAnyHistory ? (
                <Trans>Not logged yet. Tap to add today&apos;s entry.</Trans>
              ) : (
                <Trans>Track your body measurements. Tap to log.</Trans>
              )}
            </ThemedText>
          </>
        )}
      </View>
      <AppIcon
        set="mci"
        name="plus-circle-outline"
        size={24}
        color={colors.accent}
      />
    </Pressable>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      padding: 16,
    },
    cardStale: {
      borderWidth: 1,
      borderColor: colors.accent,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      color: colors.contentSecondary,
      fontSize: 13,
    },
    value: {
      color: colors.contentPrimary,
      fontSize: 20,
      fontWeight: "bold",
    },
    subtitle: {
      color: colors.contentSecondary,
      fontSize: 13,
    },
  });
}
