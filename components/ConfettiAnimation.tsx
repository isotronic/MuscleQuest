import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { radii } from "@/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Reanimated 4: Animated.View types don't include children in strict TS
const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  children?: React.ReactNode;
}>;

// --- Confetti ---

const CONFETTI_COLORS = [
  "#ebaa39",
  "#4CAF50",
  "#e74043",
  "#9B59B6",
  "#3498DB",
  "#E67E22",
  "#1ABC9C",
];

// Deterministic pseudo-random in [0, 1) from a seed
function pr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

type ParticleConfig = {
  id: number;
  startX: number;
  color: string;
  size: number;
  rotationSpeed: number;
  driftAmplitude: number;
  driftFreq: number;
  delay: number;
  duration: number;
};

const PARTICLE_CONFIGS: ParticleConfig[] = Array.from(
  { length: 40 },
  (_, i) => ({
    id: i,
    startX: pr(i * 7 + 1) * SCREEN_WIDTH,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 7 + (i % 5) * 2,
    rotationSpeed: 120 + (i % 7) * 60,
    driftAmplitude: 10 + pr(i * 7 + 4) * 30,
    driftFreq: 0.6 + pr(i * 7 + 5) * 0.8,
    delay: Math.floor(pr(i * 7 + 2) * 1400),
    duration: Math.floor(2200 + pr(i * 7 + 3) * 1800),
  }),
);

function ConfettiParticle({ config }: { config: ParticleConfig }) {
  const progress = useSharedValue(0);
  const {
    startX,
    driftFreq,
    driftAmplitude,
    rotationSpeed,
    size,
    color,
    delay,
    duration,
  } = config;

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration }));
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const y = -30 + p * (SCREEN_HEIGHT + 60);
    const x = startX + Math.sin(p * Math.PI * 2 * driftFreq) * driftAmplitude;
    const rotation = p * rotationSpeed;
    const opacity = p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1;
    return {
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: size,
      height: Math.ceil(size * 0.5),
      backgroundColor: color,
      borderRadius: radii.sm,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotation}deg` },
      ] as any,
      opacity,
    };
  });

  return <AnimatedView style={animatedStyle} />;
}

export function ConfettiAnimation() {
  // Reanimated would jump each particle to its (invisible) end state anyway;
  // skip mounting 40 animated views for users who asked for less motion.
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLE_CONFIGS.map((config) => (
        <ConfettiParticle key={config.id} config={config} />
      ))}
    </View>
  );
}
