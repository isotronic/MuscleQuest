import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Image,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { NestableScrollContainer } from "react-native-draggable-flatlist";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";
import { FAB, ActivityIndicator, IconButton } from "react-native-paper";
import {
  router,
  Stack,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { Colors } from "@/constants/Colors";
import { useCreatePlan } from "@/hooks/useCreatePlan";
import WorkoutCard from "@/components/WorkoutCard";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { useQueryClient } from "@tanstack/react-query";

export default function CreatePlanScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { planId } = useLocalSearchParams();
  const [dataLoaded, setDataLoaded] = useState(!planId);
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
      setPlanImageUrl(existingPlan.image_url);

      // Load workouts from the existing plan
      if (existingPlan.workouts) {
        setWorkouts(existingPlan.workouts);
      }

      setDataLoaded(true);
    }
  }, [existingPlan, setPlanName, setWorkouts, setPlanImageUrl]);

  // Listen for back navigation
  useEffect(() => {
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

  const saveDisabled = !planName.trim() || workouts.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.dark.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="content-save-outline"
              size={35}
              style={{ marginRight: 0 }}
              disabled={saveDisabled}
              iconColor={Colors.dark.tint}
              onPress={() => handleSavePlan(Number(planId))}
            />
          ),
        }}
      />
      <NestableScrollContainer
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
      >
        {!dataLoaded ? (
          <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.text} />
          </ThemedView>
        ) : (
          <ThemedView style={styles.container}>
            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={handleImageSearch}>
                <Image source={{ uri: planImageUrl }} style={styles.image} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholderTextColor={Colors.dark.subText}
                placeholder="Training Plan Name"
                value={planName}
                onChangeText={setPlanName}
                dense
              />
            </View>
            {workouts.length === 0 ? (
              <ThemedText style={styles.emptyText}>
                Tap + to add a workout to your plan
              </ThemedText>
            ) : (
              workouts.map((workout, index) => (
                <WorkoutCard
                  key={index}
                  workout={workout}
                  index={index}
                  onRemove={() => handleRemoveWorkout(index)}
                  onNameChange={changeWorkoutName}
                  onAddExercise={() => handleAddExercise(index)}
                />
              ))
            )}
          </ThemedView>
        )}
      </NestableScrollContainer>
      <FAB
        icon="plus"
        label="Add Workout"
        style={styles.fab}
        onPress={handleAddWorkout}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    overflow: "visible",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    height: 40,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  buttonLabel: {
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
