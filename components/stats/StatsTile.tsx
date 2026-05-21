import React from "react";
import { StyleSheet } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

interface StatsTileProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  deltaText?: string;
}

const DeltaText: React.FC<{
  delta: number;
  label?: string;
  deltaText?: string;
}> = ({ delta, label, deltaText }) => {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const color = isNeutral
    ? Colors.dark.subText
    : isPositive
      ? Colors.dark.completed
      : Colors.dark.highlight;
  const prefix = isNeutral ? "─" : isPositive ? "▲" : "▼";
  const absVal = Math.abs(delta);
  const formatted = deltaText ?? (label ? `${absVal}${label}` : absVal);
  const text = `${prefix} ${formatted}`;

  return <ThemedText style={[styles.delta, { color }]}>{text}</ThemedText>;
};

export const StatsTile: React.FC<StatsTileProps> = ({
  label,
  value,
  delta,
  deltaLabel,
  deltaText,
}) => {
  return (
    <Card style={styles.card}>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {delta != null && (
        <DeltaText delta={delta} label={deltaLabel} deltaText={deltaText} />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
  },
  value: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  label: {
    fontSize: 12,
    textAlign: "center",
    color: Colors.dark.subText,
    marginTop: 2,
  },
  delta: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "600",
  },
});
