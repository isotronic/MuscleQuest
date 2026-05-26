import React, { useMemo } from "react";
import { Text, View, StyleSheet, useWindowDimensions } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { LineChart } from "react-native-gifted-charts";
import { Colors } from "@/constants/Colors";
import { chartTheme } from "./chartTheme";
import {
  TrackedExerciseWithSets,
  CompletedSet,
} from "@/hooks/useTrackedExercisesQuery";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

interface ExerciseProgressionChartProps {
  exercise: TrackedExerciseWithSets;
  timeRange: string;
  weightUnit: string;
  distanceUnit: string;
  prValue?: number;
  preRangeBaseline?: number | null;
}

type Bucket = {
  label: string;
  labelLine2?: string;
  value: number | null;
  hasData: boolean;
};

const groupSetsByTime = (
  completedSets: CompletedSet[],
  timeRange: string,
  trackingType: string | null,
  conversionFactor: number,
): Bucket[] => {
  const isWeightType =
    trackingType === null ||
    trackingType === "weight" ||
    trackingType === "assisted";
  const toMetric = (m: number) => (isWeightType ? m * conversionFactor : m);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- 30d / 90d: Monday-aligned weekly buckets ---
  if (timeRange === "30" || timeRange === "90") {
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - parseInt(timeRange));

    const buckets: (Bucket & { internalKey: string })[] = [];
    const keyToIndex = new Map<string, number>();

    const cursor = new Date(startDate);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      const day = String(cursor.getDate());
      const month = cursor.toLocaleString(undefined, { month: "short" });
      // 30d: fewer buckets → single-line "17 May"; 90d: two-line day / month
      const label = timeRange === "30" ? `${day} ${month}` : day;
      const labelLine2 = timeRange === "90" ? month : undefined;
      buckets.push({
        internalKey,
        label,
        labelLine2,
        value: null,
        hasData: false,
      });
      keyToIndex.set(internalKey, buckets.length - 1);
      cursor.setDate(cursor.getDate() + 7);
    }

    completedSets.forEach((set) => {
      const setDate = new Date(set.date_completed);
      const weekStart = new Date(setDate);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const internalKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      const metric = toMetric(set.progressionMetric);
      const idx = keyToIndex.get(internalKey);
      if (
        idx !== undefined &&
        (!buckets[idx].hasData || metric > (buckets[idx].value as number))
      ) {
        buckets[idx].value = metric;
        buckets[idx].hasData = true;
      }
    });

    return buckets;
  }

  // --- 365d: monthly buckets ---
  if (timeRange === "365") {
    const startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 1);

    const buckets: (Bucket & { internalKey: string })[] = [];
    const keyToIndex = new Map<string, number>();

    const cursor = new Date(startDate);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      buckets.push({
        internalKey,
        label: cursor.toLocaleString(undefined, { month: "short" }),
        value: null,
        hasData: false,
      });
      keyToIndex.set(internalKey, buckets.length - 1);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    completedSets.forEach((set) => {
      const setDate = new Date(set.date_completed);
      const internalKey = `${setDate.getFullYear()}-${setDate.getMonth()}`;
      const metric = toMetric(set.progressionMetric);
      const idx = keyToIndex.get(internalKey);
      if (
        idx !== undefined &&
        (!buckets[idx].hasData || metric > (buckets[idx].value as number))
      ) {
        buckets[idx].value = metric;
        buckets[idx].hasData = true;
      }
    });

    return buckets;
  }

  // --- All Time: adaptive bucket size based on data span ---
  if (timeRange === "0") {
    if (completedSets.length === 0) return [];

    const earliest = new Date(
      completedSets[completedSets.length - 1].date_completed,
    );
    const latestCompleted = new Date(completedSets[0].date_completed);
    const spanYears =
      (latestCompleted.getTime() - earliest.getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);

    const buckets: (Bucket & { internalKey: string })[] = [];
    const keyToIndex = new Map<string, number>();
    let getKey: (d: Date) => string;

    if (spanYears <= 1) {
      const cursor = new Date(earliest);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latestCompleted) {
        const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        buckets.push({
          internalKey,
          label: cursor.toLocaleString(undefined, { month: "short" }),
          value: null,
          hasData: false,
        });
        keyToIndex.set(internalKey, buckets.length - 1);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      getKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    } else if (spanYears <= 3) {
      const cursor = new Date(earliest);
      cursor.setDate(1);
      cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latestCompleted) {
        const q = Math.floor(cursor.getMonth() / 3) + 1;
        const yr = cursor.getFullYear();
        buckets.push({
          internalKey: `${yr}-Q${q}`,
          label: `Q${q}`,
          labelLine2: `${yr}`,
          value: null,
          hasData: false,
        });
        keyToIndex.set(`${yr}-Q${q}`, buckets.length - 1);
        cursor.setMonth(cursor.getMonth() + 3);
      }
      getKey = (d) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    } else {
      const cursor = new Date(earliest);
      cursor.setMonth(0);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latestCompleted) {
        const yr = cursor.getFullYear();
        buckets.push({
          internalKey: `${yr}`,
          label: `${yr}`,
          value: null,
          hasData: false,
        });
        keyToIndex.set(`${yr}`, buckets.length - 1);
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
      getKey = (d) => `${d.getFullYear()}`;
    }

    completedSets.forEach((set) => {
      const internalKey = getKey(new Date(set.date_completed));
      const metric = toMetric(set.progressionMetric);
      const idx = keyToIndex.get(internalKey);
      if (
        idx !== undefined &&
        (!buckets[idx].hasData || metric > (buckets[idx].value as number))
      ) {
        buckets[idx].value = metric;
        buckets[idx].hasData = true;
      }
    });

    return buckets;
  }

  return [];
};

