import React from "react";
import { View } from "react-native";
import Svg, {
  Polyline,
  Polygon,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { useChartTheme } from "./chartTheme";

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
  const chartTheme = useChartTheme();
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  // Add vertical padding so the line doesn't touch the top/bottom edge
  const vPad = height * 0.12;
  const drawHeight = height - vPad * 2;

  const toY = (v: number) => {
    if (range === 0) return vPad + drawHeight / 2;
    return vPad + drawHeight * (1 - (v - minVal) / range);
  };

  const hPad = width * 0.04;

  const points = values.map((v, i) => {
    const x = hPad + (i / (values.length - 1)) * (width - 2 * hPad);
    const y = toY(v);
    return `${x},${y}`;
  });

  // Area fill: close the polygon along the bottom edge
  const areaPoints = [
    `${hPad},${height}`,
    ...points,
    `${width - hPad},${height}`,
  ].join(" ");

  const linePoints = points.join(" ");

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={chartTheme.primary}
              stopOpacity="0.45"
            />
            <Stop
              offset="1"
              stopColor={chartTheme.primary}
              stopOpacity="0.03"
            />
          </LinearGradient>
        </Defs>
        <Polygon points={areaPoints} fill="url(#sparkFill)" />
        <Polyline
          points={linePoints}
          fill="none"
          stroke={chartTheme.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};
