import React, { useMemo } from "react";
import { Text, View, StyleSheet, useWindowDimensions } from "react-native";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { LineChart } from "react-native-gifted-charts";
import { Colors } from "@/constants/Colors";
import { chartTheme } from "./chartTheme";

interface DataPoint {
  recorded_at: string;
  displayValue: number;
}

interface BodyMeasurementLineChartProps {
  data: DataPoint[];
  timeRange: string;
  unit: string;
  metricLabel: string;
}

type Bucket = {
  label: string;
  labelLine2?: string;
  value: number | null;
  hasData: boolean;
};

export const groupMeasurementsByTime = (
  points: DataPoint[],
  timeRange: string,
): Bucket[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 30d / 90d: Monday-aligned weekly buckets
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

    for (const pt of points) {
      const iso = pt.recorded_at.includes("T")
        ? pt.recorded_at
        : pt.recorded_at.replace(" ", "T");
      const d = new Date(iso);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const internalKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      const idx = keyToIndex.get(internalKey);
      if (idx !== undefined) {
        // Most recent value wins (data is oldest-first so last write wins)
        buckets[idx].value = pt.displayValue;
        buckets[idx].hasData = true;
      }
    }

    return buckets;
  }

  // 365d: monthly buckets
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

    for (const pt of points) {
      const iso = pt.recorded_at.includes("T")
        ? pt.recorded_at
        : pt.recorded_at.replace(" ", "T");
      const d = new Date(iso);
      const internalKey = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = keyToIndex.get(internalKey);
      if (idx !== undefined) {
        buckets[idx].value = pt.displayValue;
        buckets[idx].hasData = true;
      }
    }

    return buckets;
  }

  // All time: adaptive bucket size
  if (timeRange === "0") {
    if (points.length === 0) return [];

    const parseTs = (s: string) =>
      new Date(s.includes("T") ? s : s.replace(" ", "T"));
    const earliest = parseTs(points[0].recorded_at);
    const latest = parseTs(points[points.length - 1].recorded_at);
    const spanYears =
      (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    const buckets: (Bucket & { internalKey: string })[] = [];
    const keyToIndex = new Map<string, number>();
    let getKey: (d: Date) => string;

    if (spanYears <= 1) {
      const cursor = new Date(earliest);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= latest) {
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
      while (cursor <= latest) {
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
      while (cursor <= latest) {
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

    for (const pt of points) {
      const internalKey = getKey(parseTs(pt.recorded_at));
      const idx = keyToIndex.get(internalKey);
      if (idx !== undefined) {
        buckets[idx].value = pt.displayValue;
        buckets[idx].hasData = true;
      }
    }

    return buckets;
  }

  return [];
};

const Y_AXIS_WIDTH = 40;
const HORIZONTAL_INSETS = 16 * 2 + 16 * 2;
const POINTER_LABEL_WIDTH = 65;

export const BodyMeasurementLineChart: React.FC<
  BodyMeasurementLineChartProps
> = ({ data, timeRange, unit, metricLabel }) => {
  const { width: screenWidth } = useWindowDimensions();

  const { chartData, yAxisOffset, yAxisMax } = useMemo(() => {
    const buckets = groupMeasurementsByTime(data, timeRange);
    // Only include buckets with actual data — measurements are point-in-time
    // snapshots, so gaps between measurements are real and should not be filled
    const dataPoints = buckets.filter((b) => b.hasData);
    if (dataPoints.length === 0)
      return { chartData: [], yAxisOffset: 0, yAxisMax: 100 };

    const values = dataPoints.map((b) => b.value ?? 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    const padding = Math.max(range * 0.15, 0.5);
    const yMin = minVal - padding;
    const yMax = maxVal + padding;

    const points = dataPoints.map((bucket) => {
      const labelComponent = bucket.labelLine2
        ? () => (
            <View style={styles.twoLineLabel}>
              <Text style={styles.twoLineLabelText}>{bucket.label}</Text>
              <Text style={styles.twoLineLabelText}>{bucket.labelLine2}</Text>
            </View>
          )
        : undefined;
      return {
        value: bucket.value ?? 0,
        label: labelComponent ? undefined : bucket.label,
        labelComponent,
        dataPointColor: Colors.dark.text,
        dataPointRadius: 4,
      };
    });

    return { chartData: points, yAxisOffset: yMin, yAxisMax: yMax - yMin };
  }, [data, timeRange]);

  // 30d uses "4 May" labels (~28px at size 9), needs more room than single-digit labels
  const initialSpacing = timeRange === "30" ? 20 : 10;
  const chartWidth =
    screenWidth - HORIZONTAL_INSETS - Y_AXIS_WIDTH - initialSpacing;
  const n = chartData.length;
  const spacing =
    n > 1
      ? Math.max(1, Math.floor((chartWidth - 2 * initialSpacing) / (n - 1)))
      : 30;

  if (chartData.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyText}>
          {t`No data for this period`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View>
      <ThemedText style={styles.label}>
        {metricLabel} ({unit})
      </ThemedText>
      <LineChart
        key={timeRange}
        data={chartData}
        width={chartWidth}
        spacing={spacing}
        initialSpacing={initialSpacing}
        endSpacing={initialSpacing}
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
                  {display} {unit}
                </Text>
              </View>
            );
          },
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.subText,
    marginBottom: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: Colors.dark.subText,
    fontSize: 14,
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
