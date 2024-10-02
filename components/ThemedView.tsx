import { View, type ViewProps } from "react-native";

import { StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = Colors.dark.screenBackground;

  return (
    <View
      style={[{ backgroundColor }, style, styles.content]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
