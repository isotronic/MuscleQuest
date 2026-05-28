import { type ComponentProps } from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme";

export type ThemedViewProps = ComponentProps<typeof View>;

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[{ backgroundColor: colors.surface }, style, styles.content]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
