import React from "react";
import type { StyleProp } from "react-native/Libraries/StyleSheet/StyleSheet";
import type {
  ViewStyle,
  TextStyle,
} from "react-native/Libraries/StyleSheet/StyleSheetTypes";
import { Button } from "react-native-paper";
import { useAppTheme } from "@/theme";

export type AppButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface AppButtonProps {
  variant?: AppButtonVariant;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
  /** Defaults to the visible text; set it when the text alone is ambiguous. */
  accessibilityLabel?: string;
  /** Say what happens, especially for destructive actions. */
  accessibilityHint?: string;
  testID?: string;
}

export function AppButton({
  variant = "primary",
  onPress,
  loading,
  disabled,
  style,
  labelStyle,
  children,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: AppButtonProps) {
  const { colors } = useAppTheme();

  const mode = (() => {
    switch (variant) {
      case "primary":
        return "contained" as const;
      case "secondary":
        return "outlined" as const;
      case "ghost":
        return "text" as const;
      case "danger":
        return "contained" as const;
    }
  })();

  const buttonColor = variant === "danger" ? colors.danger : undefined;

  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      style={style}
      labelStyle={labelStyle}
      buttonColor={buttonColor}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {children}
    </Button>
  );
}
