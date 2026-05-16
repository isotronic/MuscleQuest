import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

interface InsightPill {
  label: string;
  value: string;
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
  const pills: InsightPill[] = [];

  if (workoutsPerWeek != null) {
    pills.push({ label: "Per week", value: `${workoutsPerWeek.toFixed(1)} workouts` });
  }
  if (biggestGainLabel && biggestGainValue) {
    pills.push({ label: `Best gain · ${biggestGainLabel}`, value: biggestGainValue });
  }
  if (topBodyPart) {
    pills.push({ label: "Most trained", value: topBodyPart });
  }
  if (streak != null && streak > 0) {
    pills.push({ label: "Week streak", value: `${streak} 🔥` });
  }

  if (pills.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {pills.map((pill, i) => (
        <View key={i} style={styles.pill}>
          <ThemedText style={styles.pillLabel}>{pill.label}</ThemedText>
          <ThemedText style={styles.pillValue}>{pill.value}</ThemedText>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  strip: {
    paddingVertical: 4,
    gap: 10,
  },
  pill: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.tint + "40",
  },
  pillLabel: {
    fontSize: 11,
    color: Colors.dark.subText,
    textAlign: "center",
    marginBottom: 2,
  },
  pillValue: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    color: Colors.dark.tint,
  },
});
