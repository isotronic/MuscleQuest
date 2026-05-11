// TimeInput.tsx
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Colors } from "@/constants/Colors";

interface TimeInputProps {
  value: string;
  onChange: (newValue: string) => void;
  style?: any;
}

function parseValue(value: string): { minutes: string; seconds: string } {
  const parts = value.split(":");
  if (parts.length === 2) {
    return { minutes: parts[0], seconds: parts[1] };
  }
  return { minutes: "0", seconds: "00" };
}

function emitValue(minutes: string, seconds: string): string {
  const m = parseInt(minutes || "0", 10);
  const s = parseInt(seconds || "0", 10);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function normalizeSeconds(raw: string): string {
  const numeric = raw.replace(/[^0-9]/g, "");
  if (!numeric) return "00";
  const s = Math.min(parseInt(numeric, 10), 59);
  return String(s).padStart(2, "0");
}

export const TimeInput = ({ value, onChange, style }: TimeInputProps) => {
  const { minutes: initM, seconds: initS } = parseValue(value);
  const [minutes, setMinutes] = useState(initM === "0" ? "" : initM);
  const [seconds, setSeconds] = useState(initS === "00" ? "" : initS);
  const secondsRef = useRef<{ focus: () => void } | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Only sync external value when the user is not actively editing
  useEffect(() => {
    if (isFocused) return;
    const { minutes: m, seconds: s } = parseValue(value);
    setMinutes(m === "0" ? "" : m);
    setSeconds(s === "00" ? "" : s);
  }, [value, isFocused]);

  const handleFocus = () => setIsFocused(true);

  const handleMinutesBlur = () => setIsFocused(false);

  const handleSecondsBlur = () => {
    const normalized = normalizeSeconds(seconds);
    if (normalized !== seconds) {
      setSeconds(normalized);
      onChange(emitValue(minutes, normalized));
    }
    setIsFocused(false);
  };

  const handleMinutesChange = (text: string) => {
    const digit = text.replace(/[^0-9]/g, "").slice(0, 1);
    setMinutes(digit);
    onChange(emitValue(digit, seconds));
    if (digit.length >= 1) {
      secondsRef.current?.focus();
    }
  };

  const handleSecondsChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 2);
    setSeconds(digits);
    onChange(emitValue(minutes, digits));
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={minutes}
        placeholder="0"
        placeholderTextColor={Colors.dark.subText}
        onChangeText={handleMinutesChange}
        onFocus={handleFocus}
        onBlur={handleMinutesBlur}
        keyboardType="numeric"
        selectTextOnFocus
        maxLength={1}
        style={[style, styles.minutesField]}
      />
      <Text style={styles.separator}>:</Text>
      <TextInput
        ref={secondsRef}
        value={seconds}
        placeholder="00"
        placeholderTextColor={Colors.dark.subText}
        onChangeText={handleSecondsChange}
        onFocus={handleFocus}
        onBlur={handleSecondsBlur}
        keyboardType="numeric"
        selectTextOnFocus
        maxLength={2}
        style={[style, styles.secondsField]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  minutesField: {
    textAlign: "center",
    marginRight: 3,
  },
  secondsField: {
    textAlign: "center",
    marginLeft: 3,
  },
  separator: {
    color: Colors.dark.text,
    fontSize: 18,
    marginHorizontal: 2,
  },
});
