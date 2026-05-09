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
  const m = parseInt(minutes || "0");
  const s = parseInt(seconds || "0");
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const TimeInput = ({ value, onChange, style }: TimeInputProps) => {
  const { minutes: initM, seconds: initS } = parseValue(value);
  const [minutes, setMinutes] = useState(initM === "0" ? "" : initM);
  const [seconds, setSeconds] = useState(initS === "00" ? "" : initS);
  const secondsRef = useRef<{ focus: () => void }>(null);
  const isEditingRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  // Only sync external value when the user is not actively editing
  useEffect(() => {
    if (isEditingRef.current) return;
    const { minutes: m, seconds: s } = parseValue(value);
    setMinutes(m === "0" ? "" : m);
    setSeconds(s === "00" ? "" : s);
  }, [value]);

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    isEditingRef.current = true;
  };

  const handleMinutesBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 50);
  };

  const handleSecondsBlur = () => {
    // Clamp and pad on blur, before unblocking external sync
    const s = Math.min(parseInt(seconds || "0"), 59);
    if (seconds.length === 1) {
      const padded = seconds.padStart(2, "0");
      setSeconds(padded);
      onChange(emitValue(minutes, padded));
    } else if (s < parseInt(seconds || "0")) {
      const clamped = String(s);
      setSeconds(clamped);
      onChange(emitValue(minutes, clamped));
    }
    blurTimerRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 50);
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
