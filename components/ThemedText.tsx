import { type ComponentPropsWithRef } from "react";
import { Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme";

// Includes ref: React 19 passes it as a prop, and it reaches Text via ...rest.
export type ThemedTextProps = ComponentPropsWithRef<typeof Text> & {
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

  // Titles and subtitles are section headings; screen readers let users jump
  // between headers, so expose them as such unless the caller overrides it.
  const role =
    type === "title" || type === "subtitle" ? ("header" as const) : undefined;

  return (
    <Text
      accessibilityRole={role}
      style={[styles.base, typeStyle, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
});
