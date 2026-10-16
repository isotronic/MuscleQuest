import type { ViewStyle } from "react-native";

// Paper's segment border width in Material 3.
const SEGMENT_BORDER_WIDTH = 1;

/**
 * Start and end border widths so a selected segment's coloured border shows
 * on every side. Paper draws each shared edge once: every segment but the
 * last has no end border and the next segment's start border closes it, so a
 * selected first or middle segment draws its own end edge and the segment
 * after it drops its start edge.
 *
 * Both widths are always set: Android keeps a border width that a re-render
 * stops setting, which left edges missing once the selection moved.
 */
export const selectedSegmentBorders = (
  index: number,
  selectedIndex: number,
  count: number,
): Pick<ViewStyle, "borderStartWidth" | "borderEndWidth"> => {
  const isLast = index === count - 1;
  const selectedIsLast = selectedIndex === count - 1;
  const drawsOwnEnd = isLast || (index === selectedIndex && !selectedIsLast);
  const afterSelected =
    selectedIndex >= 0 && !selectedIsLast && index === selectedIndex + 1;
  return {
    borderStartWidth: afterSelected ? 0 : SEGMENT_BORDER_WIDTH,
    borderEndWidth: drawsOwnEnd ? SEGMENT_BORDER_WIDTH : 0,
  };
};
