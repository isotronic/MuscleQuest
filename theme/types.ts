import type { ViewStyle } from "react-native/Libraries/StyleSheet/StyleSheetTypes";

export type ThemeName = "classic" | "rpg";

export interface AppThemeColors {
  // Backgrounds
  background: string; // nav bar / header
  surface: string; // screen background
  card: string; // card background
  cardSecondary: string; // nested / secondary card
  cardActive: string; // selected / active card

  // Content
  contentPrimary: string; // main text
  contentSecondary: string; // sub-text, secondary icons
  contentDisabled: string; // disabled text

  // Interactive
  accent: string; // primary action color
  onAccent: string; // text/icon rendered on top of accent
  danger: string; // destructive actions
  success: string; // completed / positive states

  // Control states
  controlDisabledBg: string;
  controlDisabledText: string;

  // Status badges
  badgeWarmup: string;
  badgeDrop: string;
  badgeFailure: string;

  // Miscellaneous / special
  exerciseHighlight: string; // category highlight in exercise lists (#FF6F61)
  modalBackdrop: string;
}

export interface AppThemeTypography {
  sizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  weights: {
    regular: "400";
    semiBold: "600";
    bold: "bold";
  };
  lineHeights: {
    tight: number;
    normal: number;
  };
}

export interface AppThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface AppThemeRadii {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface AppThemeBorders {
  widths: { thin: number; medium: number };
  card: string;
  divider: string;
}

export interface AppThemeElevation {
  card: ViewStyle;
  modal: ViewStyle;
}

export interface AppThemeIcons {
  sizes: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  colors: {
    default: string;
    active: string;
    danger: string;
  };
}

export interface AppThemeCharts {
  primary: string;
  negative: string;
  axisColor: string;
  labelColor: string;
  labelSize: number;
  gridColor: string;
  areaStartFill: string;
  areaEndFill: string;
  negativeAreaStartFill: string;
  negativeAreaEndFill: string;
  thickness: number;
  barBorderRadius: number;
  dataPointRadius: number;
  innerCircleColor: string;
  noOfSections: number;
  bodyPartColors: Record<string, string>;
  bodyPartFallbackColor: string;
}

export interface AppThemeGradients {
  // Placeholder slots; expo-linear-gradient is unused in the RN layer today.
  // The rpg theme can populate these for hero images, buttons, etc.
  chartArea: { start: string; end: string };
}

export interface AppThemeInputs {
  trackActive: string;
  trackInactive: string;
  thumb: string;
  dropdownBg: string;
  dropdownText: string;
  dropdownBorder: string;
  searchBg: string;
}

export interface AppTheme {
  name: ThemeName;
  colors: AppThemeColors;
  typography: AppThemeTypography;
  spacing: AppThemeSpacing;
  radii: AppThemeRadii;
  borders: AppThemeBorders;
  elevation: AppThemeElevation;
  icons: AppThemeIcons;
  charts: AppThemeCharts;
  gradients: AppThemeGradients;
  inputs: AppThemeInputs;
  paper: { roundness: number };
}
