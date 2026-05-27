import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t, plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ActivityIndicator, Button, Divider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useActiveBodyMetricDefinitionsQuery } from "@/hooks/useBodyMetricDefinitionsQuery";
import { useBodyMeasurementSessionsQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import { useInsertBodyMeasurementMutation } from "@/hooks/useBodyMeasurementMutations";
import { BodyMeasurementSession } from "@/utils/database";
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

function formatEntryDate(recorded_at: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDbDate(recorded_at));
}

function formatHistoryDate(recorded_at: string): string {
  const date = parseDbDate(recorded_at);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function latestValueForMetric(
  sessions: BodyMeasurementSession[],
  metricId: number,
): number | undefined {
  for (const s of sessions) {
    const v = s.values.find((v) => v.metric.id === metricId);
    if (v !== undefined) return v.displayValue;
  }
  return undefined;
}

export default function MeasurementsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const router = useRouter();
  const { data: settings } = useSettingsQuery();
  const weightUnit = (settings?.weightUnit || "kg") as "kg" | "lbs";
  const sizeUnit = (settings?.sizeUnit || "cm") as "cm" | "in";
  const displayOptions = { weightUnit, sizeUnit };

  const { data: metrics, isLoading: metricsLoading } =
    useActiveBodyMetricDefinitionsQuery();
  const { data: sessions, isLoading: sessionsLoading } =
    useBodyMeasurementSessionsQuery(displayOptions, 20);
  const insertMutation = useInsertBodyMeasurementMutation(displayOptions);

  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [entryDate, setEntryDate] = useState(new Date().toISOString());
  const [calendarVisible, setCalendarVisible] = useState(false);
  // Skip one repopulation after the form is deliberately cleared on success
  const skipPopulateRef = useRef(false);

  // Pre-fill with most recent values for each metric
  useEffect(() => {
    if (!metrics || !sessions) return;
    if (skipPopulateRef.current) {
      skipPopulateRef.current = false;
      return;
    }
    setInputValues((prev) => {
      const next: Record<number, string> = {};
      for (const metric of metrics) {
        if (prev[metric.id] !== undefined) {
          next[metric.id] = prev[metric.id];
        } else {
          const latest = latestValueForMetric(sessions, metric.id);
          next[metric.id] =
            latest !== undefined
              ? String(latest).replace(".", DECIMAL_SEP)
              : "";
        }
      }
      return next;
    });
  }, [metrics, sessions]);

  const handleLogEntry = useCallback(() => {
    if (!metrics) return;
    const values = metrics
      .filter((m) => {
        const v = parseFloat((inputValues[m.id] ?? "").replace(",", "."));
        return !isNaN(v);
      })
      .map((m) => ({
        metric_id: m.id,
        value_kind: m.value_kind,
        displayValue: parseFloat((inputValues[m.id] ?? "").replace(",", ".")),
      }));

    if (values.length === 0) {
      Alert.alert(
        t`No values entered`,
        t`Enter at least one measurement to log.`,
      );
      return;
    }

    insertMutation.mutate(
      { recorded_at: entryDate, values },
      {
        onSuccess: () => {
          skipPopulateRef.current = true;
          setInputValues({});
          setEntryDate(new Date().toISOString());
        },
      },
    );
  }, [metrics, inputValues, entryDate, insertMutation]);

  const handleDayPress = useCallback((day: { dateString: string }) => {
    const d = new Date(day.dateString + "T12:00:00.000");
    setEntryDate(d.toISOString());
    setCalendarVisible(false);
  }, []);

  const isLoading = metricsLoading || sessionsLoading;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Entry form */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              <Trans>Log Entry</Trans>
            </ThemedText>
            <Button
              mode="text"
              compact
              labelStyle={{ color: colors.accent, fontSize: 13 }}
              onPress={() =>
                router.push(
                  "/(app)/(tabs)/(stats)/measurements-manage" as never,
                )
              }
            >
              <Trans>Manage metrics</Trans>
            </Button>
          </View>

          {/* Date row */}
          <TouchableOpacity
            style={styles.dateRow}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="calendar"
              size={18}
              color={colors.accent}
            />
            <ThemedText style={styles.dateText}>
              {formatEntryDate(entryDate)}
            </ThemedText>
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color={colors.contentSecondary}
            />
          </TouchableOpacity>

          {isLoading && <ActivityIndicator color={colors.contentPrimary} />}

          {/* Metric inputs */}
          {metrics?.map((metric) => (
            <View key={metric.id} style={styles.metricRow}>
              <ThemedText style={styles.metricLabel}>
                {bodyMetricTranslations[metric.key]
                  ? _(bodyMetricTranslations[metric.key])
                  : metric.label}
              </ThemedText>
              <View style={styles.metricInputWrap}>
                <TextInput
                  style={styles.metricInput}
                  value={inputValues[metric.id] ?? ""}
                  onChangeText={(text: string) =>
                    setInputValues((prev) => ({ ...prev, [metric.id]: text }))
                  }
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={colors.contentSecondary}
                  returnKeyType="done"
                />
                <ThemedText style={styles.metricUnit}>
                  {metric.value_kind === "mass"
                    ? weightUnit
                    : metric.value_kind === "percent"
                      ? "%"
                      : sizeUnit}
                </ThemedText>
              </View>
            </View>
          ))}

          <Button
            mode="contained"
            style={styles.logButton}
            buttonColor={colors.accent}
            textColor={colors.background}
            loading={insertMutation.isPending}
            disabled={insertMutation.isPending}
            onPress={handleLogEntry}
          >
            <Trans>Log Entry</Trans>
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Session history */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            <Trans>History</Trans>
          </ThemedText>
          {sessionsLoading && (
            <ActivityIndicator color={colors.contentPrimary} />
          )}
          {!sessionsLoading && (sessions?.length ?? 0) === 0 && (
            <ThemedText style={styles.empty}>
              <Trans>No measurements yet. Log your first entry above.</Trans>
            </ThemedText>
          )}
          {sessions?.map((session) => (
            <TouchableOpacity
              key={session.entry.id}
              style={styles.sessionRow}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  `/(app)/(tabs)/(stats)/measurements-detail?entryId=${session.entry.id}` as never,
                )
              }
            >
              <View style={styles.sessionContent}>
                <ThemedText style={styles.sessionDate}>
                  {formatHistoryDate(session.entry.recorded_at)}
                </ThemedText>
                <View style={styles.sessionValues}>
                  {session.values.slice(0, 3).map((v) => {
                    const label = bodyMetricTranslations[v.metric.key]
                      ? _(bodyMetricTranslations[v.metric.key])
                      : v.metric.label;
                    return (
                      <ThemedText key={v.metric.id} style={styles.sessionValue}>
                        {label}: {v.displayValue} {v.displayUnit}
                      </ThemedText>
                    );
                  })}
                  {session.values.length > 3 && (
                    <ThemedText style={styles.sessionMore}>
                      {plural(session.values.length - 3, {
                        one: "+# more",
                        other: "+# more",
                      })}
                    </ThemedText>
                  )}
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Date picker modal */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCalendarVisible(false)}
        >
          <View style={styles.calendarCard}>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={{
                [format(parseDbDate(entryDate), "yyyy-MM-dd")]: {
                  selected: true,
                  selectedColor: colors.accent,
                },
              }}
              theme={{
                backgroundColor: colors.card,
                calendarBackground: colors.card,
                dayTextColor: colors.contentPrimary,
                textDisabledColor: colors.contentSecondary,
                monthTextColor: colors.contentPrimary,
                arrowColor: colors.accent,
                todayTextColor: colors.accent,
                selectedDayBackgroundColor: colors.accent,
                selectedDayTextColor: colors.background,
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "bold",
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      marginBottom: 12,
    },
    dateText: {
      fontSize: 15,
      flex: 1,
      color: colors.contentPrimary,
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
    logButton: {
      marginTop: 16,
      borderRadius: radii.md,
    },
    divider: {
      marginBottom: 24,
    },
    empty: {
      color: colors.contentSecondary,
      fontSize: 14,
    },
    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.contentSecondary + "40",
    },
    sessionContent: {
      flex: 1,
      gap: 4,
    },
    sessionDate: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    sessionValues: {
      gap: 0,
    },
    sessionValue: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.contentSecondary,
    },
    sessionMore: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.accent,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    calendarCard: {
      borderRadius: radii.lg,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
  });
}
