import { DefaultTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";
import type { AppTheme } from "../types";

export function derivePaperTheme(theme: AppTheme): MD3Theme {
  return {
    ...DefaultTheme,
    roundness: theme.paper.roundness,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.colors.accent,
      primaryContainer: theme.colors.accent,
      onPrimary: theme.colors.onAccent,
      onPrimaryContainer: theme.colors.onAccent,
      surfaceDisabled: theme.colors.controlDisabledBg,
      onSurfaceDisabled: theme.colors.controlDisabledText,
      surface: theme.colors.card,
      background: theme.colors.surface,
      onSurface: theme.colors.contentPrimary,
      onBackground: theme.colors.contentPrimary,
      secondary: theme.colors.accent,
      error: theme.colors.danger,
    },
  };
}
