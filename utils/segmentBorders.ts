import type { ViewStyle } from "react-native";

// Paper's segment border width in Material 3.
const SEGMENT_BORDER_WIDTH = 1;

/**
 * Border fixes so a selected segment's coloured border shows on every side.
 * Paper draws each shared edge once: every segment but the last has no end
 * border and the next segment's start border closes it, so a selected first
 * or middle segment would keep its neighbour's colour on that edge.
 */
export const selectedSegmentBorders = (
  index: number,
  selectedIndex: number,
  count: number,
): ViewStyle | undefined => {
  if (selectedIndex < 0 || selectedIndex === count - 1) return undefined;
  if (index === selectedIndex) return { borderEndWidth: SEGMENT_BORDER_WIDTH };
  if (index === selectedIndex + 1) return { borderStartWidth: 0 };
  return undefined;
};
