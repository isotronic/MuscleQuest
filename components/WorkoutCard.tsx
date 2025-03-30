import { useCallback, useState } from "react";
import { StyleSheet, View, TextInput, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useWorkoutStore, Workout, UserExercise } from "@/store/workoutStore";
import { Card, Button, Menu, IconButton } from "react-native-paper";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import Sortable from "react-native-sortables";
import type { SortableGridRenderItem } from "react-native-sortables";
import { formatFromTotalSeconds } from "@/utils/utility";

interface WorkoutCardProps {
  workout: Workout;
  index: number;
  onRemove: (index: number) => void;
  onNameChange: (index: number, name: string) => void;
  onAddExercise: (index: number) => void;
}

export default function WorkoutCard({
  workout,
  index,
  onRemove,
  onNameChange,
  onAddExercise,
}: WorkoutCardProps) {
  const { workouts } = useWorkoutStore();
  const [menuVisible, setMenuVisible] = useState<number | null>(null);

  const openMenu = (exerciseId: number) => setMenuVisible(exerciseId);
  const closeMenu = () => setMenuVisible(null);

  const workoutIndex = index;

  const removeExercise = useCallback(
    (exerciseId: number) => {
      const exercise = workout.exercises.find(
        (ex) => ex.exercise_id === exerciseId,
      );
      if (!exercise) {
        return;
      }
      Alert.alert(
        "Remove Exercise",
        `Are you sure you want to remove ${exercise.name}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              useWorkoutStore
                .getState()
                .removeExercise(workoutIndex, exerciseId);
            },
          },
        ],
      );
    },
    [workout.exercises, workoutIndex],
  );

  const handleReplace = useCallback(
    (exerciseIndex: number) => {
      // Navigate to the exercises screen to select a replacement
      router.push({
        pathname: "/(app)/(create-plan)/exercises",
        params: {
          index: workoutIndex,
          replaceExerciseIndex: exerciseIndex,
        },
      });
    },
    [workoutIndex],
  );

  const renderExerciseItem: SortableGridRenderItem<UserExercise> = useCallback(
    ({ item, index }) => {
      const exerciseIndex = index;

      // Calculate min and max reps
      const minReps = Math.min(
        ...item.sets.map((set) => set.repsMin ?? Infinity),
      );
      const maxReps = Math.max(
        ...item.sets.map((set) => set.repsMax ?? -Infinity),
      );

      let repRange;
      if (minReps === Infinity && maxReps !== -Infinity) {
        repRange = `${maxReps}`;
      } else if (maxReps === -Infinity && minReps !== Infinity) {
        repRange = `${minReps}`;
      } else if (minReps !== Infinity && maxReps !== -Infinity) {
        repRange = `${minReps} - ${maxReps}`;
      }

      // Calculate min and max time
      const minTime = Math.min(...item.sets.map((set) => set.time ?? Infinity));
      const maxTime = Math.max(
        ...item.sets.map((set) => set.time ?? -Infinity),
      );

      let timeRange;
      if (minTime === Infinity && maxTime !== -Infinity) {
        timeRange = formatFromTotalSeconds(maxTime);
      } else if (maxTime === -Infinity && minTime !== Infinity) {
        timeRange = formatFromTotalSeconds(minTime);
      } else if (minTime === maxTime) {
        timeRange = formatFromTotalSeconds(minTime);
      } else if (minTime !== Infinity && maxTime !== -Infinity) {
        timeRange = `${formatFromTotalSeconds(minTime)} - ${formatFromTotalSeconds(maxTime)}`;
      }

      const isToFailure = item.sets.some((set) => set.isToFailure);

      const isMenuOpen = menuVisible === item.exercise_id;

      return (
        <Sortable.Pressable
          onPress={() =>
            router.push(
              `/sets-overview?exerciseId=${item.exercise_id}&workoutIndex=${workoutIndex}&exerciseIndex=${exerciseIndex}&trackingType=${item.tracking_type}`,
            )
          }
          style={[styles.exerciseItem]}
        >
          <MaterialCommunityIcons
            name="drag"
            size={24}
            color="#ECEFF4"
            style={styles.dragIcon}
          />
          <View style={styles.exerciseInfo}>
            <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
            <ThemedText style={styles.setsAndReps}>
              {item?.sets?.length
                ? `${item.sets.length} Sets`
                : "No Sets Available"}
              {item.tracking_type === "time"
                ? timeRange
                  ? ` | ${timeRange} ${isToFailure ? "(to Failure)" : ""}`
                  : ""
                : repRange
                  ? ` | ${repRange} ${isToFailure ? "(to Failure) " : ""}Reps`
                  : ""}
            </ThemedText>
          </View>
          <Menu
            visible={isMenuOpen}
            onDismiss={closeMenu}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => openMenu(item.exercise_id)}
                iconColor={Colors.dark.text}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                closeMenu();
                removeExercise(item.exercise_id);
              }}
              title="Delete"
            />
            <Menu.Item
              onPress={() => {
                closeMenu();
                handleReplace(exerciseIndex);
              }}
              title="Replace"
            />
          </Menu>
        </Sortable.Pressable>
      );
    },
    [handleReplace, menuVisible, removeExercise, workoutIndex],
  );

  const handleOrderChange = useCallback(
    ({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
      const updatedExercises = [...workout.exercises];
      const [movedItem] = updatedExercises.splice(fromIndex, 1);
      updatedExercises.splice(toIndex, 0, movedItem);

      const updatedWorkouts = workouts.map((w, i) =>
        i === index ? { ...w, exercises: updatedExercises } : w,
      );

      useWorkoutStore.setState({ workouts: updatedWorkouts });
    },
    [workout.exercises, workouts, index],
  );

  return (
    <Card style={styles.workoutCard}>
      <View style={styles.workoutHeader}>
        <ThemedText style={styles.workoutDay}>Day {index + 1}</ThemedText>
        <MaterialCommunityIcons
          name="close"
          onPress={() => onRemove(index)}
          size={24}
          color={Colors.dark.text}
          style={styles.removeWorkoutButton}
        />
      </View>
      <TextInput
        placeholder="Workout name"
        placeholderTextColor={Colors.dark.subText}
        style={styles.input}
        value={workout.name}
        onChangeText={(text: string) => onNameChange(index, text)}
      />
      {workout.exercises.length > 0 ? (
        <Sortable.Grid
          columns={1} // Treat as a vertical list
          data={workout.exercises}
          keyExtractor={(exercise) => exercise.exercise_id.toString()}
          renderItem={renderExerciseItem}
          onDragEnd={handleOrderChange}
          showDropIndicator
        />
      ) : (
        <ThemedText style={styles.workoutInstructions}>
          No exercises added yet
        </ThemedText>
      )}
      <Button
        mode="outlined"
        style={styles.addButton}
        onPress={() => onAddExercise(index)}
      >
        Add Exercise
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    overflow: "visible",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    marginVertical: 10,
    fontSize: 14,
    lineHeight: 18,
    height: 40,
  },
  addButton: {
    marginTop: 8,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 10,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  workoutCard: {
    width: "100%",
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    overflow: "visible",
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutDay: {
    fontSize: 16,
  },
  workoutName: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: Colors.dark.cardBackground2,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "visible",
  },
  activeExerciseItem: {
    backgroundColor: Colors.dark.activeCardBackground,
    zIndex: 9999,
  },
  exerciseName: {
    color: "#ECEFF4",
    fontSize: 16,
  },
  removeWorkoutButton: {
    padding: 4,
    borderRadius: 50,
  },
  dragIcon: {
    marginRight: 10,
  },
  exerciseInfo: {
    flex: 1,
  },
  setsAndReps: {
    fontSize: 14, // Smaller font size for sets and reps
    color: "#D8DEE9",
  },
  closeIcon: {
    marginLeft: "auto",
  },
});
