import { useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trans } from "@lingui/react/macro";
import { plural, t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { restCountdownAnnouncement } from "@/utils/a11yAnnouncements";

const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  children?: React.ReactNode;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  onLayout?: (event: LayoutChangeEvent) => void;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: "auto" | "yes" | "no" | "no-hide-descendants";
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
  /** One-line note under the countdown, e.g. that notifications are off. */
  hint?: React.ReactNode;
  /** A button under the hint, e.g. to open the setting it mentions. */
  hintAction?: { label: string; onPress: () => void };
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
  hint,
  hintAction,
}: RestTimerOverlayProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const isLarge = buttonSize > 40;
  const countdown = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // The digits change every second, so they are not a live region (TalkBack
  // would read each tick). Announce the thresholds and the end instead.
  const totalSeconds = minutes * 60 + seconds;
  const previousSecondsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!timerRunning) {
      // Expiry can stop the timer in the same render the countdown hits zero.
      // A rest cut short (more than a second left) is not announced.
      const previous = previousSecondsRef.current;
      previousSecondsRef.current = null;
      if (previous !== null && previous <= 1) {
        const message = restCountdownAnnouncement(previous, 0);
        if (message) AccessibilityInfo.announceForAccessibility(message);
      }
      return;
    }
    const message = restCountdownAnnouncement(
      previousSecondsRef.current,
      totalSeconds,
    );
    previousSecondsRef.current = totalSeconds;
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [timerRunning, totalSeconds]);

  const addLabel = plural(increment, {
    one: "Add # second",
    other: "Add # seconds",
  });
  const removeLabel = plural(increment, {
    one: "Remove # second",
    other: "Remove # seconds",
  });

  return (
    <AnimatedView
      pointerEvents={timerRunning ? "auto" : "none"}
      onLayout={onLayout}
      // Parked off-screen between rests; keep screen readers out of it too.
      accessibilityElementsHidden={!timerRunning}
      importantForAccessibility={timerRunning ? "auto" : "no-hide-descendants"}
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
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
        >
          <ThemedText
            style={[styles.adjustText, isLarge && styles.adjustTextLarge]}
          >
            <Trans>−{increment}s</Trans>
          </ThemedText>
        </TouchableOpacity>
        <ThemedText
          style={styles.timerText}
          // Large fixed-position digits; past this they push the buttons off
          // screen. The countdown is also announced, so nothing is lost.
          maxFontSizeMultiplier={1.5}
          accessibilityLabel={t`Rest time left, ${countdown}`}
        >
          {countdown}
        </ThemedText>
        <TouchableOpacity
          style={[styles.adjustButton, isLarge && styles.adjustButtonLarge]}
          onPress={() => onAdjust(increment)}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <ThemedText
            style={[styles.adjustText, isLarge && styles.adjustTextLarge]}
          >
            <Trans>+{increment}s</Trans>
          </ThemedText>
        </TouchableOpacity>
      </View>
      {hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
      {hint && hintAction ? (
        <Button mode="text" compact onPress={hintAction.onPress}>
          {hintAction.label}
        </Button>
      ) : null}
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
    hint: {
      fontSize: 12,
      color: colors.contentSecondary,
      marginTop: 6,
      paddingHorizontal: 12,
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
