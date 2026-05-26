import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import Sortable from "react-native-sortables";
import type {
  SortableGridRenderItem,
  SortableGridDragEndParams,
} from "react-native-sortables";
import {
  IconButton,
  Menu,
  Button,
  ActivityIndicator,
  Portal,
  Modal,
} from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useFocusEffect } from "expo-router";
import { Colors } from "@/constants/Colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSaveCompletedWorkoutMutation } from "@/hooks/useSaveCompletedWorkoutMutation";
import {
  useWorkoutSessionHistoryQuery,
  useGlobalExerciseHistoryForSessionQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import Bugsnag from "@bugsnag/expo";
import SaveIcon from "@/components/SaveIcon";
import { Notes } from "@/components/Notes";
import {
  updatePlanWorkoutExercises,
  updateStandaloneWorkout,
  createStandaloneWorkout,
  linkCompletedWorkoutToWorkout,
} from "@/utils/database";
import {
  cancelRestNotifications,
  scheduleRestNotificationWithCancellation,
} from "@/utils/restNotification";
import { convertTimeStrToSeconds } from "@/utils/utility";
import { useQueryClient } from "@tanstack/react-query";
import { UserExercise, Workout } from "@/store/workoutStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useTimer } from "react-timer-hook";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSoundStore } from "@/store/soundStore";

const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  children?: React.ReactNode;
  onLayout?: (event: any) => void;
}>;

type SingleItem = {
  type: "single";
  exercise: UserExercise;
  exerciseIndex: number;
};

type SupersetItem = {
  type: "superset";
  exercises: [UserExercise, UserExercise];
  exerciseIndices: [number, number];
};

type GroupedItem = SingleItem | SupersetItem;

function hasStructuralChanges(current: Workout, original: Workout): boolean {
  const toKey = (exercises: UserExercise[]) =>
    JSON.stringify(
      exercises.map((e) => ({
        exercise_id: e.exercise_id,
        sets: e.sets,
        supersetGroupId: e.supersetGroupId ?? null,
      })),
    );
  return toKey(current.exercises) !== toKey(original.exercises);
}

