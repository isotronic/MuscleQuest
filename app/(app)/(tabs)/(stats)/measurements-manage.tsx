import React, { useState } from "react";
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
import { ActivityIndicator, Button, Switch } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useAllBodyMetricDefinitionsQuery } from "@/hooks/useBodyMetricDefinitionsQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import {
  useToggleBodyMetricActiveMutation,
  useInsertCustomBodyMetricMutation,
  useSoftDeleteCustomBodyMetricMutation,
} from "@/hooks/useBodyMetricMutations";
import { type ValueKind } from "@/utils/measurementConversions";

const VALUE_KINDS: ValueKind[] = ["mass", "length", "percent"];

export default function MeasurementsManageScreen() {
  const { data: metrics, isLoading } = useAllBodyMetricDefinitionsQuery();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit ?? "kg";
  const sizeUnit = settings?.sizeUnit ?? "cm";
  const KIND_UNIT: Record<ValueKind, string> = {
    mass: weightUnit,
    length: sizeUnit,
    percent: "%",
  };
  const toggleActiveMutation = useToggleBodyMetricActiveMutation();
  const insertMutation = useInsertCustomBodyMetricMutation();
  const softDeleteMutation = useSoftDeleteCustomBodyMetricMutation();

  const [addExpanded, setAddExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState<ValueKind>("length");

  const kindLabel: Record<ValueKind, string> = {
    mass: t`Mass`,
    length: t`Length`,
    percent: t`Percent`,
  };

  const handleToggle = (id: number, is_active: boolean) => {
    toggleActiveMutation.mutate({ id, is_active: !is_active });
  };

  const handleAddMetric = () => {
    const label = newLabel.trim();
    if (!label) {
      Alert.alert(t`Name required`, t`Enter a name for the custom metric.`);
      return;
    }
    insertMutation.mutate(
      { label, value_kind: newKind },
      {
        onSuccess: () => {
          setNewLabel("");
          setNewKind("length");
          setAddExpanded(false);
        },
      },
    );
  };

  const handleDelete = (id: number, label: string) => {
    Alert.alert(
      t`Hide metric`,
      t`"${label}" will be hidden from the entry form. Your historical data is preserved.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Hide`,
          style: "destructive",
          onPress: () => softDeleteMutation.mutate(id),
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Add custom metric */}
        <View style={styles.addSection}>
          <Button
            mode="outlined"
            icon={addExpanded ? "chevron-up" : "plus"}
            textColor={Colors.dark.tint}
            style={styles.addButton}
            onPress={() => setAddExpanded((v) => !v)}
          >
            <Trans>Add custom metric</Trans>
          </Button>

          {addExpanded && (
            <View style={styles.addForm}>
              <TextInput
                style={styles.addInput}
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder={t`Metric name`}
                placeholderTextColor={Colors.dark.subText}
                returnKeyType="done"
                autoFocus
              />
              <View style={styles.kindRow}>
                {VALUE_KINDS.map((k) => {
                  const active = newKind === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[styles.kindChip, active && styles.kindChipActive]}
                      onPress={() => setNewKind(k)}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.kindChipText,
                          active && styles.kindChipTextActive,
                        ]}
                      >
                        {kindLabel[k]}
                      </ThemedText>
                      <ThemedText style={styles.kindUnit}>
                        {KIND_UNIT[k]}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Button
                mode="contained"
                buttonColor={Colors.dark.tint}
                textColor={Colors.dark.background}
                loading={insertMutation.isPending}
                disabled={insertMutation.isPending}
                onPress={handleAddMetric}
                style={{ marginTop: 8 }}
              >
                <Trans>Add</Trans>
              </Button>
            </View>
          )}
        </View>

        {/* Built-in metrics */}
        <ThemedText style={styles.groupHeader}>
          <Trans>Built-in Metrics</Trans>
        </ThemedText>
        {metrics
          ?.filter((m) => m.is_builtin)
          .map((metric) => (
            <View key={metric.id} style={styles.metricRow}>
              <View style={styles.metricInfo}>
                <ThemedText style={styles.metricLabel}>
                  {metric.label}
                </ThemedText>
                <ThemedText style={styles.metricKind}>
                  {KIND_UNIT[metric.value_kind]}
                </ThemedText>
              </View>
              <Switch
                value={metric.is_active}
                onValueChange={() => handleToggle(metric.id, metric.is_active)}
                color={Colors.dark.tint}
                disabled={toggleActiveMutation.isPending}
              />
            </View>
          ))}

        {/* Custom metrics */}
        {(metrics?.filter((m) => !m.is_builtin).length ?? 0) > 0 && (
          <>
            <ThemedText style={[styles.groupHeader, { marginTop: 16 }]}>
              <Trans>Custom Metrics</Trans>
            </ThemedText>
            {metrics
              ?.filter((m) => !m.is_builtin)
              .map((metric) => (
                <View key={metric.id} style={styles.metricRow}>
                  <View style={styles.metricInfo}>
                    <ThemedText style={styles.metricLabel}>
                      {metric.label}
                    </ThemedText>
                    <ThemedText style={styles.metricKind}>
                      {KIND_UNIT[metric.value_kind]}
                    </ThemedText>
                  </View>
                  <View style={styles.customActions}>
                    <Switch
                      value={metric.is_active}
                      onValueChange={() =>
                        handleToggle(metric.id, metric.is_active)
                      }
                      color={Colors.dark.tint}
                      disabled={toggleActiveMutation.isPending}
                    />
                    <TouchableOpacity
                      onPress={() => handleDelete(metric.id, metric.label)}
                      style={styles.deleteIcon}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color={Colors.dark.highlight}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
  addSection: {
    marginBottom: 20,
  },
  addButton: {
    borderColor: Colors.dark.tint,
  },
  addForm: {
    marginTop: 12,
    gap: 8,
  },
  addInput: {
    fontSize: 15,
    color: Colors.dark.text,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  kindRow: {
    flexDirection: "row",
    gap: 8,
  },
  kindChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  kindChipActive: {
    backgroundColor: Colors.dark.tint + "25",
    borderWidth: 1,
    borderColor: Colors.dark.tint,
  },
  kindChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.subText,
  },
  kindChipTextActive: {
    color: Colors.dark.tint,
  },
  kindUnit: {
    fontSize: 11,
    color: Colors.dark.subText,
    marginTop: 2,
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.dark.subText,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.subText + "40",
  },
  metricInfo: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 15,
  },
  metricKind: {
    fontSize: 12,
    color: Colors.dark.subText,
    marginTop: 2,
  },
  customActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteIcon: {
    padding: 4,
  },
});
