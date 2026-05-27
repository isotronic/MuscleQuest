import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { formatFromTotalSeconds } from "@/utils/utility";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSoundStore } from "@/store/soundStore";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const RING_SIZE = 220;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ExerciseTimerModalProps {
  visible: boolean;
  goalTimeSeconds: number | undefined;
  onStop: (elapsedSeconds: number) => void;
  onCancel: () => void;
}

export const ExerciseTimerModal: React.FC<ExerciseTimerModalProps> = ({
  visible,
  goalTimeSeconds,
  onStop,
  onCancel,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: settings } = useSettingsQuery();
  const countdownFrom = parseInt(settings?.timerCountdown ?? "5", 10) || 5;
  const { playCountdownSound, playGoalSound } = useSoundStore();

  const [phase, setPhase] = useState<"countdown" | "running">("countdown");
  const [countdown, setCountdown] = useState(countdownFrom);
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const countdownSoundPlayedRef = useRef(false);
  const goalSoundPlayedRef = useRef(false);

  const clearCurrent = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setPhase("countdown");
      setCountdown(countdownFrom);
      setElapsedMs(0);
      countdownSoundPlayedRef.current = false;
      goalSoundPlayedRef.current = false;
    } else {
      clearCurrent();
    }
  }, [visible, countdownFrom]);

  useEffect(() => {
    if (!visible || phase !== "countdown") return;
    clearCurrent();
    const soundThreshold = Math.min(3, countdownFrom);
    if (
      settings?.timerCountdownSound === "true" &&
      !countdownSoundPlayedRef.current &&
      countdownFrom <= 3
    ) {
      countdownSoundPlayedRef.current = true;
      playCountdownSound();
    }
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (
          settings?.timerCountdownSound === "true" &&
          !countdownSoundPlayedRef.current &&
          next === soundThreshold
        ) {
          countdownSoundPlayedRef.current = true;
          playCountdownSound();
        }
        if (prev <= 1) {
          clearCurrent();
          setPhase("running");
          return 0;
        }
        return next;
      });
    }, 1000);
    return clearCurrent;
  }, [
    visible,
    phase,
    settings,
    countdownFrom,
    playCountdownSound,
    clearCurrent,
  ]);

  useEffect(() => {
    if (!visible || phase !== "running") return;
    clearCurrent();
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    intervalRef.current = setInterval(() => {
      const newElapsed = Date.now() - startTimeRef.current;
      setElapsedMs(newElapsed);
      if (
        settings?.timerGoalSound === "true" &&
        !goalSoundPlayedRef.current &&
        goalTimeSeconds &&
        goalTimeSeconds > 0 &&
        newElapsed >= goalTimeSeconds * 1000
      ) {
        goalSoundPlayedRef.current = true;
        playGoalSound();
      }
    }, 50);
    return clearCurrent;
  }, [visible, phase, settings, goalTimeSeconds, playGoalSound, clearCurrent]);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const handleStop = () => {
    clearCurrent();
    onStop(elapsedSeconds);
  };

  const hasGoal = !!goalTimeSeconds && goalTimeSeconds > 0;
  const goalLabel = hasGoal ? formatFromTotalSeconds(goalTimeSeconds!) : null;

  const progress = hasGoal
    ? Math.min(elapsedMs / (goalTimeSeconds! * 1000), 1)
    : 0;
  const isVisuallyComplete = hasGoal && progress >= 1;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const progressColor = isVisuallyComplete ? colors.success : colors.accent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={phase === "running" ? handleStop : onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ThemedText style={styles.title}>
            <Trans>Exercise Timer</Trans>
          </ThemedText>

          {phase === "countdown" ? (
            <>
              <ThemedText style={styles.getReadyText}>
                <Trans>Get Ready...</Trans>
              </ThemedText>
              <ThemedText style={styles.countdownText}>{countdown}</ThemedText>
            </>
          ) : (
            <>
              <View style={styles.ringContainer}>
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    stroke={colors.cardSecondary}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                  />
                  {hasGoal && (
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RADIUS}
                      stroke={progressColor}
                      strokeWidth={STROKE_WIDTH}
                      fill="none"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
                    />
                  )}
                  <SvgText
                    x={RING_SIZE / 2}
                    y={RING_SIZE / 2}
                    textAnchor="middle"
                    alignmentBaseline="central"
                    fontSize={52}
                    fontWeight="bold"
                    fill={
                      isVisuallyComplete
                        ? colors.success
                        : colors.contentPrimary
                    }
                  >
                    {formatFromTotalSeconds(elapsedSeconds)}
                  </SvgText>
                </Svg>
              </View>

              {goalLabel && (
                <ThemedText
                  style={[
                    styles.goalText,
                    isVisuallyComplete && styles.goalTextReached,
                  ]}
                >
                  <Trans>
                    Goal: {goalLabel}
                    {isVisuallyComplete ? " ✓" : ""}
                  </Trans>
                </ThemedText>
              )}

              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <ThemedText style={styles.stopButtonText}>
                  <Trans>Stop</Trans>
                </ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingVertical: 40,
      paddingHorizontal: 40,
      alignItems: "center",
      width: "85%",
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.contentSecondary,
      marginBottom: 24,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    getReadyText: {
      fontSize: 22,
      color: colors.contentSecondary,
      marginBottom: 16,
    },
    countdownText: {
      fontSize: 96,
      fontWeight: "bold",
      color: colors.accent,
      lineHeight: 96,
    },
    ringContainer: {
      width: RING_SIZE,
      height: RING_SIZE,
      marginBottom: 20,
    },
    goalText: {
      fontSize: 16,
      color: colors.contentSecondary,
      marginBottom: 28,
    },
    goalTextReached: {
      color: colors.success,
    },
    stopButton: {
      backgroundColor: colors.danger,
      borderRadius: radii.lg,
      paddingVertical: 14,
      paddingHorizontal: 48,
    },
    stopButtonText: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.contentPrimary,
    },
  });
}
