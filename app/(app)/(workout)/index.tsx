import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import {
  IconButton,
  Card,
  Menu,
  Button,
  ActivityIndicator,
  Portal,
  Modal,
} from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSaveCompletedWorkoutMutation } from "@/hooks/useSaveCompletedWorkoutMutation";
import { useWorkoutSessionHistoryQuery } from "@/hooks/useCompletedWorkoutsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import Bugsnag from "@bugsnag/expo";
import SaveIcon from "@/components/SaveIcon";
import { Notes } from "@/components/Notes";
import {
  appendExercisesToWorkout,
  createStandaloneWorkout,
  linkCompletedWorkoutToWorkout,
} from "@/utils/database";
import { cancelRestNotifications } from "@/utils/restNotification";
import { useQueryClient } from "@tanstack/react-query";

export default function WorkoutOverviewScreen() {
  const { data: settings } = useSettingsQuery();
  const queryClient = useQueryClient();
  const {
    workout,
    completedSets,
    weightAndReps,
    startTime,
    activeWorkout,
    isQuickWorkout,
    deleteExercise,
    clearPersistedStore,
    restartWorkout,
    initializeWeightAndReps,
    appendedExerciseIndices,
  } = useActiveWorkoutStore();

  const weightUnit = settings?.weightUnit || "kg";
  const { data: sessionHistory } = useWorkoutSessionHistoryQuery(
    activeWorkout?.workoutId ?? 0,
    weightUnit,
  );

  useEffect(() => {
    if (sessionHistory) {
      initializeWeightAndReps(sessionHistory);
    }
  }, [sessionHistory, initializeWeightAndReps]);
  const saveCompletedWorkoutMutation =
    useSaveCompletedWorkoutMutation(weightUnit);
  const lastCompletedWorkoutIdRef = useRef<number | null>(null);

  useKeepScreenOn();

  const [isSaving, setIsSaving] = useState(false);
  const [loadingExerciseIndex, setLoadingExerciseIndex] = useState<
    number | null
  >(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [menuVisible, setMenuVisible] = useState<{ [key: number]: boolean }>(
    {},
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveWorkoutName, setSaveWorkoutName] = useState("");

  // Calculate if any sets are completed
  const hasCompletedSets = useMemo(() => {
    return Object.values(completedSets).some((exerciseSets) =>
      Object.values(exerciseSets).some((setCompleted) => setCompleted === true),
    );
  }, [completedSets]);

  const handleMenuOpen = (index: number) => {
    setMenuVisible((prev) => ({ ...prev, [index]: true }));
  };

  const handleMenuClose = (index: number) => {
    setMenuVisible((prev) => ({ ...prev, [index]: false }));
  };

  const handleExitSaveModal = () => {
    void cancelRestNotifications();
    clearPersistedStore();
    setShowSaveModal(false);
    router.push("/(app)/(tabs)");
  };

  const handleDeleteExercise = (index: number) => {
    Alert.alert(
      "Delete Exercise",
      "Are you sure you want to delete this exercise?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteExercise(index);
          },
        },
      ],
    );
  };

  const handleReplaceExercise = (index: number) => {
    // Find the exercise being replaced
    const exercise = workout?.exercises[index];
    // Navigate to the exercises screen for replacing, passing target_muscle if available
    router.push({
      pathname: "/(app)/(workout)/exercises",
      params: {
        replaceExerciseIndex: index,
        targetMuscle: exercise?.target_muscle || undefined,
      },
    });
  };

  const handleExercisePress = (index: number) => {
    if (isNavigating) return;

    setLoadingExerciseIndex(index);
    setIsNavigating(true);

    router.push({
      pathname: "/(app)/(workout)/workout-session",
      params: { selectedExerciseIndex: index },
    });

    setTimeout(() => {
      setLoadingExerciseIndex(null);
      setIsNavigating(false);
    }, 500);
  };

  const handleSaveWorkout = async () => {
    setIsSaving(true);
    try {
      const planId = activeWorkout?.planId;
      const workoutId = activeWorkout?.workoutId;
      const endTime = new Date();
      const duration = new Date(startTime)
        ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        : 0;

      // Ensure `completedSets` is initialized and properly formatted
      const totalSetsCompleted = Object.values(completedSets || {}).reduce(
        (total, exerciseSets) => {
          if (!exerciseSets || typeof exerciseSets !== "object") {
            return total;
          }
          const setsCompleted = Object.values(exerciseSets).filter(
            (setCompleted) => setCompleted === true,
          ).length;
          return total + setsCompleted;
        },
        0,
      );

      const canSave =
        workout && (isQuickWorkout || (planId != null && workoutId != null));

      if (canSave) {
        const exercises = workout!.exercises
          .map((exercise, index) => {
            const completedSetIndices = Object.entries(
              completedSets[index] || {},
            )
              .filter(([, isCompleted]) => isCompleted)
              .map(([setIndex]) => parseInt(setIndex));

            if (completedSetIndices.length === 0) {
              return null;
            }

            const sets = Object.entries(weightAndReps[index] || {})
              .filter(([setIndex]) =>
                completedSetIndices.includes(parseInt(setIndex)),
              )
              .map(([setIndex, set]) => ({
                set_number: parseInt(setIndex) + 1,
                weight: set.weight ? parseFloat(set.weight) : null,
                reps: set.reps ? parseInt(set.reps) : null,
                time: set.time ? parseInt(set.time) : null,
              }));

            return { exercise_id: exercise.exercise_id, sets };
          })
          .filter((exercise) => exercise !== null);

        await new Promise((resolve) => setTimeout(resolve, 50));

        if (exercises.length > 0) {
          saveCompletedWorkoutMutation.mutate(
            {
              planId: planId ?? null,
              workoutId: workoutId ?? null,
              duration,
              totalSetsCompleted,
              exercises,
            },
            {
              onSuccess: (completedWorkoutId) => {
                if (isQuickWorkout) {
                  lastCompletedWorkoutIdRef.current = completedWorkoutId;
                  setShowSaveModal(true);
                } else if (appendedExerciseIndices.length > 0) {
                  Alert.alert(
                    "Save Changes to Plan?",
                    `You added ${appendedExerciseIndices.length} exercise(s) during this workout. Save them to your plan for future sessions?`,
                    [
                      {
                        text: "Discard",
                        onPress: () => {
                          clearPersistedStore();
                          router.push("/(app)/(tabs)");
                        },
                      },
                      {
                        text: "Save to Plan",
                        onPress: async () => {
                          const newExercises = appendedExerciseIndices.map(
                            (i) => workout!.exercises[i],
                          );
                          try {
                            await appendExercisesToWorkout(
                              activeWorkout!.workoutId!,
                              newExercises,
                            );
                            await queryClient.invalidateQueries({
                              queryKey: ["plan", activeWorkout!.planId],
                            });
                            await queryClient.invalidateQueries({
                              queryKey: ["activePlan"],
                            });
                          } catch (e) {
                            Bugsnag.notify(e as Error);
                          }
                          clearPersistedStore();
                          router.push("/(app)/(tabs)");
                        },
                      },
                    ],
                  );
                } else {
                  clearPersistedStore();
                  router.push("/(app)/(tabs)");
                }
              },
              onError: (error) => {
                Alert.alert(
                  "Error",
                  "Failed to save workout. Please try again.",
                  [{ text: "OK" }],
                );
                Bugsnag.notify(error);
              },
            },
          );
        } else {
          console.warn("No completed exercises to save.");
        }
      } else {
        console.warn("Workout, plan ID, or workout ID is missing.");
      }
    } catch (error: any) {
      Bugsnag.notify(error);
      Alert.alert(
        "Error saving workout",
        "Unable to save your workout. Please try again later.",
      );
    } finally {
      setTimeout(() => {
        setIsSaving(false); // Hide loading overlay
      }, 500);
    }
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      "Cancel Workout",
      "Are you sure you want to cancel and delete this workout?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            void cancelRestNotifications();
            clearPersistedStore();
            // Navigate back to the main screen or home screen
            router.push("/(app)/(tabs)");
          },
        },
      ],
    );
  };

  const handleRestartWorkout = () => {
    Alert.alert(
      "Restart Workout",
      "Are you sure you want to restart this workout?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            restartWorkout();
          },
        },
      ],
    );
  };

  if (!workout) {
    return (
      <ThemedView>
        <ThemedText>No workout available</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView>
      {isSaving && (
        <Portal>
          <Modal visible={isSaving} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <ThemedText style={styles.loadingText}>
                Saving Workout...
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <Button
                mode="text"
                icon={SaveIcon}
                style={{ marginRight: 0 }}
                labelStyle={styles.buttonLabel}
                disabled={!hasCompletedSets || isSaving}
                onPressIn={handleSaveWorkout}
              >
                Finish
              </Button>
              <Menu
                visible={menuVisible[69420]}
                onDismiss={() => handleMenuClose(69420)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    size={24}
                    onPressIn={() => handleMenuOpen(69420)}
                    style={styles.optionsButton}
                    iconColor={Colors.dark.text}
                  />
                }
              >
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleRestartWorkout();
                  }}
                  title="Restart"
                />
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleCancelWorkout();
                  }}
                  title="Cancel"
                />
              </Menu>
            </View>
          ),
        }}
      />
      <Portal>
        <Modal
          visible={showSaveModal}
          onDismiss={handleExitSaveModal}
          contentContainerStyle={styles.saveModal}
        >
          <ThemedText style={styles.saveModalTitle}>
            Save this workout?
          </ThemedText>
          <ThemedText style={styles.saveModalSubtitle}>
            Give it a name to save it as a reusable workout.
          </ThemedText>
          <TextInput
            style={styles.saveModalInput}
            placeholder="Workout name"
            placeholderTextColor={Colors.dark.subText}
            value={saveWorkoutName}
            onChangeText={setSaveWorkoutName}
            autoFocus
          />
          <View style={styles.saveModalButtons}>
            <Button mode="outlined" onPress={handleExitSaveModal}>
              Discard
            </Button>
            <Button
              mode="contained"
              theme={{ colors: { primary: Colors.dark.tint } }}
              onPress={async () => {
                const name = saveWorkoutName.trim() || "Quick Workout";
                try {
                  const newWorkoutId = await createStandaloneWorkout(
                    name,
                    workout!.exercises,
                  );
                  if (lastCompletedWorkoutIdRef.current != null) {
                    await linkCompletedWorkoutToWorkout(
                      lastCompletedWorkoutIdRef.current,
                      newWorkoutId,
                    );
                  }
                  await queryClient.invalidateQueries({
                    queryKey: ["standaloneWorkouts"],
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ["completedWorkouts"],
                  });
                  handleExitSaveModal();
                } catch (e) {
                  Bugsnag.notify(e as Error);
                  Alert.alert(
                    "Error",
                    "Failed to save workout. Please try again.",
                  );
                }
              }}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
      <ScrollView style={styles.container}>
        <Notes
          noteType="workout"
          referenceId={workout?.id || 0}
          buttonType="button"
        />
        {isQuickWorkout && workout.exercises.length === 0 && (
          <View style={styles.emptyQuickWorkout}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={48}
              color={Colors.dark.subText}
            />
            <ThemedText style={styles.emptyQuickWorkoutText}>
              Add exercises to get started
            </ThemedText>
          </View>
        )}
        {workout.exercises.map((exercise, index) => {
          const completedSetsForExercise = completedSets[index] || {};
          const completedCount = Object.values(completedSetsForExercise).filter(
            (setCompleted) => setCompleted === true,
          ).length;
          const totalSets = exercise.sets.length;
          const allSetsCompleted = completedCount === totalSets;
          const isLoading = loadingExerciseIndex === index;

          const { supersetGroupId } = exercise;
          const partnerIndex = supersetGroupId
            ? workout.exercises.findIndex(
                (e, i) => i !== index && e.supersetGroupId === supersetGroupId,
              )
            : -1;
          const isFirstInSuperset = partnerIndex !== -1 && index < partnerIndex;
          const isSecondInSuperset =
            partnerIndex !== -1 && index > partnerIndex;

          return (
            <View key={exercise.exercise_id}>
              {isFirstInSuperset && (
                <View style={styles.supersetHeader}>
                  <ThemedText style={styles.supersetHeaderText}>
                    Superset
                  </ThemedText>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  handleExercisePress(index);
                }}
                style={
                  supersetGroupId
                    ? isFirstInSuperset
                      ? styles.supersetCardFirst
                      : styles.supersetCardLast
                    : undefined
                }
              >
                <Card
                  style={[styles.card, supersetGroupId && styles.supersetCard]}
                >
                  <Card.Content style={styles.cardContent}>
                    {/* Superset indicator bar */}
                    {supersetGroupId && <View style={styles.supersetBar} />}

                    {/* Circle with the number or checkmark */}
                    <View
                      style={[
                        styles.numberContainer,
                        allSetsCompleted && styles.numberContainerCompleted,
                      ]}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : allSetsCompleted ? (
                        <MaterialCommunityIcons
                          name="check"
                          size={24}
                          color="white"
                        />
                      ) : (
                        <ThemedText style={styles.numberText}>
                          {isFirstInSuperset
                            ? "A"
                            : isSecondInSuperset
                              ? "B"
                              : index + 1}
                        </ThemedText>
                      )}
                    </View>

                    {/* Exercise Info */}
                    <View style={styles.exerciseInfo}>
                      <ThemedText style={styles.exerciseName}>
                        {exercise.name}
                      </ThemedText>
                      <ThemedText style={styles.setInfo}>
                        {completedCount}/{exercise.sets.length} sets completed
                      </ThemedText>
                    </View>

                    {/* Options Menu */}
                    <Menu
                      visible={menuVisible[index]}
                      onDismiss={() => handleMenuClose(index)}
                      anchor={
                        <IconButton
                          icon="dots-vertical"
                          size={24}
                          onPress={() => handleMenuOpen(index)}
                          style={styles.optionsButton}
                          iconColor={Colors.dark.text}
                        />
                      }
                    >
                      <Menu.Item
                        onPress={() => {
                          handleMenuClose(index);
                          handleDeleteExercise(index);
                        }}
                        title="Delete"
                      />
                      <Menu.Item
                        onPress={() => {
                          handleMenuClose(index);
                          handleReplaceExercise(index);
                        }}
                        title="Replace"
                      />
                    </Menu>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
              {isFirstInSuperset && <View style={styles.supersetConnector} />}
            </View>
          );
        })}
        <Button
          mode="outlined"
          icon="plus"
          onPress={() =>
            router.push({
              pathname: "/(app)/(workout)/exercises",
              params: { mode: "append" },
            })
          }
          style={styles.addExerciseButton}
        >
          Add Exercise
        </Button>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 16,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 10,
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 10,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  numberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.dark.text,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  numberContainerCompleted: {
    backgroundColor: Colors.dark.completed,
    borderColor: Colors.dark.completed,
  },
  numberText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  exerciseInfo: {
    flex: 1,
  },
  emptyQuickWorkout: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 20,
    gap: 12,
  },
  emptyQuickWorkoutText: {
    fontSize: 16,
    color: Colors.dark.subText,
    textAlign: "center",
  },
  saveModal: {
    backgroundColor: Colors.dark.cardBackground,
    margin: 24,
    borderRadius: 12,
    padding: 24,
  },
  saveModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  saveModalSubtitle: {
    fontSize: 14,
    color: Colors.dark.subText,
    marginBottom: 16,
  },
  saveModalInput: {
    borderWidth: 1,
    borderColor: Colors.dark.subText,
    borderRadius: 8,
    padding: 10,
    color: Colors.dark.text,
    fontSize: 14,
    marginBottom: 20,
  },
  saveModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.dark.text,
  },
  setInfo: {
    fontSize: 14,
    color: Colors.dark.subText,
  },
  optionsButton: {
    padding: 0,
    marginRight: 0,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Dark transparent overlay
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: "white",
  },
  addExerciseButton: {
    marginTop: 8,
    marginBottom: 50,
  },
  supersetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  supersetHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.dark.tint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  supersetConnector: {
    width: 3,
    height: 8,
    backgroundColor: Colors.dark.tint,
    marginLeft: 27,
    marginBottom: 0,
  },
  supersetCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.tint,
  },
  supersetCardFirst: {
    marginBottom: 0,
  },
  supersetCardLast: {
    marginBottom: 10,
  },
  supersetBar: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: Colors.dark.tint,
    borderRadius: 2,
    marginRight: 10,
    marginLeft: -12,
  },
});
