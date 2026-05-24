import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { format } from "date-fns";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Colors } from "@/constants/Colors";
import { t } from "@lingui/core/macro";
import { Plural } from "@lingui/react/macro";

interface WorkoutCardProps {
  workout: CompletedWorkout;
  onPress: (id: number) => void;
  excludeWarmup?: boolean;
  variant?: "horizontal" | "vertical";
}

export default function WorkoutHistoryCard({
  workout,
  onPress,
  excludeWarmup = false,
  variant = "horizontal",
}: WorkoutCardProps) {
  const setsCount = excludeWarmup
    ? workout.exercises.reduce(
        (acc, e) => acc + e.sets.filter((s) => !s.is_warmup).length,
        0,
      )
    : workout.total_sets_completed;

  const durationMin = Math.round(workout.duration / 60);
  const dateLabel = format(new Date(workout.date_completed), "EEE, d MMM");
  const isVertical = variant === "vertical";

  return (
    <TouchableOpacity
      onPress={() => onPress(workout.id)}
      style={[
        styles.container,
        isVertical ? styles.containerVertical : styles.containerHorizontal,
      ]}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.card,
          isVertical ? styles.cardVertical : styles.cardHorizontal,
        ]}
      >
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {workout.workout_name}
          </Text>
          {isVertical && <Text style={styles.chevron}>›</Text>}
        </View>
        <Text style={styles.date}>{dateLabel}</Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{t`${durationMin} min`}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              <Plural value={setsCount} one="# set" other="# sets" />
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: "hidden",
  },
  containerHorizontal: {
    width: 180,
    marginRight: 8,
  },
  containerVertical: {
    width: "100%",
    marginBottom: 8,
  },
  card: {
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.tint,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHorizontal: {
    backgroundColor: Colors.dark.cardBackground,
  },
  cardVertical: {
    backgroundColor: Colors.dark.cardBackground2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.dark.text,
  },
  chevron: {
    fontSize: 20,
    color: Colors.dark.subText,
    marginLeft: 4,
  },
  date: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.dark.subText,
  },
  chips: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    color: Colors.dark.text,
  },
});
