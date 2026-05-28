import { MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper";
import type { AppTheme } from "../types";

export function derivePaperTheme(theme: AppTheme): MD3Theme {
  const base = theme.mode === "dark" ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark: theme.mode === "dark",
    roundness: theme.paper.roundness,
    colors: {
      ...base.colors,
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
