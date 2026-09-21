import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { bodyMetricTranslations } from "@/constants/dbTranslations";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { BodyMetricDefinition } from "@/utils/database";

interface MeasurementQuickLogFormProps {
  metrics: BodyMetricDefinition[];
  initialValues: Record<number, string>;
  /** Display unit per metric id, e.g. kg or cm, shown beside each input. */
  units: Record<number, string>;
  isSubmitting: boolean;
  onSubmit: (values: Record<number, string>) => void;
  /**
   * Input component to render. Hosts inside a bottom sheet must pass
   * BottomSheetTextInput, otherwise the keyboard fights the sheet.
   */
  inputComponent?: React.ComponentType<React.ComponentProps<typeof TextInput>>;
}

export function MeasurementQuickLogForm({
  metrics,
  initialValues,
  units,
  isSubmitting,
  onSubmit,
  inputComponent: Input = TextInput,
}: MeasurementQuickLogFormProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const [values, setValues] = useState<Record<number, string>>(initialValues);

  const hasSomethingToLog = Object.values(values).some(
    (v) => v.trim().length > 0,
  );
  const canSubmit = hasSomethingToLog && !isSubmitting;

  return (
    <View style={styles.container}>
      {metrics.map((metric) => (
        <View key={metric.id} style={styles.row}>
          <ThemedText style={styles.label}>
            {bodyMetricTranslations[metric.key]
              ? _(bodyMetricTranslations[metric.key])
              : metric.label}
          </ThemedText>
          <View style={styles.inputGroup}>
            <Input
              testID={`measurement-input-${metric.id}`}
              style={styles.input}
              value={values[metric.id] ?? ""}
              onChangeText={(text) =>
                setValues((prev) => ({ ...prev, [metric.id]: text }))
              }
              keyboardType="decimal-pad"
              placeholder="-"
              placeholderTextColor={colors.contentSecondary}
              selectTextOnFocus
            />
            <ThemedText style={styles.unit}>{units[metric.id]}</ThemedText>
          </View>
        </View>
      ))}

      <Button
        testID="measurement-log-button"
        mode="contained"
        style={styles.submit}
        disabled={!canSubmit}
        loading={isSubmitting}
        onPress={() => {
          if (!canSubmit) return;
          onSubmit(values);
        }}
      >
        <Trans>Log Entry</Trans>
      </Button>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    label: {
      flex: 1,
      fontSize: 15,
    },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    input: {
      minWidth: 80,
      textAlign: "right",
      color: colors.contentPrimary,
      backgroundColor: colors.background,
      borderRadius: radii.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
    },
    unit: {
      width: 32,
      color: colors.contentSecondary,
      fontSize: 14,
    },
    submit: {
      marginTop: 16,
      borderRadius: radii.xl,
    },
  });
}
