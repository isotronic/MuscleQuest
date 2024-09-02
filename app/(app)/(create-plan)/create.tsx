import { useState } from "react";
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore, Workout } from "@/store/store";
import { TextInput, Button, Card, FAB } from "react-native-paper";
import DraggableFlatlist, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { router } from "expo-router";
import { Colors } from "@/constants/Colors";
import { Exercise } from "@/utils/database";

export default function CreatePlanScreen() {
  const { workouts, addWorkout, removeWorkout, changeWorkoutName } =
    useWorkoutStore();
  const [planName, setPlanName] = useState("");
  const [planImageUrl, setPlanImageUrl] = useState(
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  );

  const handleAddWorkout = () => {
    const newWorkout = { name: "", exercises: [] };
    addWorkout(newWorkout);
  };

  const handleAddExercise = (index: number) => {
    router.push(`/(app)/(create-plan)/exercises?index=${index}`);
  };

  const handleSavePlan = () => {
    if (!planName.trim()) {
      Alert.alert("Please enter a plan name");
      return;
    }

    router.back();
  };

  const renderExerciseItem = ({
    item,
    drag,
    isActive,
  }: {
    item: Exercise;
    drag: () => void;
    isActive: boolean;
  }) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.exerciseItem,
            isActive && styles.activeExerciseItem,
            isActive && { zIndex: 9999 },
          ]}
        >
          <ThemedText>{item.name}</ThemedText>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const handleDragEnd = (index: number, { data }: { data: Exercise[] }) => {
    const updatedWorkouts = workouts.map((workout, i) => {
      if (i === index) {
        return { ...workout, exercises: data };
      }
      return workout;
    });
    useWorkoutStore.setState({ workouts: updatedWorkouts });
  };

  const renderWorkoutCard = ({
    item,
    index,
  }: {
    item: Workout;
    index: number;
  }) => {
    if (!item) {
      console.warn(`Workout at index ${index} is undefined`);
      return null;
    }

    return (
      <Card key={index} style={styles.workoutCard}>
        <ThemedText style={styles.workoutDay}>Day {index + 1}</ThemedText>
        <TextInput
          style={styles.workoutName}
          placeholder="Workout name"
          value={item.name}
          onChangeText={(text: string) => changeWorkoutName(index, text)}
        />
        {item.exercises.length > 0 ? (
          <DraggableFlatlist
            containerStyle={{ overflow: "visible" }}
            data={item.exercises}
            keyExtractor={(exercise) => exercise.exercise_id.toString()}
            renderItem={renderExerciseItem}
            onDragEnd={(result) => handleDragEnd(index, result)}
          />
        ) : (
          <ThemedText style={styles.workoutInstructions}>
            No exercises added yet
          </ThemedText>
        )}
        <Button
          mode="contained"
          onPress={() => handleAddExercise(index)}
          style={styles.addExercisesButton}
        >
          Add exercises
        </Button>
      </Card>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.inputContainer}>
        <Image
          source={{
            uri: planImageUrl,
          }}
          style={styles.image}
        />
        <TextInput
          style={styles.input}
          placeholder="Training Plan Name"
          value={planName}
          onChangeText={setPlanName}
        />
        <Button
          mode="contained"
          onPress={handleSavePlan}
          style={styles.saveButton}
        >
          Save Plan
        </Button>
      </View>
      {workouts.length === 0 ? (
        <ThemedText style={styles.emptyText}>
          Tap + to add a workout to your plan
        </ThemedText>
      ) : (
        <FlatList
          contentContainerStyle={{ overflow: "visible" }}
          data={workouts}
          renderItem={renderWorkoutCard}
          keyExtractor={(_: any, index: number) => index.toString()}
        />
      )}
      <FAB
        icon="plus"
        rippleColor={Colors.dark.tint}
        style={styles.fab}
        onPress={() => {
          handleAddWorkout();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    overflow: "visible",
  },
  saveButton: {
    marginLeft: 10,
    backgroundColor: "#81A1C1",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF",
  },
  emptyText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  workoutCard: {
    width: "100%",
    backgroundColor: "#3B4252",
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    overflow: "visible",
  },
  workoutDay: {
    fontSize: 16,
    color: "#8FBCBB",
  },
  workoutName: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  workoutInstructions: {
    fontSize: 14,
    color: "#D8DEE9",
    marginVertical: 8,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
  exerciseItem: {
    padding: 10,
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
});
