import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { Workout } from "@/store/workoutStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface StandaloneWorkoutListItemProps {
  workout: Workout;
  onPress: () => void;
}

export default function StandaloneWorkoutListItem({
  workout,
  onPress,
}: StandaloneWorkoutListItemProps) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.imageContainer}>
        <View style={styles.imagePlaceholder}>
          <MaterialCommunityIcons
            name="weight-lifter"
            size={32}
            color={Colors.dark.subText}
          />
        </View>
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {workout.name}
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {workout.exercises.length}{" "}
          {workout.exercises.length === 1 ? "exercise" : "exercises"}
        </ThemedText>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={Colors.dark.subText}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  imageContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 14,
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.dark.cardBackground2,
    borderRadius: 8,
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
    color: Colors.dark.subText,
  },
});
