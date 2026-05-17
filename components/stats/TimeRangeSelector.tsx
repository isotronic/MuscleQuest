import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

const RANGES = [
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "1yr", value: "365" },
  { label: "All Time", value: "0" },
];

interface TimeRangeSelectorProps {
  selected: string;
  onChange: (value: string) => void;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selected,
  onChange,
}) => {
  return (
    <View style={styles.row}>
      {RANGES.map((r) => {
        const active = selected === r.value;
        return (
          <TouchableOpacity
            key={r.value}
            onPress={() => onChange(r.value)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.7}
          >
            <ThemedText
              style={[styles.label, active && styles.labelActive]}
            >
              {r.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: Colors.dark.cardBackground,
  },
  pillActive: {
    backgroundColor: Colors.dark.tint + "25",
    borderWidth: 1,
    borderColor: Colors.dark.tint,
  },
  label: {
    fontSize: 12,
    color: Colors.dark.subText,
    fontWeight: "600",
  },
  labelActive: {
    color: Colors.dark.tint,
  },
});
