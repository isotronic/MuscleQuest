export const typography = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    regular: "400" as const,
    semiBold: "600" as const,
    bold: "bold" as const,
  },
  lineHeights: {
    tight: 1.0,
    normal: 1.5,
  },
} as const;
