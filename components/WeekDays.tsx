import { View, StyleSheet } from "react-native";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ThemedText } from "./ThemedText";
import { Colors } from "@/constants/Colors";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

interface WeekDaysProps {
  completedWorkoutsThisWeek?: CompletedWorkout[];
}

export default function WeekDays({ completedWorkoutsThisWeek }: WeekDaysProps) {
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

  return (
    <View style={styles.container}>
      {days.map((day, index) => {
        const isToday = isSameDay(day, today);
        const isWorkoutCompleted = completedWorkoutsThisWeek?.some((workout) =>
          isSameDay(new Date(workout.date_completed), day),
        );

        return (
          <View key={index} style={styles.dayContainer}>
            <ThemedText
              style={[styles.dayName, isToday && styles.todayDayName]}
            >
              {format(day, "EEE")}
            </ThemedText>
            <View
              style={[
                styles.circle,
                isWorkoutCompleted && styles.workoutCompletedCircle,
                isToday && styles.todayCircle,
              ]}
            >
              <ThemedText
                style={[styles.dayNumber, isToday && styles.todayDayNumber]}
              >
                {format(day, "d")}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: Colors.dark.subText,
  },
  todayDayName: {
    fontWeight: "900",
    color: Colors.dark.text,
  },
  circle: {
    width: 45,
    height: 45,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderColor: Colors.dark.text,
  },
  todayCircle: {},
  workoutCompletedCircle: {
    borderColor: Colors.dark.completed,
  },
  dayNumber: {
    fontSize: 16,
  },
  todayDayNumber: {
    fontWeight: "900",
  },
});
