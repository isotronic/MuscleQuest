import { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ThemedText } from "./ThemedText";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface WeekDaysProps {
  completedWorkoutsThisWeek?: CompletedWorkout[];
  onDayPress?: (completedWorkouts: CompletedWorkout[]) => void;
  scheduledDayIndices?: Set<number>; // 0=Mon … 6=Sun
}

export default function WeekDays({
  completedWorkoutsThisWeek,
  onDayPress,
  scheduledDayIndices,
}: WeekDaysProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

  return (
    <View style={styles.container}>
      {days.map((day, index) => {
        const isToday = isSameDay(day, today);
        const completedOnDay = completedWorkoutsThisWeek?.filter((workout) =>
          isSameDay(new Date(workout.date_completed), day),
        );
        const isWorkoutCompleted = !!completedOnDay?.length;
        const isScheduledIncomplete =
          (scheduledDayIndices?.has(index) ?? false) && !isWorkoutCompleted;

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
            >
              {format(day, "d")}
            </ThemedText>
          </View>
        );

        return (
          <View key={index} style={styles.dayContainer}>
            <ThemedText
              style={[styles.dayName, isToday && styles.todayDayName]}
            >
              {format(day, "EEE")}
            </ThemedText>
            {isWorkoutCompleted && onDayPress ? (
              <Pressable onPress={() => onDayPress(completedOnDay)}>
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

function createStyles(colors: AppThemeColors) {
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
      width: 45,
      height: 45,
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
