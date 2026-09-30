import React from "react";
import { IconButton } from "react-native-paper";

type PaperIconButtonProps = React.ComponentProps<typeof IconButton>;

/**
 * Icon-only button. The label is required because the icon is all a sighted
 * user sees; a screen reader user otherwise hears only "button".
 */
export type AppIconButtonProps = Omit<
  PaperIconButtonProps,
  "accessibilityLabel"
> & {
  accessibilityLabel: string;
};

export function AppIconButton(props: AppIconButtonProps) {
  return <IconButton accessibilityRole="button" {...props} />;
}