const INITIAL_SPACING = 10;
const Y_AXIS_WIDTH = 40;
const POINTER_LABEL_WIDTH = 65;
// screen paddingHorizontal 16 each side + card padding 16 each side
const HORIZONTAL_INSETS = 16 * 2 + 16 * 2;

export const ExerciseProgressionChart: React.FC<
  ExerciseProgressionChartProps
> = ({ exercise, timeRange, weightUnit, distanceUnit, preRangeBaseline }) => {
  const { width: screenWidth } = useWindowDimensions();
  const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;

  const { chartData, yAxisOffset, yAxisMax } = useMemo(() => {
    const empty = {
      chartData: [],
      yAxisOffset: 0,
      yAxisMax: undefined as number | undefined,
    };

    const buckets = groupSetsByTime(
      exercise.completed_sets,
      timeRange,
      exercise.tracking_type,
      conversionFactor,
    );

    if (buckets.length === 0) return empty;

    // Forward-fill: empty buckets after first data carry the last known value
    let lastValue: number | null = null;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].hasData) {
        lastValue = buckets[i].value;
      } else if (lastValue !== null) {
        buckets[i] = { ...buckets[i], value: lastValue };
      }
    }
    // Pre-data buckets: use the last known value from before the time range if available, else 0
    const isWeightTypePre =
      exercise.tracking_type === null ||
      exercise.tracking_type === "weight" ||
      exercise.tracking_type === "assisted";
    const rawBaseline =
      preRangeBaseline != null
        ? isWeightTypePre
          ? preRangeBaseline * conversionFactor
          : preRangeBaseline
        : undefined;
    const baselineValue =
      rawBaseline != null && rawBaseline > 0 ? rawBaseline : undefined;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].value === null && baselineValue !== undefined) {
        buckets[i] = { ...buckets[i], value: baselineValue };
      }
    }

    if (!buckets.some((b) => b.value !== null)) return empty;

    const chartData = buckets.map((bucket) => {
      const metric = bucket.value ?? 0;
      const labelComponent = bucket.labelLine2
        ? () => (
            <View style={styles.twoLineLabel}>
              <Text style={styles.twoLineLabelText}>{bucket.label}</Text>
              <Text style={styles.twoLineLabelText}>{bucket.labelLine2}</Text>
            </View>
          )
        : undefined;
      return {
        value: metric,
        label: labelComponent ? undefined : bucket.label,
        labelComponent,
        dataPointColor: bucket.hasData ? Colors.dark.tint : "transparent",
        dataPointRadius: 4,
      };
    });

    const vals = chartData.map((p) => p.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    let yAxisOffset: number;
    let yAxisMax: number;
    if (minVal > 0) {
      const range = maxVal - minVal;
      const padding = Math.max(range * 0.15, 0.5);
      yAxisOffset = minVal - padding;
      yAxisMax = maxVal + padding - yAxisOffset;
    } else {
      const padding = Math.max(maxVal * 0.15, 0.5);
      yAxisOffset = 0;
      yAxisMax = maxVal + padding;
    }

    return { chartData, yAxisOffset, yAxisMax };
  }, [
    exercise.completed_sets,
    timeRange,
    exercise.tracking_type,
    conversionFactor,
    preRangeBaseline,
  ]);

  const latestSet = exercise.completed_sets[0];

  const isWeightType =
    exercise.tracking_type === null ||
    exercise.tracking_type === "weight" ||
    exercise.tracking_type === "assisted";

  const weightUnitLabel = weightUnit === "lbs" ? "lbs" : "kg";

  const metricLabel =
    exercise.tracking_type === "time"
      ? t`Time (s)`
      : exercise.tracking_type === "reps"
        ? t`Reps`
        : exercise.tracking_type === "distance"
          ? t`Distance (${distanceUnit})`
          : t`1RM (${weightUnitLabel})`;

  const latestMetric =
    exercise.tracking_type === "reps"
      ? latestSet?.reps
      : exercise.tracking_type === "time"
        ? latestSet?.time
        : exercise.tracking_type === "distance"
          ? latestSet?.progressionMetric
          : latestSet?.oneRepMax !== undefined
            ? latestSet.oneRepMax * conversionFactor
            : undefined;

  const latestWeight =
    latestSet?.weight !== undefined && isWeightType
      ? latestSet.weight * conversionFactor
      : latestSet?.weight;

  const tooltipUnit =
    exercise.tracking_type === "time"
      ? "s"
      : exercise.tracking_type === "reps"
        ? ""
        : exercise.tracking_type === "distance"
          ? distanceUnit
          : weightUnitLabel;

  // Fixed chart width; spacing computed to fit with equal margins on both sides
  const chartWidth =
    screenWidth - HORIZONTAL_INSETS - Y_AXIS_WIDTH - INITIAL_SPACING;
  const n = chartData.length;
  const spacing =
    n > 1
      ? Math.max(1, Math.floor((chartWidth - 2 * INITIAL_SPACING) / (n - 1)))
      : 30;

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText style={styles.exerciseName}>
          {exercise.name} ({metricLabel})
        </ThemedText>
        {latestSet && (
          <>
            <ThemedText style={styles.latestMetric}>
              <Trans>
                Latest {metricLabel}:{" "}
                {latestMetric !== undefined ? latestMetric.toFixed(1) : t`N/A`}
              </Trans>
            </ThemedText>

            <ThemedText style={styles.additionalInfo}>
              {latestWeight !== undefined &&
                `${latestWeight.toFixed(1)}${weightUnitLabel} `}
              {exercise.tracking_type === "assisted" && t`assistance `}
              {latestSet.reps !== undefined && t`x ${latestSet.reps} reps `}
              {latestSet.time !== undefined && t`for ${latestSet.time}s `}(
              {new Date(latestSet.date_completed).toLocaleDateString()})
            </ThemedText>
          </>
        )}
        <LineChart
          key={timeRange}
          data={chartData}
          width={chartWidth}
          spacing={spacing}
          initialSpacing={INITIAL_SPACING}
          endSpacing={INITIAL_SPACING}
          thickness={2}
          color={Colors.dark.tint}
          isAnimated
          areaChart
          startFillColor={chartTheme.areaStartFill}
          endFillColor="rgba(235,170,57,0.08)"
          yAxisColor="transparent"
          yAxisTextStyle={styles.yAxisLabel}
          xAxisLabelTextStyle={styles.xAxisLabel}
          xAxisColor={Colors.dark.subText}
          hideRules
          noOfSections={3}
          yAxisOffset={yAxisOffset}
          maxValue={yAxisMax}
          pointerConfig={{
            activatePointersInstantlyOnTouch: true,
            persistPointer: true,
            showPointerStrip: true,
            pointerStripColor: "rgba(255,255,255,0.15)",
            pointerStripWidth: 1,
            pointerColor: Colors.dark.highlight,
            radius: 5,
            pointerLabelWidth: POINTER_LABEL_WIDTH,
            pointerLabelHeight: 34,
            autoAdjustPointerLabelPosition: true,
            shiftPointerLabelY: -44,
            pointerLabelComponent: (
              items: { value: number }[],
              _secondary: unknown,
              idx: number,
            ) => {
              const val = items[0]?.value;
              if (val == null) return null;
              const display = Number.isInteger(val) ? `${val}` : val.toFixed(1);
              const isLast = idx === n - 1 && n > 1;
              return (
                <View style={[styles.tooltip, isLast && styles.tooltipLast]}>
                  <Text style={styles.tooltipText}>
                    {tooltipUnit ? `${display} ${tooltipUnit}` : display}
                  </Text>
                </View>
              );
            },
          }}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    marginBottom: 8,
    padding: 16,
    backgroundColor: Colors.dark.cardBackground,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  latestMetric: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: Colors.dark.text,
  },
  additionalInfo: {
    fontSize: 12,
    color: Colors.dark.subText,
    marginBottom: 16,
  },
  yAxisLabel: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  xAxisLabel: {
    fontSize: 9,
    color: Colors.dark.text,
    marginTop: 4,
  },
  twoLineLabel: {
    alignItems: "center",
    marginTop: 4,
  },
  twoLineLabelText: {
    fontSize: 9,
    color: Colors.dark.subText,
  },
  tooltip: {
    alignSelf: "center",
    backgroundColor: Colors.dark.cardBackground2,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tooltipLast: {
    alignSelf: "flex-start",
    marginLeft: -(POINTER_LABEL_WIDTH / 1.5),
  },
  tooltipText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
