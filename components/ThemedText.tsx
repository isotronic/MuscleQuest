import { Text, TextProps, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme";

type TextPropsType = typeof TextProps;

export type ThemedTextProps = TextPropsType & {
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

export function ThemedText({
  style,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { colors, typography } = useAppTheme();

  const typeStyle = (() => {
    switch (type) {
      case "title":
        return {
          fontSize: typography.sizes.xxxl,
          fontWeight: typography.weights.bold,
          lineHeight: typography.sizes.xxxl,
          color: colors.contentPrimary,
        };
      case "defaultSemiBold":
        return {
          fontSize: typography.sizes.md,
          lineHeight: typography.sizes.md * typography.lineHeights.normal,
          fontWeight: typography.weights.semiBold,
          color: colors.contentPrimary,
        };
      case "subtitle":
        return {
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          color: colors.contentPrimary,
        };
      case "link":
        return {
          lineHeight: 30,
          fontSize: typography.sizes.md,
          color: colors.accent,
        };
      default:
        return {
          fontSize: typography.sizes.md,
          lineHeight: typography.sizes.md * typography.lineHeights.normal,
          color: colors.contentPrimary,
        };
    }
  })();

  return <Text style={[styles.base, typeStyle, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {},
});
