import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useBodyMeasurementSessionsQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import { bodyMetricTranslations } from "@/constants/dbTranslations";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { WidgetSection } from "./WidgetSection";

export const MeasurementsWidget: React.FC<{
  config: WidgetConfigs["measurements"];
}> = ({ config }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const router = useRouter();
  const { weightUnit, sizeUnit } = useStatsWidgetContext();
  const latest = useBodyMeasurementSessionsQuery(
    { weightUnit: weightUnit as "kg" | "lbs", sizeUnit },
    1,
  );
  const openMeasurements = () =>
    router.push("/(app)/(tabs)/(stats)/measurements" as never);

  const values = (latest.data?.[0]?.values ?? []).filter(
    (v) =>
      config.metricKeys.length === 0 ||
      config.metricKeys.includes(v.metric.key),
  );

  return (
    <WidgetSection
      title={t`Body Measurements`}
      loading={latest.isLoading}
      error={!!latest.error}
      actions={
        <Button
          mode="text"
          compact
          labelStyle={{ color: colors.accent, fontSize: 13 }}
          onPress={openMeasurements}
        >
          <Trans>View All</Trans>
        </Button>
      }
    >
      {latest.data && latest.data.length > 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.tile}
          activeOpacity={0.7}
          onPress={openMeasurements}
        >
          {values.length > 0 ? (
            <View style={styles.grid}>
              {values.map((v) => (
                <ThemedText key={v.metric.id} style={styles.value}>
                  {bodyMetricTranslations[v.metric.key]
                    ? _(bodyMetricTranslations[v.metric.key])
                    : v.metric.label}
                  {": "}
                  {v.displayValue} {v.displayUnit}
                </ThemedText>
              ))}
            </View>
          ) : (
            <ThemedText style={styles.empty}>
              <Trans>
                The latest entry has none of the measurements chosen for this
                section.
              </Trans>
            </ThemedText>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={openMeasurements}
        >
          <ThemedText style={{ color: colors.contentSecondary }}>
            <Trans>No measurements yet. Tap to log your first entry.</Trans>
          </ThemedText>
        </TouchableOpacity>
      )}
    </WidgetSection>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    tile: {
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: colors.card,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    empty: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    value: {
      width: "50%",
      fontSize: 13,
      lineHeight: 19,
      color: colors.contentSecondary,
    },
  });
}
