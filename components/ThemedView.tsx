import { View, ViewProps, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme";

type ViewPropsType = typeof ViewProps;

export type ThemedViewProps = ViewPropsType;

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
