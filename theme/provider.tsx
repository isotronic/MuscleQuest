import React, { createContext, useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@react-navigation/native";
import { Provider as PaperProvider } from "react-native-paper";
import type { AppTheme } from "./types";
import { classicTheme } from "./themes/classic";
import { derivePaperTheme } from "./adapters/paper";
import { deriveNavigationTheme } from "./adapters/navigation";

export const AppThemeContext = createContext<AppTheme>(classicTheme);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const theme = classicTheme; // future: useState<AppTheme>(classicTheme) + switcher

  const paperTheme = useMemo(() => derivePaperTheme(theme), [theme]);
  const navTheme = useMemo(() => deriveNavigationTheme(theme), [theme]);

  return (
    <AppThemeContext.Provider value={theme}>
      <ThemeProvider value={navTheme}>
        <PaperProvider theme={paperTheme}>{children}</PaperProvider>
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}
