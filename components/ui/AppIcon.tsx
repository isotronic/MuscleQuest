import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme";
import type { AppThemeIcons } from "@/theme/types";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
type MciName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// A pressable icon is an icon-only button, so it must say what it does. A
// decorative one is hidden from screen readers instead.
type SharedExtras = {
  style?: object;
  testID?: string;
} & (
  | {
      onPress: (() => void) | undefined;
      accessibilityLabel: string;
      accessibilityHint?: string;
      disabled?: boolean;
    }
  | {
      onPress?: never;
      accessibilityLabel?: string;
      accessibilityHint?: string;
      disabled?: never;
    }
);

type AppIconProps = SharedExtras &
  (
    | {
        set: "ion";
        name: IoniconName;
        size?: keyof AppThemeIcons["sizes"] | number;
        color?: keyof AppThemeIcons["colors"] | string;
      }
    | {
        set: "mci";
        name: MciName;
        size?: keyof AppThemeIcons["sizes"] | number;
        color?: keyof AppThemeIcons["colors"] | string;
      }
  );

export function AppIcon({
  set,
  name,
  size = "md",
  color = "default",
  style,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
  disabled,
}: AppIconProps) {
  const { icons } = useAppTheme();

  const resolvedSize =
    typeof size === "number"
      ? size
      : icons.sizes[size as keyof AppThemeIcons["sizes"]];
  const resolvedColor =
    color in icons.colors
      ? icons.colors[color as keyof AppThemeIcons["colors"]]
      : (color as string);

  const pressable = onPress !== undefined || disabled;
  const a11yProps = pressable
    ? {
        accessible: true,
        accessibilityRole: "button" as const,
        accessibilityLabel,
        accessibilityHint,
        accessibilityState: { disabled: !!disabled || !onPress },
      }
    : accessibilityLabel
      ? {
          accessible: true,
          accessibilityRole: "image" as const,
          accessibilityLabel,
        }
      : {
          accessibilityElementsHidden: true,
          importantForAccessibility: "no-hide-descendants" as const,
        };

  if (set === "ion") {
    return (
      <Ionicons
        name={name as IoniconName}
        size={resolvedSize}
        color={resolvedColor}
        style={style as any}
        onPress={disabled ? undefined : onPress}
        testID={testID}
        {...a11yProps}
      />
    );
  }

  return (
    <MaterialCommunityIcons
      name={name as MciName}
      size={resolvedSize}
      color={resolvedColor}
      style={style as any}
      onPress={disabled ? undefined : onPress}
      testID={testID}
      {...a11yProps}
    />
  );
}
