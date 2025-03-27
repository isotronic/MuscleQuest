// TimeInput.tsx
import React, { useState, useEffect } from "react";
import { TextInput, TextInputProps } from "react-native";
import { formatTimeInput } from "@/utils/utility";

type InputProps = typeof TextInputProps;
interface TimeInputProps {
  value: string;
  onChange: (newValue: string) => void;
  style?: InputProps["style"];
  props?: InputProps;
}

export const TimeInput = ({
  value,
  onChange,
  style,
  props,
}: TimeInputProps) => {
  const [localTime, setLocalTime] = useState(value);

  useEffect(() => {
    setLocalTime(value);
  }, [value]);

  const handleChange = (text: string) => {
    const sanitized = text.replace(/[^0-9]/g, "");
    setLocalTime(sanitized);
    onChange(sanitized);
  };

  return (
    <TextInput
      value={formatTimeInput(localTime)}
      onChangeText={handleChange}
      keyboardType="numeric"
      selectTextOnFocus
      style={style}
      {...props}
    />
  );
};
