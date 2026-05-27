import { useState, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ActivityIndicator, Button, Card } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TimeRangeSelector } from "@/components/stats/TimeRangeSelector";
import { BodyMeasurementLineChart } from "@/components/charts/BodyMeasurementLineChart";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useBodyMeasurementSessionsQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import { useBodyMeasurementChartQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import {
  useUpdateBodyMeasurementMutation,
  useDeleteBodyMeasurementMutation,
} from "@/hooks/useBodyMeasurementMutations";
import { BodyMetricDefinition } from "@/utils/database";
import { bodyMetricTranslations } from "@/constants/dbTranslations";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const DECIMAL_SEP =
  new Intl.NumberFormat().formatToParts(1.1).find((p) => p.type === "decimal")
    ?.value ?? ".";

function parseDbDate(recorded_at: string): Date {
  return new Date(
    recorded_at.includes("T") ? recorded_at : recorded_at.replace(" ", "T"),
  );
}

export default function MeasurementDetailScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();

  const { data: settings } = useSettingsQuery();
  const weightUnit = (settings?.weightUnit || "kg") as "kg" | "lbs";
  const sizeUnit = (settings?.sizeUnit || "cm") as "cm" | "in";
  const displayOptions = { weightUnit, sizeUnit };

  const { data: sessions, isLoading } =
    useBodyMeasurementSessionsQuery(displayOptions);
  const updateMutation = useUpdateBodyMeasurementMutation(displayOptions);
  const deleteMutation = useDeleteBodyMeasurementMutation();

  const session = useMemo(
    () => sessions?.find((s) => s.entry.id === Number(entryId)),
    [sessions, entryId],
  );

  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [timeRange, setTimeRange] = useState("30");
  const [selectedMetric, setSelectedMetric] =
    useState<BodyMetricDefinition | null>(null);

  const [initialised, setInitialised] = useState(false);

  // Reset the initialised flag whenever the viewed entry changes
  useEffect(() => {
    setInitialised(false);
  }, [entryId]);

  // Initialise inputs from session values (once per entry)
  useEffect(() => {
    if (session && !initialised) {
      const initial: Record<number, string> = {};
      for (const v of session.values) {
        initial[v.metric.id] = String(v.displayValue).replace(".", DECIMAL_SEP);
      }
      setInputValues(initial);
      setSelectedMetric(session.values[0]?.metric ?? null);
      setInitialised(true);
    }
  }, [session, entryId, initialised]);

  const { data: chartData } = useBodyMeasurementChartQuery(
    selectedMetric?.id ?? 0,
    displayOptions,
  );

  const handleSave = () => {
    if (!session) return;
    const values = session.values
      .map((v) => ({
        metric_id: v.metric.id,
        value_kind: v.metric.value_kind,
        displayValue: parseFloat(
          (inputValues[v.metric.id] ?? "").replace(",", "."),
        ),
      }))
      .filter((v) => !isNaN(v.displayValue));

    if (values.length === 0) return;

    updateMutation.mutate(
      { entry_id: session.entry.id, values },
      { onSuccess: () => router.back() },
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t`Delete Entry`,
      t`Are you sure you want to delete this measurement entry?`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(Number(entryId), {
              onSuccess: () => router.back(),
            });
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  if (!session) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>
          <Trans>Entry not found.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  const entryDate = parseDbDate(session.entry.recorded_at);
  const entryDateStr = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(entryDate);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.dateHeader}>{entryDateStr}</ThemedText>

        {/* Editable metric values */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            <Trans>Values</Trans>
          </ThemedText>
          {session.values.map((v) => (
            <View key={v.metric.id} style={styles.metricRow}>
              <ThemedText style={styles.metricLabel}>
                {bodyMetricTranslations[v.metric.key]
                  ? _(bodyMetricTranslations[v.metric.key])
                  : v.metric.label}
              </ThemedText>
              <View style={styles.metricInputWrap}>
                <TextInput
                  style={styles.metricInput}
                  value={inputValues[v.metric.id] ?? ""}
                  onChangeText={(text: string) =>
                    setInputValues((prev) => ({ ...prev, [v.metric.id]: text }))
                  }
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <ThemedText style={styles.metricUnit}>
                  {v.displayUnit}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        {/* Chart section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            <Trans>History</Trans>
          </ThemedText>

          {/* Metric selector chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {session.values.map((v) => {
              const active = selectedMetric?.id === v.metric.id;
              return (
                <TouchableOpacity
                  key={v.metric.id}
                  onPress={() => setSelectedMetric(v.metric)}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.7}
                >
                  <ThemedText
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {bodyMetricTranslations[v.metric.key]
                      ? _(bodyMetricTranslations[v.metric.key])
                      : v.metric.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />

          {selectedMetric && (
            <Card style={styles.chartCard}>
              <BodyMeasurementLineChart
                data={chartData ?? []}
                timeRange={timeRange}
                unit={
                  selectedMetric.value_kind === "mass"
                    ? weightUnit
                    : selectedMetric.value_kind === "percent"
                      ? "%"
                      : sizeUnit
                }
                metricLabel={
                  bodyMetricTranslations[selectedMetric.key]
                    ? _(bodyMetricTranslations[selectedMetric.key])
                    : selectedMetric.label
                }
              />
            </Card>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            buttonColor={colors.accent}
            textColor={colors.background}
            style={{ flex: 1 }}
            loading={updateMutation.isPending}
            disabled={updateMutation.isPending || deleteMutation.isPending}
            onPress={handleSave}
          >
            <Trans>Save Changes</Trans>
          </Button>
          <Button
            mode="outlined"
            textColor={colors.danger}
            style={[styles.deleteButton, { flex: 1 }]}
            loading={deleteMutation.isPending}
            disabled={updateMutation.isPending || deleteMutation.isPending}
            onPress={handleDelete}
          >
            <Trans>Delete Entry</Trans>
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    dateHeader: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "bold",
      marginBottom: 12,
    },
    metricRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.contentSecondary + "40",
    },
    metricLabel: {
      flex: 1,
      fontSize: 15,
    },
    metricInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metricInput: {
      width: 80,
      textAlign: "right",
      fontSize: 15,
      color: colors.contentPrimary,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radii.md,
      backgroundColor: colors.card,
    },
    metricUnit: {
      fontSize: 13,
      color: colors.contentSecondary,
      width: 28,
    },
    chipScroll: {
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.card,
      marginRight: 8,
    },
    chipActive: {
      backgroundColor: colors.accent + "25",
      borderWidth: 1,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: 12,
      color: colors.contentSecondary,
      fontWeight: "600",
    },
    chipTextActive: {
      color: colors.accent,
    },
    chartCard: {
      padding: 16,
      backgroundColor: colors.card,
      marginTop: 8,
    },
    actions: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 32,
    },
    deleteButton: {
      borderColor: colors.danger + "80",
    },
  });
}
