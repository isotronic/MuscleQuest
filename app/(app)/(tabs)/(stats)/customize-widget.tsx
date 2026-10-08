import { useMemo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Checkbox, Switch } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppSelect, checkboxCaptionA11y, checkboxLabel } from "@/components/ui";
import {
  WIDGETS,
  type EditorField,
  type FieldOption,
} from "@/components/stats/widgets/registry";
import {
  useStatsLayout,
  useUpdateStatsLayoutMutation,
} from "@/hooks/useStatsLayout";
import { useActiveBodyMetricDefinitionsQuery } from "@/hooks/useBodyMetricDefinitionsQuery";
import { bodyMetricTranslations } from "@/constants/dbTranslations";
import {
  DEFAULT_STATS_LAYOUT,
  setWidgetConfig,
  widgetConfig,
  type WidgetConfigs,
  type WidgetId,
} from "@/utils/statsLayout";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

type AnyConfig = Record<string, unknown>;

const isWidgetId = (id: unknown): id is WidgetId =>
  typeof id === "string" &&
  DEFAULT_STATS_LAYOUT.widgets.some((w) => w.id === id);

/**
 * Number options left for one end of the target band: the minimum must stay
 * below the maximum and the maximum above the minimum.
 */
const bandOptions = (
  key: string,
  options: readonly number[],
  config: AnyConfig,
): readonly number[] => {
  if (key === "targetMin") {
    return options.filter((n) => n < Number(config.targetMax));
  }
  if (key === "targetMax") {
    return options.filter((n) => n > Number(config.targetMin));
  }
  return options;
};

export default function CustomizeWidgetScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { layout } = useStatsLayout();
  const { save } = useUpdateStatsLayoutMutation();
  const { data: metrics } = useActiveBodyMetricDefinitionsQuery();

  if (!isWidgetId(id)) {
    return (
      <ThemedView style={styles.screen}>
        <ThemedText style={styles.content}>
          <Trans>This section no longer exists.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  const definition = WIDGETS[id];
  const config = widgetConfig(layout, id) as unknown as AnyConfig;
  const fields = definition.fields as EditorField[];
  const update = (patch: AnyConfig) =>
    save(
      setWidgetConfig(layout, id, patch as Partial<WidgetConfigs[typeof id]>),
    );

  const optionList = (options: FieldOption[]) =>
    options.map((o) => ({ value: o.value, label: _(o.label) }));

  const renderChecklist = (
    key: string,
    options: { value: string; label: string }[],
    minimum: number,
  ) => {
    const selected = (config[key] as string[]) ?? [];
    return options.map((option) => {
      const checked = selected.includes(option.value);
      // The last box of a list that needs one stays ticked.
      const locked = checked && selected.length <= minimum;
      const toggle = () => {
        if (locked) return;
        // Keep the options' order, so tiles appear in a stable order.
        const next = checked
          ? selected.filter((v) => v !== option.value)
          : options
              .map((o) => o.value)
              .filter((v) => v === option.value || selected.includes(v));
        update({ [key]: next });
      };
      return (
        <TouchableOpacity
          key={option.value}
          style={styles.checkRow}
          onPress={toggle}
          activeOpacity={0.7}
          accessible={false}
        >
          <Checkbox.Android
            status={checked ? "checked" : "unchecked"}
            color={colors.accent}
            uncheckedColor={colors.contentSecondary}
            disabled={locked}
            onPress={toggle}
            {...checkboxLabel(option.label)}
          />
          <ThemedText style={styles.checkLabel} {...checkboxCaptionA11y}>
            {option.label}
          </ThemedText>
        </TouchableOpacity>
      );
    });
  };

  const renderControl = (field: EditorField) => {
    const label = _(field.label);
    switch (field.kind) {
      case "select":
        return (
          <AppSelect
            data={optionList(field.options)}
            value={String(config[field.key])}
            onChange={(value) => update({ [field.key]: value })}
            accessibilityLabel={label}
          />
        );
      case "number":
        return (
          <AppSelect
            data={bandOptions(field.key, field.options, config).map((n) => ({
              value: String(n),
              label: String(n),
            }))}
            value={String(config[field.key])}
            onChange={(value) => update({ [field.key]: Number(value) })}
            accessibilityLabel={label}
          />
        );
      case "multi":
        return renderChecklist(field.key, optionList(field.options), 1);
      case "metricKeys":
        return renderChecklist(
          field.key,
          (metrics ?? []).map((m) => ({
            value: m.key,
            label: bodyMetricTranslations[m.key]
              ? _(bodyMetricTranslations[m.key])
              : m.label,
          })),
          0,
        );
      case "switch":
        return null;
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: _(definition.title) }} />
      <ScrollView contentContainerStyle={styles.content}>
        {fields
          .filter(
            (field) => !field.visibleWhen || field.visibleWhen(config as never),
          )
          .map((field) => (
            <View key={field.key} style={styles.field}>
              {field.kind === "switch" ? (
                <View style={styles.switchRow}>
                  <View style={styles.switchText}>
                    <ThemedText style={styles.label}>
                      {_(field.label)}
                    </ThemedText>
                    {field.description ? (
                      <ThemedText style={styles.description}>
                        {_(field.description)}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Switch
                    accessibilityLabel={_(field.label)}
                    value={Boolean(config[field.key])}
                    onValueChange={(value) => update({ [field.key]: value })}
                    color={colors.accent}
                  />
                </View>
              ) : (
                <>
                  <ThemedText style={styles.label}>{_(field.label)}</ThemedText>
                  {field.description ? (
                    <ThemedText style={styles.description}>
                      {_(field.description)}
                    </ThemedText>
                  ) : null}
                  <View style={styles.control}>{renderControl(field)}</View>
                </>
              )}
            </View>
          ))}
        <ThemedText style={styles.footnote}>
          {t`Changes are saved straight away.`}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 48,
    },
    field: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 12,
    },
    label: {
      fontSize: 15,
      fontWeight: "bold",
    },
    description: {
      fontSize: 12,
      color: colors.contentSecondary,
      marginTop: 2,
    },
    control: {
      marginTop: 8,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    switchText: {
      flex: 1,
      marginRight: 8,
    },
    checkRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    checkLabel: {
      flex: 1,
      fontSize: 14,
    },
    footnote: {
      fontSize: 12,
      color: colors.contentSecondary,
      textAlign: "center",
      marginTop: 4,
    },
  });
}
