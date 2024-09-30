import { useEffect } from "react";
import {
  StyleSheet,
  View,
  Image,
  Alert,
  FlatList,
  Button,
  TouchableOpacity,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore, Workout } from "@/store/workoutStore";
import { TextInput, FAB } from "react-native-paper";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useCreatePlan } from "@/hooks/useCreatePlan";
import WorkoutCard from "@/components/WorkoutCard";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { useQueryClient } from "@tanstack/react-query";

export default function CreatePlanScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { planId } = useLocalSearchParams();
  const {
    workouts,
    planImageUrl,
    setPlanImageUrl,
    setWorkouts,
    clearWorkouts,
    addWorkout,
    removeWorkout,
    changeWorkoutName,
  } = useWorkoutStore();
  const { planName, setPlanName, planSaved, setPlanSaved, handleSavePlan } =
    useCreatePlan(Number(planId));
  const { data: existingPlan } = usePlanQuery(planId ? Number(planId) : null);

  useEffect(() => {
    if (existingPlan) {
      setPlanName(existingPlan.name);
      setWorkouts(existingPlan.plan_data);
      setPlanImageUrl(existingPlan.image_url);
    }
  }, [existingPlan, setPlanName, setWorkouts, setPlanImageUrl]);

  // Listen for back navigation
  useEffect(() => {
    // sourcery skip: inline-immediately-returned-variable
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      if (planSaved) {
        queryClient.invalidateQueries({ queryKey: ["plans"] });
        queryClient.invalidateQueries({ queryKey: ["activePlan"] });
        clearWorkouts();
        setPlanSaved(false);
        return navigation.dispatch(e.data.action);
      }

      if (!workouts.length && !planName.trim()) {
        return navigation.dispatch(e.data.action);
      }

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
              setPlanSaved(false);
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [
    navigation,
    workouts,
    planName,
    clearWorkouts,
    planSaved,
    setPlanSaved,
    queryClient,
  ]);

  useEffect(() => {
    if (planSaved) {
      router.back();
    }
  }, [planSaved]);

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

  const handleImageSearch = () => {
    router.push(`/(app)/image-search`);
  };

  const handleAddExercise = (index: number) => {
    router.push(`/(app)/(create-plan)/exercises?index=${index}`);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={handleImageSearch}>
          <Image
            source={{
              uri: planImageUrl,
            }}
            style={styles.image}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Training Plan Name"
          value={planName}
          onChangeText={setPlanName}
        />
        <Button title="Save" onPress={() => handleSavePlan(Number(planId))} />
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
        onPress={handleAddWorkout}
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
