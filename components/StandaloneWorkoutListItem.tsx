import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Workout } from "@/store/workoutStore";
import { AppIcon } from "@/components/ui";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import {
  formatDurationEstimate,
  formatDurationEstimateCompact,
} from "@/utils/estimateWorkoutDuration";
import { Plural, Trans } from "@lingui/react/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface StandaloneWorkoutListItemProps {
  workout: Workout;
  onPress: () => void;
  countUnilateralDouble?: boolean;
  isPublished?: boolean;
  /** When provided, a Start button replaces the chevron. */
  onStart?: () => void;
  disabled?: boolean;
  /** Use the shorter "45m" duration format instead of "45 min". */
  compactEstimate?: boolean;
  /** Drop the horizontal padding so the row aligns with surrounding headings. */
  flushEdges?: boolean;
}

export default function StandaloneWorkoutListItem({
  workout,
  onPress,
  countUnilateralDouble = false,
  isPublished,
  onStart,
  disabled = false,
  compactEstimate = false,
  flushEdges = false,
}: StandaloneWorkoutListItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { estimate } = useWorkoutDurationEstimate(
    workout.exercises,
    countUnilateralDouble,
  );
  return (
    <Pressable
      style={[styles.container, flushEdges && styles.containerFlush]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.imageContainer}>
        <View style={styles.imagePlaceholder}>
          <AppIcon
            set="mci"
            name="weight-lifter"
            size={32}
            color={colors.contentSecondary}
          />
        </View>
      </View>
      <View style={styles.textContainer}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {workout.name}
          </ThemedText>
          {isPublished && (
            <AppIcon
              set="mci"
              name="cloud-check"
              size={16}
              color={colors.accent}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
        <ThemedText style={styles.subtitle}>
          <Plural
            value={workout.exercises.length}
            one="# exercise"
            other="# exercises"
          />
          {estimate
            ? `  ·  ~${
                compactEstimate
                  ? formatDurationEstimateCompact(estimate)
                  : formatDurationEstimate(estimate)
              }`
            : ""}
        </ThemedText>
      </View>
      {onStart ? (
        <Button
          mode="outlined"
          onPress={onStart}
          disabled={disabled}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Start</Trans>
        </Button>
      ) : (
        <AppIcon
          set="mci"
          name="chevron-right"
          size={22}
          color={colors.contentSecondary}
        />
      )}
    </Pressable>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 10,
    },
    containerFlush: {
      paddingHorizontal: 0,
    },
    imageContainer: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
      overflow: "hidden",
      marginRight: 14,
    },
    imagePlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      justifyContent: "center",
      alignItems: "center",
    },
    textContainer: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2,
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    startButtonLabel: {
      fontSize: 13,
      marginHorizontal: 12,
      marginVertical: 6,
    },
  });
}
