import { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { format, isSameDay, eachDayOfInterval } from "date-fns";
import { t } from "@lingui/core/macro";
import { toLocalDateKey } from "@/utils/dates";
import {
  DEFAULT_WEEK_RULE,
  endOfAppWeek,
  mondayIndex,
  startOfAppWeek,
  type WeekRule,
} from "@/utils/week";
import { ThemedText } from "./ThemedText";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface WeekDaysProps {
  completedWorkoutsThisWeek?: CompletedWorkout[];
  onDayPress?: (completedWorkouts: CompletedWorkout[]) => void;
  scheduledDayIndices?: Set<number>; // 0=Mon … 6=Sun
  weekRule?: WeekRule;
}

export default function WeekDays({
  completedWorkoutsThisWeek,
  onDayPress,
  scheduledDayIndices,
  weekRule = DEFAULT_WEEK_RULE,
}: WeekDaysProps) {
  const today = new Date();
  // Seven days, or six or eight in the week a change of week start lands.
  const days = eachDayOfInterval({
    start: startOfAppWeek(today, weekRule),
    end: endOfAppWeek(today, weekRule),
  });
  const { colors } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, days.length > 7),
    [colors, days.length],
  );

  return (
    <View style={styles.container}>
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const dayKey = toLocalDateKey(day);
        const completedOnDay = completedWorkoutsThisWeek?.filter(
          (workout) => workout.local_date === dayKey,
        );
        const isWorkoutCompleted = !!completedOnDay?.length;
        const isScheduledIncomplete =
          (scheduledDayIndices?.has(mondayIndex(day)) ?? false) &&
          !isWorkoutCompleted;

        const circle = (
          <View
            style={[
              styles.circle,
              isScheduledIncomplete && styles.scheduledCircle,
              isWorkoutCompleted && styles.workoutCompletedCircle,
            ]}
          >
            <ThemedText
              style={[styles.dayNumber, isToday && styles.todayDayNumber]}
              // The circle has a fixed size; unbounded text would overflow it.
              maxFontSizeMultiplier={1.4}
            >
              {format(day, "d")}
            </ThemedText>
          </View>
        );

        const dayName = day.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

        return (
          <View key={dayKey} style={styles.dayContainer}>
            <ThemedText
              style={[styles.dayName, isToday && styles.todayDayName]}
            >
              {format(day, "EEE")}
            </ThemedText>
            {isWorkoutCompleted && onDayPress ? (
              <Pressable
                onPress={() => onDayPress(completedOnDay)}
                accessibilityRole="button"
                accessibilityLabel={t`View workout on ${dayName}`}
              >
                {circle}
              </Pressable>
            ) : (
              circle
            )}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppThemeColors, crowded: boolean) {
  // Eight 45 px circles do not fit a phone's width.
  const circleSize = crowded ? 38 : 45;
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    dayContainer: {
      flex: 1,
      alignItems: "center",
    },
    dayName: {
      fontSize: 16,
      marginBottom: 4,
      color: colors.contentSecondary,
    },
    todayDayName: {
      fontWeight: "900",
      color: colors.contentPrimary,
    },
    circle: {
      width: circleSize,
      height: circleSize,
      borderRadius: radii.xl,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      borderColor: colors.contentPrimary,
    },
    scheduledCircle: {
      borderColor: colors.accent,
    },
    workoutCompletedCircle: {
      borderColor: colors.success,
      borderWidth: 2,
    },
    dayNumber: {
      fontSize: 16,
    },
    todayDayNumber: {
      fontWeight: "900",
    },
  });
}
