import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

interface InsightPill {
  label: string;
  value: string;
  tooltip?: string;
}

interface InsightsStripProps {
  workoutsPerWeek: number | null;
  biggestGainLabel: string | null;
  biggestGainValue: string | null;
  topBodyPart: string | null;
  streak: number | null;
  weightUnit: string;
}

export const InsightsStrip: React.FC<InsightsStripProps> = ({
  workoutsPerWeek,
  biggestGainLabel,
  biggestGainValue,
  topBodyPart,
  streak,
}) => {
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState(0);
  const [tooltipHalfWidth, setTooltipHalfWidth] = useState(0);
  const [stripHeight, setStripHeight] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const containerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gainPillRef = useRef<any>(null);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );

  const showTooltip = (text: string) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setTooltipHalfWidth(0);

    gainPillRef.current?.measureInWindow(
      (pillX: number, _pillY: number, pillWidth: number) => {
        containerRef.current?.measureInWindow((containerX: number) => {
          setTooltipLeft(pillX - containerX + pillWidth / 2);
          setTooltipText(text);
        });
      },
    );

    dismissTimer.current = setTimeout(() => setTooltipText(null), 2500);
  };

  const pills: InsightPill[] = [];

  if (workoutsPerWeek != null) {
    pills.push({
      label: "Per week (avg)",
      value: `${workoutsPerWeek.toFixed(1)} workouts`,
    });
  }
  if (biggestGainLabel && biggestGainValue) {
    pills.push({
      label: "Best gain",
      value: biggestGainValue,
      tooltip: biggestGainLabel,
    });
  }
  if (topBodyPart) {
    pills.push({ label: "Most trained", value: topBodyPart });
  }
  if (streak != null && streak > 0) {
    pills.push({ label: "Week streak", value: `${streak} 🔥` });
  }

  if (pills.length === 0) return null;

  const renderPill = (pill: InsightPill, i: number) => (
    <Pressable
      key={i}
      ref={pill.tooltip ? gainPillRef : undefined}
      style={styles.pill}
      onPress={pill.tooltip ? () => showTooltip(pill.tooltip!) : undefined}
    >
      <View style={styles.pillLabelRow}>
        <ThemedText style={styles.pillLabel}>{pill.label}</ThemedText>
        {pill.tooltip ? (
          <ThemedText style={styles.infoIcon}>{"ⓘ"}</ThemedText>
        ) : null}
      </View>
      <ThemedText style={styles.pillValue}>{pill.value}</ThemedText>
    </Pressable>
  );

  const useGrid = pills.length >= 4;

  const rows: InsightPill[][] = [];
  if (useGrid) {
    for (let i = 0; i < pills.length; i += 2) {
      rows.push(pills.slice(i, i + 2));
    }
  }

  const onLayout = ({
    nativeEvent,
  }: {
    nativeEvent: { layout: { height: number } };
  }) => setStripHeight(nativeEvent.layout.height);

  return (
    <View ref={containerRef}>
      {tooltipText ? (
        <View
          style={[
            styles.tooltip,
            {
              position: "absolute",
              bottom: stripHeight + 6,
              left: tooltipLeft - tooltipHalfWidth,
              opacity: tooltipHalfWidth === 0 ? 0 : 1,
            },
          ]}
          onLayout={({
            nativeEvent,
          }: {
            nativeEvent: { layout: { width: number } };
          }) => {
            setTooltipHalfWidth(nativeEvent.layout.width / 2);
          }}
        >
          <ThemedText style={styles.tooltipText}>{tooltipText}</ThemedText>
        </View>
      ) : null}
      {useGrid ? (
        <View style={styles.grid} onLayout={onLayout}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((pill, i) => renderPill(pill, ri * 2 + i))}
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          onLayout={onLayout}
        >
          {pills.map((pill, i) => renderPill(pill, i))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    paddingVertical: 4,
    gap: 10,
  },
  grid: {
    gap: 8,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flex: 1,
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.tint + "40",
  },
  pillLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  pillLabel: {
    fontSize: 11,
    color: Colors.dark.subText,
    textAlign: "center",
  },
  infoIcon: {
    fontSize: 10,
    color: Colors.dark.subText,
    lineHeight: 13,
  },
  pillValue: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    color: Colors.dark.tint,
  },
  tooltip: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.dark.tint + "60",
    zIndex: 10,
  },
  tooltipText: {
    fontSize: 12,
    color: Colors.dark.text,
  },
});
