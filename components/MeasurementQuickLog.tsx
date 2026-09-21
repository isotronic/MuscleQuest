import React, { useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, TextInput as RNTextInput } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Trans } from "@lingui/react/macro";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { ThemedText } from "@/components/ThemedText";
import { MeasurementQuickLogCard } from "@/components/MeasurementQuickLogCard";
import { MeasurementQuickLogForm } from "@/components/MeasurementQuickLogForm";
import { useActiveBodyMetricDefinitionsQuery } from "@/hooks/useBodyMetricDefinitionsQuery";
import { useLatestBodyMetricValuesQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import { useInsertBodyMeasurementMutation } from "@/hooks/useBodyMeasurementMutations";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import {
  buildMeasurementValues,
  buildPrefillValues,
} from "@/utils/measurementQuickLog";
import { toDisplayValue } from "@/utils/measurementConversions";
import { useAppTheme } from "@/theme";

// Same cast the notes sheet uses: BottomSheetTextInput is typed loosely but
// accepts the RN TextInput props the form passes it.
const SheetInput = BottomSheetTextInput as unknown as React.ComponentType<
  React.ComponentPropsWithoutRef<typeof RNTextInput>
>;

/**
 * Home-screen entry point for body measurements: a glanceable card that opens
 * a sheet for logging today's numbers without leaving the screen.
 */
export function MeasurementQuickLog() {
  const { colors } = useAppTheme();
  const sheetRef = useRef<BottomSheetModal>(null);

  const { data: settings } = useSettingsQuery();
  const displayOptions = useMemo(
    () => ({
      weightUnit: (settings?.weightUnit || "kg") as "kg" | "lbs",
      sizeUnit: (settings?.sizeUnit || "cm") as "cm" | "in",
    }),
    [settings?.weightUnit, settings?.sizeUnit],
  );

  const { data: metrics } = useActiveBodyMetricDefinitionsQuery();
  const { data: latestValues } = useLatestBodyMetricValuesQuery(displayOptions);
  const insertMutation = useInsertBodyMeasurementMutation(displayOptions);

  const activeMetrics = useMemo(() => metrics ?? [], [metrics]);

  const prefill = useMemo(
    () => buildPrefillValues(activeMetrics, latestValues ?? []),
    [activeMetrics, latestValues],
  );

  const units = useMemo(() => {
    const map: Record<number, string> = {};
    for (const metric of activeMetrics) {
      map[metric.id] = toDisplayValue(
        0,
        metric.value_kind,
        displayOptions,
      ).displayUnit;
    }
    return map;
  }, [activeMetrics, displayOptions]);

  const handleSubmit = useCallback(
    (values: Record<number, string>) => {
      const parsed = buildMeasurementValues(activeMetrics, values);
      if (parsed.length === 0) return;
      insertMutation.mutate(
        { recorded_at: new Date().toISOString(), values: parsed },
        { onSuccess: () => sheetRef.current?.dismiss() },
      );
    },
    [activeMetrics, insertMutation],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    [],
  );

  return (
    <>
      <MeasurementQuickLogCard
        metrics={metrics}
        latestValues={latestValues}
        onPress={() => sheetRef.current?.present()}
      />
      <AppBottomSheet
        ref={sheetRef}
        snapPoints={["55%", "90%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.contentSecondary }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <ThemedText type="subtitle" style={styles.sheetTitle}>
            <Trans>Log Measurements</Trans>
          </ThemedText>
          <ThemedText style={{ color: colors.contentSecondary }}>
            <Trans>Recorded for today.</Trans>
          </ThemedText>
          <View style={styles.formContainer}>
            {/* Remount on prefill change so the form reseeds after a save. */}
            <MeasurementQuickLogForm
              key={JSON.stringify(prefill)}
              metrics={activeMetrics}
              initialValues={prefill}
              units={units}
              isSubmitting={insertMutation.isPending}
              onSubmit={handleSubmit}
              inputComponent={SheetInput}
            />
          </View>
        </BottomSheetView>
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    marginBottom: 4,
  },
  formContainer: {
    marginTop: 12,
  },
});
