import React from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

interface SummarySectionProps {
  totalWorkouts: number;
  totalSetsCompleted: number;
  avgSetsPerWorkout: number;
  formattedVolume: string;
  volumeUnit: string;
  totalTime: string;
  avgDuration: string;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  totalWorkouts,
  totalSetsCompleted,
  avgSetsPerWorkout,
  formattedVolume,
  volumeUnit,
  totalTime,
  avgDuration,
}) => {
  return (
    <View style={styles.summaryContainer}>
      <Card style={styles.summaryCard}>
        <ThemedText style={styles.statValue}>{totalWorkouts}</ThemedText>
        <ThemedText style={styles.statLabel}>Workouts</ThemedText>
      </Card>
      <Card style={styles.summaryCard}>
        <ThemedText style={styles.statValue}>{totalSetsCompleted}</ThemedText>
        <ThemedText style={styles.statLabel}>Sets</ThemedText>
      </Card>
      <Card style={styles.summaryCard}>
        <ThemedText style={styles.statValue}>{avgSetsPerWorkout}</ThemedText>
        <ThemedText style={styles.statLabel}>Avg Sets</ThemedText>
      </Card>
      <Card style={styles.summaryCard}>
        <ThemedText style={styles.statValue}>{formattedVolume}</ThemedText>
        <ThemedText style={styles.statLabel}>Volume ({volumeUnit})</ThemedText>
      </Card>
      <Card style={styles.summaryCard}>
        <ThemedText style={styles.statValue}>{totalTime}</ThemedText>
        <ThemedText style={styles.statLabel}>Time (h:m)</ThemedText>
      </Card>
      <Card style={styles.summaryCard}>
        <ThemedText style={styles.statValue}>{avgDuration}</ThemedText>
        <ThemedText style={styles.statLabel}>Avg Duration</ThemedText>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryCard: {
    width: "31%",
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground,
  },
  statValue: {
    fontSize: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
    textAlign: "center",
  },
});
