import React from "react";
import type { StyleProp } from "react-native/Libraries/StyleSheet/StyleSheet";
import type { ViewStyle } from "react-native/Libraries/StyleSheet/StyleSheetTypes";
import { Card } from "react-native-paper";
import { useAppTheme } from "@/theme";

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function AppCard({ children, style, onPress }: AppCardProps) {
  const { colors } = useAppTheme();

  return (
    <Card style={[{ backgroundColor: colors.card }, style]} onPress={onPress}>
      {children}
    </Card>
  );
}
