import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "react-native-paper";
import { capitalizeWords } from "@/utils/utility";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import {
  bodyPartTranslations,
  muscleTranslations,
} from "@/constants/dbTranslations";
import { useAppTheme } from "@/theme";
import { useChartTheme } from "./chartTheme";
import { summarizeShares } from "./chartA11y";
import type { AppThemeColors } from "@/theme/types";

interface BodyPartChartProps {
  /** Sets (or volume) per body part group or muscle, see mergeSplitRows. */
  bodyPartCounts: Record<string, number> | undefined;
  grouping?: "bodyPart" | "muscle";
  measure?: "sets" | "volume";
}

/** Muscles get this many coloured slices; the rest share one. */
const MAX_MUSCLE_SLICES = 7;
const OTHER = "__other__";

const BodyPartChart: React.FC<BodyPartChartProps> = ({
  bodyPartCounts,
  grouping = "bodyPart",
  measure = "sets",
}) => {
  const { _ } = useLingui();
  const { colors } = useAppTheme();
  const charts = useChartTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );

  // Calculate body part percentages
  const bodyPartPercentages = useMemo(() => {
    if (!bodyPartCounts) return [];
    const total = Object.values(bodyPartCounts).reduce(
      (acc, count) => acc + count,
      0,
    );
    if (total === 0) {
      return [];
    }

    let entries = Object.entries(bodyPartCounts);
    if (grouping === "muscle" && entries.length > MAX_MUSCLE_SLICES + 1) {
      entries.sort((a, b) => b[1] - a[1]);
      const rest = entries
        .slice(MAX_MUSCLE_SLICES)
        .reduce((sum, [, count]) => sum + count, 0);
      entries = [...entries.slice(0, MAX_MUSCLE_SLICES), [OTHER, rest]];
    }

    return entries.map(([bodyPart, count]) => ({
      name: bodyPart,
      count,
      percentage: ((count / total) * 100).toFixed(1),
    }));
  }, [bodyPartCounts, grouping]);

  // Muscles have no colours of their own; they take the palette in order.
  const palette = Object.values(charts.bodyPartColors);
  const sliceColor = (name: string, index: number) => {
    if (name === OTHER) return charts.bodyPartFallbackColor;
    if (grouping === "muscle") {
      return palette[index % palette.length] ?? charts.bodyPartFallbackColor;
    }
    return charts.bodyPartColors[name] ?? charts.bodyPartFallbackColor;
  };

  const chartData = bodyPartPercentages.map((item, index) => ({
    text: item.name,
    value: parseFloat(item.percentage),
    color: sliceColor(item.name, index),
    focused: item.name === selectedBodyPart,
  }));

  const translations =
    grouping === "muscle" ? muscleTranslations : bodyPartTranslations;
  const bodyPartName = (key: string) =>
    key === OTHER
      ? t`Other`
      : translations[key]
        ? _(translations[key])
        : capitalizeWords(key);

  const summary = summarizeShares({
    title:
      measure === "volume"
        ? t`Training split by volume`
        : t`Training split by sets`,
    shares: chartData.map((item) => ({
      name: bodyPartName(item.text),
      percent: item.value,
    })),
    emptyText: t`No workouts in this period`,
  });

  const handleChartPress = (
    item: { text: string; value: number },
    index: number,
  ) => {
    if (item.text !== selectedBodyPart) {
      setSelectedBodyPart(item.text);
      setSelectedPercentage(item.value);
    } else {
      // If the same section is pressed, set state to null to unfocus
      setSelectedBodyPart(null);
      setSelectedPercentage(null);
    }
  };

  // Function to render the colored dot
  const renderDot = (color: string, isSelected: boolean) => (
    <View
      style={{
        height: isSelected ? 12 : 8,
        width: isSelected ? 12 : 8,
        borderRadius: isSelected ? 10 : 5,
        backgroundColor: color,
        marginRight: 4,
      }}
    />
  );

  // Function to render the legend component
  const renderLegendComponent = () => (
    <View style={styles.legendContainer}>
      {chartData.map((item) => {
        const isSelected = item.text === selectedBodyPart;
        return (
          <View key={item.text} style={styles.legendItem}>
            {renderDot(item.color, isSelected)}
            <ThemedText
              style={[
                styles.legendText,
                isSelected && styles.selectedLegendText,
              ]}
            >
              {/* The share is printed so slices are not told apart by colour
                  alone. */}
              {`${bodyPartName(item.text)} ${item.value}%`}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );

  return (
    <>
      {chartData.length > 0 ? (
        <Card style={styles.card}>
          <View>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={summary}
            >
              <PieChart
                donut
                data={chartData}
                radius={150}
                innerRadius={110}
                onPress={handleChartPress}
                sectionAutoFocus
                innerCircleColor={colors.card}
                centerLabelComponent={() => (
                  <View
                    style={{ justifyContent: "center", alignItems: "center" }}
                  >
                    {selectedBodyPart ? (
                      <>
                        <ThemedText
                          style={{ fontSize: 18, fontWeight: "bold" }}
                        >
                          {`${selectedPercentage}%`}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 18 }}>
                          {bodyPartName(selectedBodyPart)}
                        </ThemedText>
                      </>
                    ) : (
                      <ThemedText style={{ fontSize: 18, fontWeight: "bold" }}>
                        {grouping === "muscle" ? (
                          <Trans>Muscles</Trans>
                        ) : (
                          <Trans>Body Parts</Trans>
                        )}
                      </ThemedText>
                    )}
                  </View>
                )}
              />
            </View>
            {/* The chart's label already lists every share. */}
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              {renderLegendComponent()}
            </View>
          </View>
        </Card>
      ) : (
        <ThemedText>
          <Trans>No data available.</Trans>
        </ThemedText>
      )}
    </>
  );
};

export default BodyPartChart;

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.card,
    },
    pieChartLabel: {
      justifyContent: "center",
      alignItems: "center",
    },
    pieChartCenterLabel: {
      fontSize: 18,
      fontWeight: "bold",
    },
    legendContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      marginTop: 8,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      marginRight: 8,
    },
    legendText: {
      fontSize: 12,
    },
    selectedLegendText: {
      fontSize: 14,
      fontWeight: "bold",
    },
  });
}
