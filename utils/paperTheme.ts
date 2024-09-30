import { Colors } from "@/constants/Colors";
import { DefaultTheme } from "react-native-paper";

export const paperTheme = {
  ...DefaultTheme,
  roundness: 2,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.dark.tint,
    accent: Colors.dark.highlight,
    // Customize other colors as needed
  },
};
