import { useMemo } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  children?: React.ReactNode;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  onLayout?: (event: LayoutChangeEvent) => void;
}>;

interface RestTimerOverlayProps {
  minutes: number;
  seconds: number;
  increment: number;
  timerRunning: boolean;
  animStyle: any;
  buttonSize?: number;
  onAdjust: (delta: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export default function RestTimerOverlay({
  minutes,
  seconds,
  increment,
  timerRunning,
  animStyle,
  buttonSize = 40,
  onAdjust,
  onLayout,
}: RestTimerOverlayProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const isLarge = buttonSize > 40;

  return (
    <AnimatedView
      pointerEvents={timerRunning ? "auto" : "none"}
      onLayout={onLayout}
      style={[
        styles.container,
        { paddingBottom: insets.bottom + 16 },
        animStyle,
      ]}
    >
      <ThemedText style={styles.label}>
        <Trans>Rest Time Left:</Trans>
      </ThemedText>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.adjustButton, isLarge && styles.adjustButtonLarge]}
          onPress={() => onAdjust(-increment)}
        >
          <ThemedText
            style={[styles.adjustText, isLarge && styles.adjustTextLarge]}
          >
            <Trans>−{increment}s</Trans>
          </ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.timerText}>
          {minutes}:{seconds.toString().padStart(2, "0")}
        </ThemedText>
        <TouchableOpacity
          style={[styles.adjustButton, isLarge && styles.adjustButtonLarge]}
          onPress={() => onAdjust(increment)}
        >
          <ThemedText
            style={[styles.adjustText, isLarge && styles.adjustTextLarge]}
          >
            <Trans>+{increment}s</Trans>
          </ThemedText>
        </TouchableOpacity>
      </View>
    </AnimatedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 0,
      right: 16,
      left: 16,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    label: {
      fontSize: 14,
      color: colors.contentPrimary,
      marginBottom: 4,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    adjustButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radii.md,
      backgroundColor: colors.cardSecondary,
    },
    adjustButtonLarge: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    adjustText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    adjustTextLarge: {
      fontSize: 20,
    },
    timerText: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.contentPrimary,
      textAlign: "center",
      lineHeight: 32,
      marginBottom: 8,
    },
  });
}
