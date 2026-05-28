import type { ViewStyle } from "react-native/Libraries/StyleSheet/StyleSheetTypes";

export const elevation: { card: ViewStyle; modal: ViewStyle } = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
};
