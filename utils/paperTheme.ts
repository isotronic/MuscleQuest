import { Colors } from "@/constants/Colors";
import { DefaultTheme } from "react-native-paper";

export const paperTheme = {
  ...DefaultTheme,
  roundness: 2,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.dark.tint,
    primaryContainer: Colors.dark.tint,
    accent: Colors.dark.highlight,
    onPrimary: Colors.dark.background,
    onPrimaryContainer: Colors.dark.background,
    surfaceDisabled: Colors.dark.cardBackground,
    onSurfaceDisabled: Colors.dark.subText,
    // Customize other colors as needed
  },
};
