import { View, ViewProps, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme";

type ViewPropsType = typeof ViewProps;

export type ThemedViewProps = ViewPropsType & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor: _lightColor,
  darkColor: _darkColor,
  ...otherProps
}: ThemedViewProps) {
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
