import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme";
import type { AppThemeIcons } from "@/theme/types";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
type MciName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type AppIconProps =
  | {
      set: "ion";
      name: IoniconName;
      size?: keyof AppThemeIcons["sizes"];
      color?: keyof AppThemeIcons["colors"] | string;
    }
  | {
      set: "mci";
      name: MciName;
      size?: keyof AppThemeIcons["sizes"];
      color?: keyof AppThemeIcons["colors"] | string;
    };

export function AppIcon({
  set,
  name,
  size = "md",
  color = "default",
}: AppIconProps) {
  const { icons } = useAppTheme();

  const resolvedSize = icons.sizes[size];
  const resolvedColor =
    color in icons.colors
      ? icons.colors[color as keyof AppThemeIcons["colors"]]
      : (color as string);

  if (set === "ion") {
    return (
      <Ionicons
        name={name as IoniconName}
        size={resolvedSize}
        color={resolvedColor}
      />
    );
  }

  return (
    <MaterialCommunityIcons
      name={name as MciName}
      size={resolvedSize}
      color={resolvedColor}
    />
  );
}
