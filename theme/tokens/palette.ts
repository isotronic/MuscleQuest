// Raw color palette — internal to the theme module.
// Screens and components must never import this directly; use useAppTheme() instead.

export const palette = {
  // Backgrounds
  void: "#22222d",
  voidLight: "#2a2a36",
  slate: "#3A3A4A",
  slateLight: "#4C566A",
  slateActive: "#81A1C1",

  // Content
  snow: "#ECEDEE",
  stone: "#9BA1A6",
  stoneFaint: "#a6a6b0",

  // Interactive
  gold: "#ebaa39",
  crimson: "#e74043",
  emerald: "#4CAF50",

  // Control disabled
  ashDark: "#4d4d59",
  ashLight: "#a6a6b0",

  // Badges
  sapphire: "#4A90D9",
  amethyst: "#9B59B6",
  ember: "#E74C3C",

  // Exercise highlight (appears in exercises.tsx screens, not in Colors.ts)
  coral: "#FF6F61",

  // Overlay
  blackOverlay65: "rgba(0, 0, 0, 0.65)",
  blackOverlay15: "rgba(0, 0, 0, 0.15)",

  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",
};
