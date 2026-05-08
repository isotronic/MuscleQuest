import { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";
import { ActivityIndicator, Button, Portal, Modal } from "react-native-paper";
import { router, Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { Colors } from "@/constants/Colors";
import WorkoutCard from "@/components/WorkoutCard";
import { useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import SaveIcon from "@/components/SaveIcon";
import {
  useCreateStandaloneWorkout,
  useUpdateStandaloneWorkout,
} from "@/hooks/useCreateStandaloneWorkout";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";

export default function CreateWorkoutScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { workoutId: workoutIdParam } = useLocalSearchParams<{ workoutId?: string }>();
  const existingWorkoutId = workoutIdParam ? Number(workoutIdParam) : null;

  const [isSaving, setIsSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  const {
    workouts,
    clearWorkouts,
    addWorkout,
    changeWorkoutName,
    setWorkouts,
  } = useWorkoutStore();

  const { data: standaloneWorkouts } = useStandaloneWorkoutsQuery();
  const createMutation = useCreateStandaloneWorkout();
  const updateMutation = useUpdateStandaloneWorkout();

  // Initialise workoutStore for this screen
  useEffect(() => {
    if (existingWorkoutId && standaloneWorkouts) {
      const existing = standaloneWorkouts.find((w) => w.id === existingWorkoutId);
      if (existing) {
        setWorkouts([existing]);
        return;
      }
    }
    clearWorkouts();
    addWorkout({ name: "", exercises: [], id: -Date.now() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingWorkoutId, standaloneWorkouts]);

  // Guard back-navigation when there are unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      if (savedFlag) {
        clearWorkouts();
        setSavedFlag(false);
        return navigation.dispatch(e.data.action);
      }

      const workout = workouts[0];
      if (!workout || (!workout.exercises.length && !workout.name.trim())) {
        clearWorkouts();
        return navigation.dispatch(e.data.action);
      }

      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              clearWorkouts();
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, workouts, clearWorkouts, savedFlag]);

  const handleAddExercise = () => {
    router.push("/(app)/(create-plan)/exercises?index=0");
  };

  const handleSave = async () => {
    const workout = workouts[0];
    if (!workout) return;

    const name = workout.name.trim() || "My Workout";
    setIsSaving(true);

    try {
      if (existingWorkoutId) {
        await updateMutation.mutateAsync({
          workoutId: existingWorkoutId,
          name,
          exercises: workout.exercises,
        });
      } else {
        await createMutation.mutateAsync({ name, exercises: workout.exercises });
      }

      await queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
      setSavedFlag(true);
      router.back();
    } catch (error: any) {
      console.error("Error saving workout:", error);
      Bugsnag.notify(error);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const workout = workouts[0];
  const saveDisabled = !workout || isSaving;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.dark.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      {isSaving && (
        <Portal>
          <Modal visible={isSaving} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
            </View>
          </Modal>
        </Portal>
      )}
      <Stack.Screen
        options={{
          title: existingWorkoutId ? "Edit Workout" : "Create Workout",
          headerRight: () => (
            <Button
              mode="text"
              icon={SaveIcon}
              style={{ marginRight: 0 }}
              disabled={saveDisabled}
              onPressIn={handleSave}
            >
              Save
            </Button>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}>
        <ThemedView style={styles.container}>
          {workout ? (
            <WorkoutCard
              workout={workout}
              index={0}
              isFirst
              isLast
              isStandalone
              onRemove={() => {}}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
              onNameChange={changeWorkoutName}
              onAddExercise={handleAddExercise}
            />
          ) : (
            <ActivityIndicator color={Colors.dark.text} style={{ marginTop: 40 }} />
          )}
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
