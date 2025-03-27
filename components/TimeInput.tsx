// TimeInput.tsx
import React from "react";
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
  const handleChange = (text: string) => {
    const sanitized = text.replace(/[^0-9]/g, "");
    onChange(sanitized);
  };

  return (
    <TextInput
      value={formatTimeInput(value)}
      onChangeText={handleChange}
      keyboardType="numeric"
      selectTextOnFocus
      style={style}
      {...props}
    />
  );
};
