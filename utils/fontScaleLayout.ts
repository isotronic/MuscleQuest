/** Tab bar height at the default text size, excluding the bottom inset. */
const TAB_BAR_BASE_HEIGHT = 50;
/** Rendered height of one line of tab label text at a font scale of 1. */
const TAB_LABEL_LINE_HEIGHT = 15;

/**
 * The tab bar has a fixed height, but its labels scale with the system font
 * size. Add the extra label height so large text is not cut off.
 */
export function tabBarHeight(fontScale: number, bottomInset: number): number {
  const extra = Math.max(0, fontScale - 1) * TAB_LABEL_LINE_HEIGHT;
  return Math.ceil(TAB_BAR_BASE_HEIGHT + extra) + bottomInset;
}
