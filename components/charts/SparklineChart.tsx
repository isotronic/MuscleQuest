import React from "react";
import { LineChart } from "react-native-gifted-charts";
import { chartTheme } from "./chartTheme";

interface SparklineChartProps {
  data: { value: number }[];
  width?: number;
  height?: number;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width = 60,
  height = 30,
}) => {
  if (data.length < 2) return null;

  return (
    <LineChart
      data={data}
      width={width}
      height={height}
      thickness={chartTheme.thickness}
      color={chartTheme.primaryColor}
      hideDataPoints
      hideAxesAndRules
      isAnimated={false}
      areaChart
      startFillColor={chartTheme.areaStartFill}
      endFillColor={chartTheme.areaEndFill}
      startOpacity={1}
      endOpacity={0}
      adjustToWidth
    />
  );
};
