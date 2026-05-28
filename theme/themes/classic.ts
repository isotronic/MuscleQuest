import type { AppTheme } from "../types";
import { palette } from "../tokens/palette";
import { spacing } from "../tokens/spacing";
import { typography } from "../tokens/typography";
import { radii } from "../tokens/radii";
import { borders } from "../tokens/borders";
import { elevation } from "../tokens/elevation";

export const classicTheme: AppTheme = {
  name: "classic",

  colors: {
    background: palette.void,
    surface: palette.voidLight,
    card: palette.slate,
    cardSecondary: palette.slateLight,
    cardActive: palette.slateActive,
    contentPrimary: palette.snow,
    contentSecondary: palette.stone,
    contentDisabled: palette.stoneFaint,
    accent: palette.gold,
    onAccent: palette.void,
    danger: palette.crimson,
    success: palette.emerald,
    controlDisabledBg: palette.ashDark,
    controlDisabledText: palette.ashLight,
    badgeWarmup: palette.sapphire,
    badgeDrop: palette.amethyst,
    badgeFailure: palette.ember,
    exerciseHighlight: palette.coral,
    modalBackdrop: palette.blackOverlay65,
    surfaceHighlight: palette.whiteOverlay12,
    dangerMuted: palette.crimsonMuted,
    accentSubtle: palette.goldAlpha25,
    accentBorder: palette.goldAlpha40,
    accentBorderStrong: palette.goldAlpha60,
  },

  typography,

  spacing,

  radii,

  borders,

  elevation,

  icons: {
    sizes: {
      sm: 18,
      md: 24,
      lg: 28,
      xl: 32,
    },
    colors: {
      default: palette.stone,
      active: palette.gold,
      danger: palette.crimson,
    },
  },

  charts: {
    primary: palette.gold,
    negative: palette.crimson,
    axisColor: palette.stone,
    labelColor: palette.stone,
    labelSize: 10,
    gridColor: palette.transparent,
    areaStartFill: "rgba(235, 170, 57, 0.4)",
    areaEndFill: "rgba(235, 170, 57, 0.08)",
    negativeAreaStartFill: "rgba(231, 64, 67, 0.4)",
    negativeAreaEndFill: "rgba(231, 64, 67, 0)",
    thickness: 2,
    barBorderRadius: radii.sm,
    dataPointRadius: 4,
    innerCircleColor: palette.slate,
    noOfSections: 3,
    bodyPartColors: {
      back: palette.deepOrange,
      chest: palette.indigo,
      shoulders: palette.teal,
      neck: palette.charcoal,
      arms: palette.fern,
      legs: palette.brown,
      waist: palette.amber,
      cardio: palette.violet,
    },
    bodyPartFallbackColor: palette.magenta,
    pointerStripColor: "rgba(255,255,255,0.15)",
  },

  gradients: {
    chartArea: {
      start: "rgba(235, 170, 57, 0.4)",
      end: "rgba(235, 170, 57, 0)",
    },
  },

  inputs: {
    trackActive: palette.gold,
    trackInactive: palette.stone,
    thumb: palette.gold,
    dropdownBg: palette.slate,
    dropdownText: palette.snow,
    dropdownBorder: palette.stone,
    searchBg: palette.slateLight,
  },

  paper: {
    roundness: 1.5,
  },
};
