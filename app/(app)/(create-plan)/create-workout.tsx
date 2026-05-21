import { useEffect, useRef, useState } from "react";
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
import {
  router,
  Stack,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
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
  const { workoutId: workoutIdParam } = useLocalSearchParams<{
    workoutId?: string;
  }>();
  const existingWorkoutId = workoutIdParam ? Number(workoutIdParam) : null;

  const [isSaving, setIsSaving] = useState(false);
  const savedRef = useRef(false);
  const initializedWorkoutId = useRef<number | null | undefined>(undefined);

  const {
    workouts,
    clearWorkouts,
    addWorkout,
    changeWorkoutName,
    setWorkouts,
    saveDraftEntry,
    clearDraftEntry,
    clearDraft,
  } = useWorkoutStore();

  const draftKey =
    existingWorkoutId !== null
      ? `standalone:${existingWorkoutId}`
      : "standalone:null";

  const { data: standaloneWorkouts } = useStandaloneWorkoutsQuery();
  const createMutation = useCreateStandaloneWorkout();
  const updateMutation = useUpdateStandaloneWorkout();

  // 'pending' until draft check resolves; then 'continue' or 'fresh'
  const [draftDecision, setDraftDecision] = useState<
    "pending" | "continue" | "fresh"
  >("pending");

  // Check for a persisted draft once on mount, after store hydrates
  useEffect(() => {
    const checkDraft = () => {
      const { drafts } = useWorkoutStore.getState();
      const draft = drafts[draftKey];
      const hasDraft =
        !!draft &&
        draft.workouts.length > 0 &&
        (draft.workouts[0].exercises.length > 0 ||
          draft.workouts[0].name.trim() !== "");

      if (hasDraft) {
        Alert.alert(
          "Continue Editing?",
          "You have unsaved changes from your last session. Would you like to continue?",
          [
            {
              text: "Discard Changes",
              style: "destructive",
              onPress: () => {
                clearDraftEntry(draftKey);
                clearDraft();
                setDraftDecision("fresh");
              },
            },
            {
              text: "Continue",
              onPress: () => {
                setWorkouts(draft.workouts);
                initializedWorkoutId.current = existingWorkoutId ?? null;
                setDraftDecision("continue");
              },
            },
          ],
        );
      } else {
        setDraftDecision("fresh");
      }
    };

    if (useWorkoutStore.persist.hasHydrated()) {
      checkDraft();
    } else {
      const unsub = useWorkoutStore.persist.onFinishHydration(checkDraft);
      return unsub;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on every change so it survives app close
  useEffect(() => {
    if (draftDecision === "pending") return;
    const workout = workouts[0];
    if (!workout || (!workout.exercises.length && !workout.name.trim())) return;
    saveDraftEntry(draftKey, { workouts });
  }, [workouts, draftDecision]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise workoutStore for this screen — runs once per workout id
  useEffect(() => {
    if (draftDecision === "pending" || draftDecision === "continue") return;

    const sentinel = existingWorkoutId ?? null;
    if (initializedWorkoutId.current === sentinel) return;
    if (existingWorkoutId && standaloneWorkouts) {
      const existing = standaloneWorkouts.find(
        (w) => w.id === existingWorkoutId,
      );
      if (existing) {
        initializedWorkoutId.current = sentinel;
        setWorkouts([existing]);
        return;
      }
    } else if (existingWorkoutId && !standaloneWorkouts) {
      // wait for data to arrive before marking initialized
      return;
    }
    initializedWorkoutId.current = sentinel;
    clearWorkouts();
    addWorkout({ name: "", exercises: [], id: -Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftDecision, existingWorkoutId, standaloneWorkouts]);

  // Guard back-navigation when there are unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      if (savedRef.current) {
        savedRef.current = false;
        clearDraftEntry(draftKey);
        clearDraft();
        return navigation.dispatch(e.data.action);
      }

      const workout = workouts[0];
      if (!workout || (!workout.exercises.length && !workout.name.trim())) {
        clearDraftEntry(draftKey);
        clearDraft();
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
              clearDraftEntry(draftKey);
              clearDraft();
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, workouts, clearDraft, clearDraftEntry, draftKey]);

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
        await createMutation.mutateAsync({
          name,
          exercises: workout.exercises,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
      clearDraftEntry(draftKey);
      savedRef.current = true;
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
              onPress={handleSave}
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
            <ActivityIndicator
              color={Colors.dark.text}
              style={{ marginTop: 40 }}
            />
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
