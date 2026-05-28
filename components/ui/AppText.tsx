import React from "react";
import { Text } from "react-native";
import type { TextProps } from "react-native/Libraries/Text/Text";
import { useAppTheme } from "@/theme";

export type AppTextVariant =
  | "body"
  | "bodyBold"
  | "caption"
  | "label"
  | "title"
  | "subtitle"
  | "link";

export type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: string;
};

export function AppText({
  variant = "body",
  color,
  style,
  ...rest
}: AppTextProps) {
  const { colors, typography } = useAppTheme();

  const variantStyle = (() => {
    switch (variant) {
      case "title":
        return {
          fontSize: typography.sizes.xxxl,
          fontWeight: typography.weights.bold,
          color: color ?? colors.contentPrimary,
        };
      case "subtitle":
        return {
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          color: color ?? colors.contentPrimary,
        };
      case "bodyBold":
        return {
          fontSize: typography.sizes.md,
          fontWeight: typography.weights.semiBold,
          lineHeight: typography.sizes.md * typography.lineHeights.normal,
          color: color ?? colors.contentPrimary,
        };
      case "caption":
        return {
          fontSize: typography.sizes.xs,
          lineHeight: typography.sizes.xs * typography.lineHeights.normal,
          color: color ?? colors.contentSecondary,
        };
      case "label":
        return {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semiBold,
          color: color ?? colors.contentSecondary,
        };
      case "link":
        return {
          fontSize: typography.sizes.md,
          lineHeight: 30,
          color: color ?? colors.accent,
        };
      default: // body
        return {
          fontSize: typography.sizes.md,
          lineHeight: typography.sizes.md * typography.lineHeights.normal,
          color: color ?? colors.contentPrimary,
        };
    }
  })();

  return <Text style={[variantStyle, style]} {...rest} />;
}
