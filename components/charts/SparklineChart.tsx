import React from "react";
import { View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { chartTheme } from "./chartTheme";

interface SparklineChartProps {
  data: { value: number }[];
  width?: number;
  height?: number;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width = 120,
  height = 44,
}) => {
  if (data.length < 2) return null;

  const minVal = Math.min(...data.map((d) => d.value));
  const maxVal = Math.max(...data.map((d) => d.value));
  const range = maxVal - minVal;
  const normalized =
    range === 0
      ? data.map(() => ({ value: 50 }))
      : data.map((d) => ({ value: ((d.value - minVal) / range) * 100 }));

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <LineChart
        data={normalized}
        width={width}
        height={height}
        thickness={3}
        color={chartTheme.primaryColor}
        hideDataPoints
        hideAxesAndRules
        initialSpacing={0}
        endSpacing={0}
        isAnimated={false}
        areaChart
        startFillColor={chartTheme.areaStartFill}
        endFillColor={chartTheme.areaEndFill}
        startOpacity={0.6}
        endOpacity={0.05}
        maxValue={100}
      />
    </View>
  );
};
