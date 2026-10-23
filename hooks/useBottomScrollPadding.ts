import { useSafeAreaInsets } from "react-native-safe-area-context";

// The app is edge-to-edge: without the bottom inset, scroll content would end
// under the system navigation bar.
export function useBottomScrollPadding(base: number): number {
  return base + useSafeAreaInsets().bottom;
}
