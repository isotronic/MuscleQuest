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

  // --- 365d / All Time: monthly buckets ---
  if (timeRange === "365" || timeRange === "0") {
    const startDate = new Date(today);
    if (timeRange === "365") {
      startDate.setFullYear(today.getFullYear() - 1);
    } else if (completedSets.length > 0) {
      const earliest = new Date(
        completedSets[completedSets.length - 1].date_completed,
      );
      startDate.setFullYear(earliest.getFullYear());
      startDate.setMonth(earliest.getMonth());
      startDate.setDate(1);
    } else {
      startDate.setFullYear(today.getFullYear() - 1);
    }

    const buckets: (Bucket & { internalKey: string })[] = [];
    const keyToIndex = new Map<string, number>();

    const cursor = new Date(startDate);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const internalKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      const label = cursor.toLocaleString(undefined, { month: "short" });
      buckets.push({ internalKey, label, value: null, hasData: false });
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

  return [];
};

const INITIAL_SPACING = 10;
const Y_AXIS_WIDTH = 40;
// screen paddingHorizontal 16 each side + card padding 16 each side
const HORIZONTAL_INSETS = 16 * 2 + 16 * 2;

export const ExerciseProgressionChart: React.FC<
  ExerciseProgressionChartProps
> = ({
  exercise,
  timeRange,
  weightUnit,
  distanceUnit,
  prValue,
  preRangeBaseline,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;

  const chartData = useMemo(() => {
    const buckets = groupSetsByTime(
      exercise.completed_sets,
      timeRange,
      exercise.tracking_type,
      conversionFactor,
    );

    if (buckets.length === 0) return [];

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
    const baselineValue =
      preRangeBaseline != null
        ? isWeightTypePre
          ? preRangeBaseline * conversionFactor
          : preRangeBaseline
        : 0;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].value === null) {
        buckets[i] = { ...buckets[i], value: baselineValue };
      }
    }

    if (!buckets.some((b) => b.value !== null)) return [];

    const convertedPR =
      prValue != null && prValue > 0 ? prValue * conversionFactor : undefined;

    return buckets.map((bucket) => {
      const metric = bucket.value as number;
      const isPR =
        bucket.hasData &&
        convertedPR != null &&
        Math.abs(metric - convertedPR) < 0.5;
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
        dataPointColor: !bucket.hasData
          ? "transparent"
          : isPR
            ? Colors.dark.tint
            : Colors.dark.highlight,
        dataPointRadius: !bucket.hasData ? 0 : isPR ? 6 : 4,
      };
    });
  }, [
    exercise.completed_sets,
    timeRange,
    exercise.tracking_type,
    conversionFactor,
    prValue,
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
      ? "Time (s)"
      : exercise.tracking_type === "reps"
        ? "Reps"
        : exercise.tracking_type === "distance"
          ? `Distance (${distanceUnit})`
          : `1RM (${weightUnitLabel})`;

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
              Latest {metricLabel}:{" "}
              {latestMetric !== undefined ? latestMetric.toFixed(1) : "N/A"}
            </ThemedText>

            <ThemedText style={styles.additionalInfo}>
              {latestWeight !== undefined &&
                `${latestWeight.toFixed(1)}${weightUnitLabel} `}
              {exercise.tracking_type === "assisted" && "assistance "}
              {latestSet.reps !== undefined && `x ${latestSet.reps} reps `}
              {latestSet.time !== undefined && `for ${latestSet.time}s `}(
              {new Date(latestSet.date_completed).toLocaleDateString()})
            </ThemedText>
          </>
        )}
        <LineChart
          data={chartData}
          width={chartWidth}
          spacing={spacing}
          initialSpacing={INITIAL_SPACING}
          endSpacing={INITIAL_SPACING}
          thickness={2}
          color={Colors.dark.highlight}
          isAnimated
          areaChart
          startFillColor={chartTheme.negativeAreaStartFill}
          endFillColor="rgba(231,64,67,0.08)"
          yAxisColor="transparent"
          yAxisTextStyle={styles.yAxisLabel}
          xAxisLabelTextStyle={styles.xAxisLabel}
          xAxisColor={Colors.dark.subText}
          hideRules
          noOfSections={3}
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
});
