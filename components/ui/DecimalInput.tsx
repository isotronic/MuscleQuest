import React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { toCanonicalDecimal, toDisplayDecimal } from "@/utils/numberFormat";

export type DecimalInputProps = Omit<
  TextInputProps,
  "value" | "onChangeText" | "keyboardType" | "accessibilityLabel"
> & {
  /** Required: an edit box is otherwise read as just "edit box". */
  accessibilityLabel: string;
  /** Canonical decimal string ("." as the mark). */
  value: string;
  /** Receives the typed text as a canonical decimal string. */
  onChangeValue: (canonical: string) => void;
};

/**
 * Text field for decimal values. Shows the value with the device's decimal
 * separator and accepts either "," or "." while typing, but always reports a
 * canonical string, so callers keep parsing with parseFloat.
 */
export function DecimalInput({
  value,
  onChangeValue,
  accessibilityLabel,
  ...rest
}: DecimalInputProps) {
  return (
    <TextInput
      {...rest}
      accessibilityLabel={accessibilityLabel}
      value={toDisplayDecimal(value)}
      onChangeText={(text) => onChangeValue(toCanonicalDecimal(text))}
      keyboardType="decimal-pad"
    />
  );
}
