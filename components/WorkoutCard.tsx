import { useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useWorkoutStore, Workout, UserExercise } from "@/store/workoutStore";
import { Card, Button, Menu, IconButton } from "react-native-paper";
import {
  ShadowDecorator,
  NestableDraggableFlatList,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

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

  const removeExercise = (workoutIndex: number, exerciseId: number) => {
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
            useWorkoutStore.getState().removeExercise(workoutIndex, exerciseId);
          },
        },
      ],
    );
  };

  const handleReplace = (workoutIndex: number, exerciseIndex: number) => {
    // Navigate to the exercises screen to select a replacement
    router.push({
      pathname: "/(app)/(create-plan)/exercises",
      params: {
        index: workoutIndex,
        replaceExerciseIndex: exerciseIndex,
      },
    });
  };

  const renderExerciseItem = ({
    item,
    drag,
    isActive,
    workoutIndex,
    exerciseIndex,
  }: {
    item: UserExercise;
    drag: () => void;
    isActive: boolean;
    workoutIndex: number;
    exerciseIndex: number;
  }) => {
    // Calculate min and max reps
    const minReps = Math.min(
      ...item.sets.map((set) => set.repsMin ?? Infinity),
    );
    const maxReps = Math.max(
      ...item.sets.map((set) => set.repsMax ?? -Infinity),
    );

    let repRange;
    if (minReps === Infinity && maxReps !== -Infinity) {
      repRange = `${maxReps}`; // Only show maxReps if minReps is undefined
    } else if (maxReps === -Infinity && minReps !== Infinity) {
      repRange = `${minReps}`; // Only show minReps if maxReps is undefined
    } else if (minReps !== Infinity && maxReps !== -Infinity) {
      repRange = `${minReps} - ${maxReps}`; // Show range if both are defined
    }

    const minTime = Math.min(...item.sets.map((set) => set.time ?? Infinity));
    const maxTime = Math.max(...item.sets.map((set) => set.time ?? -Infinity));

    let timeRange;
    if (minTime === Infinity && maxTime !== -Infinity) {
      timeRange = `${maxTime}`; // Only show maxTime if minTime is undefined
    } else if (maxTime === -Infinity && minTime !== Infinity) {
      timeRange = `${minTime}`; // Only show minTime if maxTime is undefined
    } else if (minTime === maxTime) {
      timeRange = `${minTime}`; //Only show minTime if both are the same
    } else if (minTime !== Infinity && maxTime !== -Infinity) {
      timeRange = `${minTime} - ${maxTime}`; // Show range if both are defined
    }

    const isMenuOpen = menuVisible === item.exercise_id;

    return (
      <ShadowDecorator>
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/sets-overview?exerciseId=${item.exercise_id}&workoutIndex=${workoutIndex}&trackingType=${item.tracking_type}`,
            )
          } // Open sets screen on tap
          disabled={isActive}
          style={[
            styles.exerciseItem,
            isActive && styles.activeExerciseItem,
            isActive && { zIndex: 9999 },
          ]}
        >
          <MaterialCommunityIcons
            name="drag"
            onLongPress={drag}
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
                  ? ` | ${timeRange} Seconds`
                  : ""
                : repRange
                  ? ` | ${repRange} Reps`
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
                removeExercise(workoutIndex, item.exercise_id);
              }}
              title="Delete"
            />
            <Menu.Item
              onPress={() => {
                closeMenu();
                handleReplace(workoutIndex, exerciseIndex);
              }}
              title="Replace"
            />
          </Menu>
        </TouchableOpacity>
      </ShadowDecorator>
    );
  };
  const handleDragEnd = (index: number, { data }: { data: UserExercise[] }) => {
    const updatedWorkouts = workouts.map((workout, i) => {
      if (i === index) {
        return { ...workout, exercises: data };
      }
      return workout;
    });
    useWorkoutStore.setState({ workouts: updatedWorkouts });
  };
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
        <NestableDraggableFlatList<UserExercise>
          scrollEnabled={false}
          containerStyle={{ overflow: "visible" }}
          data={workout.exercises}
          keyExtractor={(exercise) => exercise.exercise_id.toString()}
          renderItem={({
            item,
            drag,
            isActive,
          }: RenderItemParams<UserExercise>) => {
            const exerciseIndex = workout.exercises.findIndex(
              (e) => e.exercise_id === item.exercise_id,
            );
            return renderExerciseItem({
              item,
              drag,
              isActive,
              workoutIndex: index,
              exerciseIndex,
            });
          }}
          onDragEnd={(result) => handleDragEnd(index, result)}
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