export default function WorkoutOverviewScreen() {
  const { data: settings } = useSettingsQuery();
  const queryClient = useQueryClient();
  const {
    workout,
    originalWorkout,
    completedSets,
    weightAndReps,
    startTime,
    activeWorkout,
    isQuickWorkout,
    deleteExercise,
    reorderExercises,
    clearPersistedStore,
    restartWorkout,
    initializeWeightAndReps,
    initializeGlobalHistory,
    removeFromSuperset,
    setDurations,
    timerRunning,
    timerExpiry,
    stopTimer,
    startTimer,
  } = useActiveWorkoutStore();

  const stableKeyMapRef = useRef(new WeakMap<UserExercise, string>());
  const getStableKey = useCallback((exercise: UserExercise): string => {
    if (!stableKeyMapRef.current.has(exercise)) {
      stableKeyMapRef.current.set(
        exercise,
        Math.random().toString(36).slice(2),
      );
    }
    return stableKeyMapRef.current.get(exercise)!;
  }, []);

  const keyExtractor = useCallback(
    (item: GroupedItem): string =>
      item.type === "single"
        ? getStableKey(item.exercise)
        : `ss-${getStableKey(item.exercises[0])}`,
    [getStableKey],
  );

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const { data: sessionHistory } = useWorkoutSessionHistoryQuery(
    activeWorkout?.workoutId ?? 0,
    weightUnit,
    distanceUnit,
  );

  useEffect(() => {
    if (sessionHistory) {
      initializeWeightAndReps(sessionHistory);
    }
  }, [sessionHistory, initializeWeightAndReps]);

  const exerciseIds = useMemo(
    () => workout?.exercises.map((e) => e.exercise_id) ?? [],
    [workout?.exercises],
  );

  const { data: globalHistory } = useGlobalExerciseHistoryForSessionQuery(
    exerciseIds,
    weightUnit,
    distanceUnit,
  );

  useEffect(() => {
    if (globalHistory) {
      initializeGlobalHistory(globalHistory);
    }
  }, [globalHistory, initializeGlobalHistory]);

  const saveCompletedWorkoutMutation = useSaveCompletedWorkoutMutation(
    weightUnit,
    distanceUnit,
  );
  const lastCompletedWorkoutIdRef = useRef<number | null>(null);

  useKeepScreenOn();

  const parsedIncrement = parseInt(settings?.restTimerIncrement || "15", 10);
  const restTimerIncrement =
    Number.isFinite(parsedIncrement) && parsedIncrement > 0
      ? parsedIncrement
      : 15;
  const { playSound, triggerVibration } = useSoundStore();
  const insets = useSafeAreaInsets();

  const isFocusedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, []),
  );

  const expiryTimestampRef = useRef<Date | null>(null);
  const timerTranslateY = useSharedValue(timerRunning ? 0 : 200);
  const timerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: timerTranslateY.value }],
  }));

  const { seconds, minutes, restart } = useTimer({
    expiryTimestamp: timerExpiry || new Date(),
    autoStart: timerRunning,
    onExpire: () => {
      stopTimer();
      if (isFocusedRef.current) {
        if (settings?.restTimerSound === "true") void playSound();
        if (settings?.restTimerVibration === "true") triggerVibration();
      }
    },
  });

  useEffect(() => {
    timerTranslateY.value = withTiming(timerRunning ? 0 : 200, {
      duration: 300,
    });
  }, [timerRunning, timerTranslateY]);

  useEffect(() => {
    if (timerRunning && timerExpiry) {
      const time = new Date(timerExpiry);
      expiryTimestampRef.current = time;
      restart(time);
    }
  }, [timerRunning, timerExpiry, restart]);

  const adjustTimerOverview = async (deltaSeconds: number) => {
    const currentRemaining = expiryTimestampRef.current
      ? Math.max(
          0,
          Math.round(
            (expiryTimestampRef.current.getTime() - Date.now()) / 1000,
          ),
        )
      : minutes * 60 + seconds;
    const newRemaining = Math.max(0, currentRemaining + deltaSeconds);
    const newExpiry = new Date();
    newExpiry.setSeconds(newExpiry.getSeconds() + newRemaining);
    expiryTimestampRef.current = newExpiry;
    startTimer(newExpiry);
    restart(newExpiry);
    if (settings?.restTimerNotification === "true") {
      await scheduleRestNotificationWithCancellation(
        newRemaining,
        "Rest Timer Finished!",
        "Time to do your next set!",
        "rest-timer1",
      );
    }
  };

  const [timerHeight, setTimerHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingExerciseIndex, setLoadingExerciseIndex] = useState<
    number | null
  >(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState<{ [key: number]: boolean }>(
    {},
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveWorkoutName, setSaveWorkoutName] = useState("");

  const groupedData = useMemo((): GroupedItem[] => {
    if (!workout) return [];
    const result: GroupedItem[] = [];
    const seen = new Set<number>();

    workout.exercises.forEach((exercise, i) => {
      if (seen.has(i)) return;
      seen.add(i);

      const { supersetGroupId } = exercise;
      if (supersetGroupId) {
        const partnerIdx = workout.exercises.findIndex(
          (e, j) => j !== i && e.supersetGroupId === supersetGroupId,
        );
        const partner =
          partnerIdx !== -1 ? workout.exercises[partnerIdx] : null;
        if (partner && !seen.has(partnerIdx)) {
          seen.add(partnerIdx);
          result.push({
            type: "superset",
            exercises: [exercise, partner],
            exerciseIndices: [i, partnerIdx],
          });
          return;
        }
      }
      result.push({ type: "single", exercise, exerciseIndex: i });
    });

    return result;
  }, [workout]);

  const itemLabels = useMemo(() => {
    let offset = 0;
    return groupedData.map((item) => {
      const label = offset + 1;
      offset += item.type === "single" ? 1 : 2;
      return label;
    });
  }, [groupedData]);

  // Calculate if any sets are completed
  const hasCompletedSets = useMemo(() => {
    return Object.values(completedSets).some((exerciseSets) =>
      Object.values(exerciseSets).some((setCompleted) => setCompleted === true),
    );
  }, [completedSets]);

  const handleMenuOpen = useCallback((index: number) => {
    setMenuVisible((prev) => ({ ...prev, [index]: true }));
  }, []);

  const handleMenuClose = useCallback((index: number) => {
    setMenuVisible((prev) => ({ ...prev, [index]: false }));
  }, []);

  const handleExitSaveModal = () => {
    void cancelRestNotifications();
    const savedId = lastCompletedWorkoutIdRef.current;
    setShowSaveModal(false);
    setIsLeaving(true);
    if (savedId == null) {
      router.push("/(app)/(tabs)");
    } else {
      router.push({
        pathname: "/(app)/(workout)/workout-summary" as any,
        params: { completedWorkoutId: String(savedId), fresh: "true" },
      });
    }
    clearPersistedStore();
  };

  const handleDeleteExercise = useCallback(
    (index: number) => {
      Alert.alert(
        t`Delete Exercise`,
        t`Are you sure you want to delete this exercise?`,
        [
          { text: t`Cancel`, style: "cancel" },
          {
            text: t`Delete`,
            style: "destructive",
            onPress: () => {
              deleteExercise(index);
            },
          },
        ],
      );
    },
    [deleteExercise],
  );

  const handleReplaceExercise = useCallback(
    (index: number) => {
      const exercise = workout?.exercises[index];
      router.push({
        pathname: "/(app)/(workout)/exercises",
        params: {
          replaceExerciseIndex: index,
          targetMuscle: exercise?.target_muscle || undefined,
        },
      });
    },
    [workout],
  );

  const handleCreateSuperset = useCallback(
    (exerciseIndex: number) => {
      handleMenuClose(exerciseIndex);
      router.push({
        pathname: "/(app)/(workout)/exercises",
        params: { supersetForIndex: exerciseIndex },
      });
    },
    [handleMenuClose],
  );

  const handleRemoveSuperset = useCallback(
    (exerciseIndex: number) => {
      handleMenuClose(exerciseIndex);
      removeFromSuperset(exerciseIndex);
    },
    [handleMenuClose, removeFromSuperset],
  );

  const handleExercisePress = useCallback(
    (index: number) => {
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
    },
    [isNavigating],
  );

  const handleOrderChange = useCallback(
    ({ data }: SortableGridDragEndParams<GroupedItem>) => {
      setMenuVisible({});
      const newExercises = data.flatMap((item) =>
        item.type === "single" ? [item.exercise] : item.exercises,
      );
      reorderExercises(newExercises);
    },
    [reorderExercises],
  );

  const renderItem: SortableGridRenderItem<GroupedItem> = useCallback(
    ({ item, index }) => {
      const renderCard = (
        exercise: UserExercise,
        exerciseIndex: number,
        label: number | string,
        isInSuperset: boolean,
        isFirstInSuperset: boolean,
        isLastInSuperset: boolean,
        isTappable: boolean,
      ) => {
        const completedSetsForExercise = completedSets[exerciseIndex] || {};
        const completedCount = Object.values(completedSetsForExercise).filter(
          Boolean,
        ).length;
        const allSetsCompleted = completedCount === exercise.sets.length;
        const isLoading = loadingExerciseIndex === exerciseIndex;

        const inner = isTappable ? (
          <Sortable.Touchable
            onTap={() => handleExercisePress(exerciseIndex)}
            style={styles.cardTouchable}
          >
            <MaterialCommunityIcons
              name="drag"
              size={20}
              color={Colors.dark.subText}
              style={styles.dragIcon}
            />
            <View
              style={[
                styles.numberContainer,
                allSetsCompleted && styles.numberContainerCompleted,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : allSetsCompleted ? (
                <MaterialCommunityIcons name="check" size={24} color="white" />
              ) : (
                <ThemedText style={styles.numberText}>{label}</ThemedText>
              )}
            </View>
            <View style={styles.exerciseInfo}>
              <ThemedText style={styles.exerciseName}>
                {exercise.name}
              </ThemedText>
              <ThemedText style={styles.setInfo}>
                <Trans>
                  {completedCount}/{exercise.sets.length} sets completed
                </Trans>
              </ThemedText>
            </View>
          </Sortable.Touchable>
        ) : (
          <View style={styles.cardTouchable}>
            <MaterialCommunityIcons
              name="drag"
              size={20}
              color={Colors.dark.subText}
              style={styles.dragIcon}
            />
            <View
              style={[
                styles.numberContainer,
                allSetsCompleted && styles.numberContainerCompleted,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : allSetsCompleted ? (
                <MaterialCommunityIcons name="check" size={24} color="white" />
              ) : (
                <ThemedText style={styles.numberText}>{label}</ThemedText>
              )}
            </View>
            <View style={styles.exerciseInfo}>
              <ThemedText style={styles.exerciseName}>
                {exercise.name}
              </ThemedText>
              <ThemedText style={styles.setInfo}>
                <Trans>
                  {completedCount}/{exercise.sets.length} sets completed
                </Trans>
              </ThemedText>
            </View>
          </View>
        );

        return (
          <View
            style={[
              styles.card,
              styles.cardRow,
              isInSuperset && styles.supersetCard,
              isFirstInSuperset && styles.supersetCardFirst,
              isLastInSuperset && styles.supersetCardLast,
            ]}
          >
            {inner}
            <Menu
              visible={!!menuVisible[exerciseIndex]}
              onDismiss={() => handleMenuClose(exerciseIndex)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={24}
                  onPress={() => handleMenuOpen(exerciseIndex)}
                  style={styles.optionsButton}
                  iconColor={Colors.dark.text}
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  handleMenuClose(exerciseIndex);
                  handleDeleteExercise(exerciseIndex);
                }}
                title={t`Delete`}
              />
              <Menu.Item
                onPress={() => {
                  handleMenuClose(exerciseIndex);
                  handleReplaceExercise(exerciseIndex);
                }}
                title={t`Replace`}
              />
              {exercise.supersetGroupId ? (
                <Menu.Item
                  onPress={() => handleRemoveSuperset(exerciseIndex)}
                  title={t`Remove Superset`}
                />
              ) : (
                <Menu.Item
                  onPress={() => handleCreateSuperset(exerciseIndex)}
                  title={t`Create Superset`}
                />
              )}
            </Menu>
          </View>
        );
      };

      const baseLabel = itemLabels[index];

      if (item.type === "single") {
        return (
          <View>
            {renderCard(
              item.exercise,
              item.exerciseIndex,
              baseLabel,
              false,
              false,
              false,
              true,
            )}
          </View>
        );
      }

      const [exA, exB] = item.exercises;
      const [idxA, idxB] = item.exerciseIndices;
      return (
        <View>
          {renderCard(exA, idxA, baseLabel, true, true, false, true)}
          <View style={styles.supersetConnector} />
          {renderCard(exB, idxB, baseLabel + 1, true, false, true, false)}
        </View>
      );
    },
    [
      completedSets,
      loadingExerciseIndex,
      menuVisible,
      handleMenuClose,
      handleMenuOpen,
      handleDeleteExercise,
      handleReplaceExercise,
      handleCreateSuperset,
      handleRemoveSuperset,
      handleExercisePress,
      itemLabels,
    ],
  );

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

      const canSave = workout && (isQuickWorkout || workoutId != null);

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
                time: set.time ? convertTimeStrToSeconds(set.time) : null,
                distance:
                  set.distance !== "" && set.distance != null
                    ? parseFloat(set.distance)
                    : null,
                is_warmup: exercise.sets[parseInt(setIndex)]?.isWarmup || false,
                is_drop_set:
                  exercise.sets[parseInt(setIndex)]?.isDropSet || false,
                is_to_failure:
                  exercise.sets[parseInt(setIndex)]?.isToFailure || false,
                set_duration:
                  setDurations?.[index]?.[parseInt(setIndex)] ?? null,
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
                const navigateToSummary = () => {
                  setIsLeaving(true);
                  router.push({
                    pathname: "/(app)/(workout)/workout-summary" as any,
                    params: {
                      completedWorkoutId: String(completedWorkoutId),
                      fresh: "true",
                    },
                  });
                  clearPersistedStore();
                };

                if (isQuickWorkout) {
                  lastCompletedWorkoutIdRef.current = completedWorkoutId;
                  setShowSaveModal(true);
                } else if (planId != null && workoutId != null) {
                  // Plan workout — prompt to save structural changes back to the plan
                  if (hasStructuralChanges(workout!, originalWorkout!)) {
                    Alert.alert(
                      t`Save Changes to Plan?`,
                      t`You modified this workout. Save those changes for future sessions?`,
                      [
                        { text: t`Discard`, onPress: navigateToSummary },
                        {
                          text: t`Save to Plan`,
                          onPress: async () => {
                            try {
                              await updatePlanWorkoutExercises(
                                workoutId,
                                workout!.exercises,
                              );
                              await queryClient.invalidateQueries({
                                queryKey: ["plan", planId],
                              });
                              await queryClient.invalidateQueries({
                                queryKey: ["activePlan"],
                              });
                            } catch (e) {
                              Bugsnag.notify(e as Error);
                            }
                            navigateToSummary();
                          },
                        },
                      ],
                    );
                  } else {
                    navigateToSummary();
                  }
                } else if (workoutId != null) {
                  // Standalone workout — prompt to save structural changes back
                  if (hasStructuralChanges(workout!, originalWorkout!)) {
                    Alert.alert(
                      t`Save Changes to Workout?`,
                      t`You modified this workout. Save those changes for future sessions?`,
                      [
                        { text: t`Discard`, onPress: navigateToSummary },
                        {
                          text: t`Save`,
                          onPress: async () => {
                            try {
                              await updateStandaloneWorkout(
                                workoutId,
                                workout!.name,
                                workout!.exercises,
                              );
                              await queryClient.invalidateQueries({
                                queryKey: ["standaloneWorkouts"],
                              });
                            } catch (e) {
                              Bugsnag.notify(e as Error);
                            }
                            navigateToSummary();
                          },
                        },
                      ],
                    );
                  } else {
                    navigateToSummary();
                  }
                } else {
                  navigateToSummary();
                }
              },
              onError: (error) => {
                Alert.alert(
                  t`Error`,
                  t`Failed to save workout. Please try again.`,
                  [{ text: t`OK` }],
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
        t`Error saving workout`,
        t`Unable to save your workout. Please try again later.`,
      );
    } finally {
      setTimeout(() => {
        setIsSaving(false); // Hide loading overlay
      }, 500);
    }
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      t`Cancel Workout`,
      t`Are you sure you want to cancel and delete this workout?`,
      [
        { text: t`No`, style: "cancel" },
        {
          text: t`Yes`,
          style: "destructive",
          onPress: () => {
            void cancelRestNotifications();
            setIsLeaving(true);
            router.push("/(app)/(tabs)");
            clearPersistedStore();
          },
        },
      ],
    );
  };

  const handleRestartWorkout = () => {
    Alert.alert(
      t`Restart Workout`,
      t`Are you sure you want to restart this workout?`,
      [
        { text: t`No`, style: "cancel" },
        {
          text: t`Yes`,
          style: "destructive",
          onPress: () => {
            restartWorkout();
          },
        },
      ],
    );
  };

  if (!workout) {
    if (isLeaving) {
      return (
        <ThemedView
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" />
        </ThemedView>
      );
    }
    return (
      <ThemedView>
        <ThemedText>
          <Trans>No workout available</Trans>
        </ThemedText>
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
                <Trans>Saving Workout...</Trans>
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
                <Trans>Finish</Trans>
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
                  title={t`Restart`}
                />
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleCancelWorkout();
                  }}
                  title={t`Cancel`}
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
          theme={{ colors: { backdrop: "rgba(0, 0, 0, 0.65)" } }}
        >
          <ThemedText style={styles.saveModalTitle}>
            <Trans>Save this workout?</Trans>
          </ThemedText>
          <ThemedText style={styles.saveModalSubtitle}>
            <Trans>Give it a name to save it as a reusable workout.</Trans>
          </ThemedText>
          <TextInput
            style={styles.saveModalInput}
            placeholder={t`Workout name`}
            placeholderTextColor={Colors.dark.subText}
            value={saveWorkoutName}
            onChangeText={setSaveWorkoutName}
            autoFocus
          />
          <View style={styles.saveModalButtons}>
            <Button mode="outlined" onPress={handleExitSaveModal}>
              <Trans>Discard</Trans>
            </Button>
            <Button
              mode="contained"
              theme={{ colors: { primary: Colors.dark.tint } }}
              onPress={async () => {
                const name = saveWorkoutName.trim() || t`Quick Workout`;
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
                    t`Error`,
                    t`Failed to save workout. Please try again.`,
                  );
                }
              }}
            >
              <Trans>Save</Trans>
            </Button>
          </View>
        </Modal>
      </Portal>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          timerRunning ? { paddingBottom: timerHeight } : undefined
        }
      >
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
              <Trans>Add exercises to get started</Trans>
            </ThemedText>
          </View>
        )}
        {groupedData.length > 0 && (
          <Sortable.Grid
            columns={1}
            data={groupedData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onDragEnd={handleOrderChange}
            showDropIndicator
          />
        )}
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
          <Trans>Add Exercise</Trans>
        </Button>
      </ScrollView>
      <AnimatedView
        pointerEvents={timerRunning ? "auto" : "none"}
        onLayout={(e) => setTimerHeight(e.nativeEvent.layout.height)}
        style={[
          styles.timerContainer,
          { paddingBottom: insets.bottom },
          timerAnimStyle,
        ]}
      >
        <ThemedText style={styles.timerLabel}>
          <Trans>Rest Time Left:</Trans>
        </ThemedText>
        <View style={styles.timerRow}>
          <TouchableOpacity
            style={styles.timerAdjustButton}
            onPress={() => void adjustTimerOverview(-restTimerIncrement)}
          >
            <ThemedText style={styles.timerAdjustText}>
              <Trans>−{restTimerIncrement}s</Trans>
            </ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.timerText}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </ThemedText>
          <TouchableOpacity
            style={styles.timerAdjustButton}
            onPress={() => void adjustTimerOverview(restTimerIncrement)}
          >
            <ThemedText style={styles.timerAdjustText}>
              <Trans>+{restTimerIncrement}s</Trans>
            </ThemedText>
          </TouchableOpacity>
        </View>
      </AnimatedView>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  dragIcon: {
    marginRight: 8,
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
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  supersetCardLast: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  timerContainer: {
    position: "absolute",
    bottom: 0,
    right: 16,
    left: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 0,
  },
  timerLabel: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 4,
    textAlign: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  timerAdjustButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardBackground2,
  },
  timerAdjustText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  timerText: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.dark.text,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 8,
  },
});
