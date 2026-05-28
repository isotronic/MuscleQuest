import React from "react";
import { Image, type ImageProps, type ImageStyle } from "expo-image";
import type { StyleProp } from "react-native/Libraries/StyleSheet/StyleSheet";
import { useAppTheme } from "@/theme";
import type { AppThemeRadii } from "@/theme/types";

const fallbackSource = require("@/assets/images/placeholder.webp");

interface AppImageProps extends Omit<ImageProps, "style"> {
  radius?: keyof AppThemeRadii;
  style?: StyleProp<ImageStyle>;
}

export function AppImage({
  radius = "md",
  style,
  source,
  ...rest
}: AppImageProps) {
  const { radii } = useAppTheme();

  return (
    <Image
      source={source}
      fallbackSource={fallbackSource}
      contentFit="cover"
      style={[{ borderRadius: radii[radius] }, style]}
      {...rest}
    />
  );
}
