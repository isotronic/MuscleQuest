import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Workout } from "@/store/workoutStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimate } from "@/utils/estimateWorkoutDuration";
import { Plural } from "@lingui/react/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface StandaloneWorkoutListItemProps {
  workout: Workout;
  onPress: () => void;
  countUnilateralDouble?: boolean;
}

export default function StandaloneWorkoutListItem({
  workout,
  onPress,
  countUnilateralDouble = false,
}: StandaloneWorkoutListItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { estimate } = useWorkoutDurationEstimate(
    workout.exercises,
    countUnilateralDouble,
  );
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.imageContainer}>
        <View style={styles.imagePlaceholder}>
          <MaterialCommunityIcons
            name="weight-lifter"
            size={32}
            color={colors.contentSecondary}
          />
        </View>
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {workout.name}
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          <Plural
            value={workout.exercises.length}
            one="# exercise"
            other="# exercises"
          />
          {estimate ? `  ·  ~${formatDurationEstimate(estimate)}` : ""}
        </ThemedText>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={colors.contentSecondary}
      />
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
    name: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
  });
}
