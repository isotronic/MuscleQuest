import React, { useMemo, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { timeRangePhrase } from "@/components/charts/chartA11y";
import { buildHeatmap, heatmapStart } from "@/utils/heatmap";
import { localDateKeyToDate } from "@/utils/dates";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { useWidgetRange } from "./useWidgetRange";
import { WidgetSection } from "./WidgetSection";

const GAP = 3;
const MIN_CELL = 11;
const MAX_CELL = 18;
const LABEL_HEIGHT = 14;
// Screen padding 16 each side, card padding 12 each side.
const HORIZONTAL_INSETS = 16 * 2 + 12 * 2;
const LEVEL_OPACITY = [0, 0.3, 0.55, 0.8, 1];

export const HeatmapWidget: React.FC<{
  config: WidgetConfigs["heatmap"];
}> = ({ config }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const { allWorkouts, openCalendar } = useStatsWidgetContext();
  const { range, rangeDays, badge } = useWidgetRange(config.range);
  const scrollRef = useRef<ScrollView>(null);

  const oldest = allWorkouts?.length
    ? allWorkouts[allWorkouts.length - 1].local_date
    : null;

  const heatmap = useMemo(() => {
    const today = new Date();
    return buildHeatmap(
      allWorkouts ?? [],
      heatmapStart(rangeDays, oldest, today),
      today,
      config.intensity,
    );
  }, [allWorkouts, rangeDays, oldest, config.intensity]);

  const available = screenWidth - HORIZONTAL_INSETS;
  const columns = heatmap.weeks.length;
  // Short ranges fill the card; long ones scroll, newest week in view.
  const cell = Math.min(
    MAX_CELL,
    Math.max(MIN_CELL, Math.floor((available + GAP) / columns) - GAP),
  );
  const width = columns * (cell + GAP) - GAP;
  const height = LABEL_HEIGHT + 7 * (cell + GAP) - GAP;

  const monthLabels = heatmap.weeks
    .map((week, i) => {
      const first = localDateKeyToDate(week[0].key);
      const prev =
        i > 0 ? localDateKeyToDate(heatmap.weeks[i - 1][0].key) : null;
      return !prev || prev.getMonth() !== first.getMonth()
        ? {
            x: i * (cell + GAP),
            label: first.toLocaleString(undefined, { month: "short" }),
          }
        : null;
    })
    .filter((l): l is { x: number; label: string } => l !== null)
    // Two labels in neighbouring columns would overlap.
    .filter((l, i, all) => i === 0 || l.x - all[i - 1].x >= 3 * (cell + GAP));

  const totalDays = heatmap.weeks.flat().filter((d) => !d.future).length;
  const summary = t`Training days, ${timeRangePhrase(range)}: ${heatmap.trainingDays} of ${totalDays} days.`;

  return (
    <WidgetSection
      title={t`Consistency`}
      rangeBadge={badge}
      loading={!allWorkouts}
    >
      <View style={styles.card}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={summary}
          >
            <Svg width={width} height={height}>
              {monthLabels.map((m) => (
                <SvgText
                  key={`${m.x}`}
                  x={m.x}
                  y={10}
                  fontSize={9}
                  fill={colors.contentSecondary}
                >
                  {m.label}
                </SvgText>
              ))}
              {heatmap.weeks.map((week, col) =>
                week.map((day, row) => (
                  <Rect
                    key={day.key}
                    x={col * (cell + GAP)}
                    y={LABEL_HEIGHT + row * (cell + GAP)}
                    width={cell}
                    height={cell}
                    rx={2}
                    fill={day.level > 0 ? colors.accent : colors.cardSecondary}
                    fillOpacity={
                      day.future
                        ? 0.3
                        : day.level > 0
                          ? LEVEL_OPACITY[day.level]
                          : 1
                    }
                    onPress={
                      day.level > 0 ? () => openCalendar(day.key) : undefined
                    }
                  />
                )),
              )}
            </Svg>
          </View>
        </ScrollView>
        <View
          style={styles.legend}
          importantForAccessibility="no-hide-descendants"
        >
          <ThemedText style={styles.legendText}>
            <Trans>Less</Trans>
          </ThemedText>
          {LEVEL_OPACITY.map((opacity, level) => (
            <View
              key={level}
              style={[
                styles.legendCell,
                {
                  backgroundColor:
                    level > 0 ? colors.accent : colors.cardSecondary,
                  opacity: level > 0 ? opacity : 1,
                },
              ]}
            />
          ))}
          <ThemedText style={styles.legendText}>
            <Trans>More</Trans>
          </ThemedText>
        </View>
      </View>
    </WidgetSection>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 3,
      marginTop: 8,
    },
    legendCell: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 10,
      color: colors.contentSecondary,
      marginHorizontal: 2,
    },
  });
}
