import React, { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { formatFromTotalSeconds } from "@/utils/utility";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
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
  const { data: settings } = useSettingsQuery();
  const countdownFrom = parseInt(settings?.timerCountdown ?? "5", 10) || 5;

  const [phase, setPhase] = useState<"countdown" | "running">("countdown");
  const [countdown, setCountdown] = useState(countdownFrom);
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const clearCurrent = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (visible) {
      setPhase("countdown");
      setCountdown(countdownFrom);
      setElapsedMs(0);
    } else {
      clearCurrent();
    }
  }, [visible, countdownFrom]);

  useEffect(() => {
    if (!visible || phase !== "countdown") return;
    clearCurrent();
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCurrent();
          setPhase("running");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearCurrent;
  }, [visible, phase]);

  useEffect(() => {
    if (!visible || phase !== "running") return;
    clearCurrent();
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 50);
    return clearCurrent;
  }, [visible, phase]);

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
  const progressColor = isVisuallyComplete
    ? Colors.dark.completed
    : Colors.dark.tint;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={phase === "running" ? handleStop : onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ThemedText style={styles.title}>Exercise Timer</ThemedText>

          {phase === "countdown" ? (
            <>
              <ThemedText style={styles.getReadyText}>Get Ready...</ThemedText>
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
                    stroke={Colors.dark.cardBackground2}
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
                        ? Colors.dark.completed
                        : Colors.dark.text
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
                  Goal: {goalLabel}
                  {isVisuallyComplete ? " ✓" : ""}
                </ThemedText>
              )}

              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <ThemedText style={styles.stopButtonText}>Stop</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 6,
    paddingVertical: 40,
    paddingHorizontal: 40,
    alignItems: "center",
    width: "85%",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.subText,
    marginBottom: 24,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  getReadyText: {
    fontSize: 22,
    color: Colors.dark.subText,
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 96,
    fontWeight: "bold",
    color: Colors.dark.tint,
    lineHeight: 96,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: 20,
  },
  goalText: {
    fontSize: 16,
    color: Colors.dark.subText,
    marginBottom: 28,
  },
  goalTextReached: {
    color: Colors.dark.completed,
  },
  stopButton: {
    backgroundColor: Colors.dark.highlight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  stopButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
});
