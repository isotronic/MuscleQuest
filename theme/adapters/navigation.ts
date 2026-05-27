import type { Theme } from "@react-navigation/native";
import type { AppTheme } from "../types";

export function deriveNavigationTheme(theme: AppTheme): Theme {
  return {
    dark: true,
    colors: {
      primary: theme.colors.accent,
      background: theme.colors.surface,
      card: theme.colors.background,
      text: theme.colors.contentPrimary,
      border: theme.borders.card,
      notification: theme.colors.accent,
    },
    fonts: {
      regular: { fontFamily: "Inter_400Regular", fontWeight: "400" },
      medium: { fontFamily: "Inter_500Medium", fontWeight: "500" },
      bold: { fontFamily: "Inter_700Bold", fontWeight: "700" },
      heavy: { fontFamily: "Inter_800ExtraBold", fontWeight: "800" },
    },
  };
}
