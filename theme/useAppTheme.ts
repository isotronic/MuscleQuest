import { useContext } from "react";
import { AppThemeContext } from "./provider";

export function useAppTheme() {
  return useContext(AppThemeContext);
}
