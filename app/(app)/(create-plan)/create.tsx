import { StyleSheet, View, Image, Alert, FlatList, Button } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore, Workout } from "@/store/store";
import { TextInput, FAB } from "react-native-paper";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useCreatePlan } from "@/hooks/useCreatePlan";
import WorkoutCard from "@/components/WorkoutCard";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { useEffect } from "react";

export default function CreatePlanScreen() {
  const navigation = useNavigation();
  const { planId } = useLocalSearchParams();
  const {
    workouts,
    setWorkouts,
    clearWorkouts,
    addWorkout,
    removeWorkout,
    changeWorkoutName,
  } = useWorkoutStore();
  const {
    planName,
    setPlanName,
    planImageUrl,
    setPlanImageUrl,
    handleSavePlan,
  } = useCreatePlan(Number(planId));
  const { data: existingPlan } = usePlanQuery(planId ? Number(planId) : null);

  useEffect(() => {
    if (existingPlan) {
      setPlanName(existingPlan.name);
      setWorkouts(existingPlan.plan_data);
      setPlanImageUrl(existingPlan.image_url);
    }
  }, [existingPlan, setPlanName, setWorkouts, setPlanImageUrl]);

  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      // If no workouts or changes, proceed with navigation
      if (!workouts.length && !planName.trim()) {
        clearWorkouts();
        return;
      }

      // Prevent default behavior of back button
      e.preventDefault();

      // Prompt user to confirm discarding changes
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              clearWorkouts();
              navigation.dispatch(e.data.action); // Continue with the back action
            },
          },
        ],
      );
    });
  }, [navigation, workouts, planName, clearWorkouts]);

  const handleAddWorkout = () => {
    const newWorkout = { name: "", exercises: [] };
    addWorkout(newWorkout);
  };

  const handleRemoveWorkout = (index: number) => {
    Alert.alert(
      "Remove Workout",
      "Are you sure you want to remove this workout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          onPress: () => removeWorkout(index),
          style: "destructive",
        },
      ],
      { cancelable: true },
    );
  };

  const handleAddExercise = (index: number) => {
    router.push(`/(app)/(create-plan)/exercises?index=${index}`);
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
        <Button title="Save" onPress={handleSavePlan} />
      </View>
      {workouts.length === 0 ? (
        <ThemedText style={styles.emptyText}>
          Tap + to add a workout to your plan
        </ThemedText>
      ) : (
        <FlatList
          contentContainerStyle={{ overflow: "visible" }}
          data={workouts}
          renderItem={({ item, index }: { item: Workout; index: number }) => (
            <WorkoutCard
              workout={item}
              index={index}
              onRemove={() => handleRemoveWorkout(index)}
              onNameChange={changeWorkoutName}
              onAddExercise={() => handleAddExercise(index)}
            />
          )}
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
    marginRight: 10,
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
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
