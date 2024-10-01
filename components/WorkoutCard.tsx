import { StyleSheet, View, TouchableOpacity, TextInput } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useWorkoutStore, Workout, UserExercise } from "@/store/workoutStore";
import { Card, Button } from "react-native-paper";
import {
  ShadowDecorator,
  NestableDraggableFlatList,
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

  const renderExerciseItem = ({
    item,
    drag,
    isActive,
    workoutIndex,
  }: {
    item: UserExercise;
    drag: () => void;
    isActive: boolean;
    workoutIndex: number;
  }) => {
    return (
      <ShadowDecorator>
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/sets-overview?exerciseId=${item.exercise_id}&workoutIndex=${workoutIndex}`,
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
            style={{ marginRight: 10 }}
          />
          <ThemedText>{item.name}</ThemedText>
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
        <TouchableOpacity
          style={styles.removeWorkoutButton}
          onPress={() => onRemove(index)}
        >
          <ThemedText style={styles.removeWorkoutButtonText}>x</ThemedText>
        </TouchableOpacity>
      </View>
      <TextInput
        placeholder="Workout name"
        placeholderTextColor={Colors.dark.subText}
        style={styles.input}
        value={workout.name}
        onChangeText={(text: string) => onNameChange(index, text)}
      />
      {workout.exercises.length > 0 ? (
        <NestableDraggableFlatList
          scrollEnabled={false}
          containerStyle={{ overflow: "visible" }}
          data={workout.exercises}
          keyExtractor={(exercise) => exercise.exercise_id.toString()}
          renderItem={({ item, drag, isActive }) =>
            renderExerciseItem({ item, drag, isActive, workoutIndex: index })
          }
          onDragEnd={(result) => handleDragEnd(index, result)}
        />
      ) : (
        <ThemedText style={styles.workoutInstructions}>
          No exercises added yet
        </ThemedText>
      )}
      <Button
        mode="outlined"
        style={styles.saveButton}
        labelStyle={styles.saveButtonLabel}
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
    paddingHorizontal: 20,
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
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    marginVertical: 10,
    height: 40,
  },
  saveButton: {
    marginTop: 8,
  },
  saveButtonLabel: {
    fontSize: 16,
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
    marginVertical: 8,
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
    flex: 1,
    flexDirection: "row",
    paddingVertical: 20,
    paddingHorizontal: 10,
    backgroundColor: "#4C566A",
    marginVertical: 5,
    borderRadius: 8,
    overflow: "visible",
  },
  activeExerciseItem: {
    backgroundColor: "#81A1C1",
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
  removeWorkoutButtonText: {
    fontSize: 20,
    color: "red",
  },
});
