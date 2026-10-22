import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Dimensions,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import Sortable from "react-native-sortables";
import type {
  SortableGridRenderItem,
  SortableGridDragEndParams,
} from "react-native-sortables";
import {
  Menu,
  Button,
  ActivityIndicator,
  Portal,
  Modal,
} from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { AppIcon, AppIconButton } from "@/components/ui";
import { useSaveCompletedWorkoutMutation } from "@/hooks/useSaveCompletedWorkoutMutation";
import {
  useWorkoutSessionHistoryQuery,
  useGlobalExerciseHistoryForSessionQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useWorkoutImmersiveMode } from "@/hooks/useWorkoutImmersiveMode";
import { useWorkoutBackGuard } from "@/hooks/useWorkoutBackGuard";
import { useWorkoutCompletion } from "@/hooks/useWorkoutCompletion";
import { useWorkoutChangesPrompt } from "@/hooks/useWorkoutChangesPrompt";
import { showSnackbar } from "@/store/snackbarStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { QUICK_WORKOUT_NAME } from "@/constants/quickWorkout";
import { parsePlateInventory, smallestLoadStep } from "@/utils/plateCalculator";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimate } from "@/utils/estimateWorkoutDuration";
import { MusclesWorkedRow } from "@/components/MusclesWorkedRow";
import Bugsnag from "@bugsnag/expo";
import SaveIcon from "@/components/SaveIcon";
import { Cues } from "@/components/Cues";
import SessionNoteField from "@/components/SessionNoteField";
import {
  createStandaloneWorkout,
  linkCompletedWorkoutToWorkout,
} from "@/utils/database";
import { cancelRestNotifications } from "@/utils/restNotification";
import {
  buildCompletedExercises,
  unsavedSetNotes,
} from "@/utils/completedExercises";
import { resolveWorkoutDuration } from "@/utils/staleWorkout";
import { savedWorkoutSummaryParams } from "@/utils/resumeWorkout";
import { useQueryClient } from "@tanstack/react-query";
import { UserExercise } from "@/store/workoutStore";
import RestTimerOverlay from "@/components/RestTimerOverlay";
import WorkoutTimer from "@/components/WorkoutTimer";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import React from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import RecoveryCheckInSheet from "@/components/RecoveryCheckInSheet";
import ProgressionSuggestionChip from "@/components/ProgressionSuggestionChip";
import { usePendingRecoveryQuery } from "@/hooks/usePendingRecoveryQuery";
import { useRecoveryCheckInMutation } from "@/hooks/useRecoveryCheckInMutation";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { useWorkoutProgressionStatesQuery } from "@/hooks/useWorkoutProgressionStatesQuery";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { sessionSupportsProgression } from "@/utils/progressionEligibility";
import { useSessionPRs } from "@/hooks/useSessionPRs";
import { instanceName } from "@/utils/exerciseInstance";
import { useCompleteSet } from "@/hooks/useCompleteSet";
import { useRestTimerControls } from "@/hooks/useRestTimerControls";
import { useLoggingStyle } from "@/hooks/useLoggingStyle";
import { ListViewHint } from "@/components/workout/ListViewHint";
import {
  QueuedFeedbackCard,
  useHasQueuedFeedback,
} from "@/components/workout/QueuedFeedbackCard";
import {
  OverviewSetRows,
  SupersetRoundRows,
} from "@/components/workout/OverviewSetRows";
import {
  confirmUnfinishedSets,
  findUnfinishedSets,
} from "@/utils/confirmUnfinishedSets";
import {
  groupExercisesBySuperset,
  type GroupedExerciseItem,
} from "@/utils/supersetUtils";

const FEEDBACK_CARD_MAX_HEIGHT = Dimensions.get("window").height * 0.25;

export default function WorkoutOverviewScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: settings } = useSettingsQuery();
  const queryClient = useQueryClient();
  const {
    workout,
    originalWorkout,
    completedSets,
    weightAndReps,
    startTime,
    lastActivityAt,
    activeWorkout,
    isQuickWorkout,
    deleteExercise,
    reorderExercises,
    clearPersistedStore,
    restartWorkout,
    initializeWeightAndReps,
    initializeGlobalHistory,
    loadProgressionSuggestions,
    removeFromSuperset,
    setDurations,
    sessionNote,
    setSessionNote,
    setNotes,
    timerRunning,
    feedbackSubmittedUweIds,
    recoveryCheckInShown,
    markRecoveryCheckInShown,
  } = useActiveWorkoutStore();

  const recoverySheetRef = useRef<BottomSheetModal>(null);
  const progressionSettings = useProgressionSettingsQuery();
  const {
    isCurrentWeekDeload,
    isDeloadWeekOf,
    isLoading: deloadWeekLoading,
  } = useDeloadWeekQuery(activeWorkout?.planId ?? undefined);
  const { data: pendingRecovery } = usePendingRecoveryQuery(
    activeWorkout?.workoutId ?? undefined,
  );
  const { mutate: submitRecovery } = useRecoveryCheckInMutation();
  // A set row finishing an exercise queues its feedback card here too.
  const hasQueuedFeedback = useHasQueuedFeedback();

  useEffect(() => {
    if (
      !recoveryCheckInShown &&
      progressionSettings.enabled &&
      sessionSupportsProgression({
        workoutId: activeWorkout?.workoutId,
        isQuickWorkout,
      }) &&
      pendingRecovery &&
      pendingRecovery.length > 0
    ) {
      markRecoveryCheckInShown();
      recoverySheetRef.current?.present();
    }
  }, [
    pendingRecovery,
    progressionSettings.enabled,
    activeWorkout?.workoutId,
    isQuickWorkout,
    recoveryCheckInShown,
    markRecoveryCheckInShown,
  ]);

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
    (item: GroupedExerciseItem): string =>
      item.type === "single"
        ? getStableKey(item.exercise)
        : `ss-${getStableKey(item.exercises[0])}`,
    [getStableKey],
  );

  const weightUnit = settings?.weightUnit || "kg";
  const { style: loggingStyle, setStyle: setLoggingStyle } = useLoggingStyle();
  const lbsStep = useMemo(
    () =>
      smallestLoadStep(parsePlateInventory(settings?.plateInventoryLbs, "lbs")),
    [settings?.plateInventoryLbs],
  );
  const distanceUnit = settings?.distanceUnit || "m";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const { estimate: durationEstimate } = useWorkoutDurationEstimate(
    workout?.exercises ?? [],
    countUnilateralDouble,
  );
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

  const { prs: sessionPRs } = useSessionPRs();
  const completeSetApi = useCompleteSet();
  const { shownValues } = completeSetApi;
  // Read through a ref so the memoized cards do not rebuild every render.
  const completeSetApiRef = useRef(completeSetApi);
  completeSetApiRef.current = completeSetApi;

  const { data: workoutProgressionStates } = useWorkoutProgressionStatesQuery(
    progressionSettings.enabled
      ? (activeWorkout?.workoutId ?? undefined)
      : undefined,
    isCurrentWeekDeload,
  );

  useEffect(() => {
    if (!sessionHistory || !workoutProgressionStates?.length) return;
    loadProgressionSuggestions(workoutProgressionStates, weightUnit, lbsStep);
  }, [
    sessionHistory,
    workoutProgressionStates,
    loadProgressionSuggestions,
    weightUnit,
    lbsStep,
  ]);

  const progressionStatesByUweId = useMemo(
    () =>
      new Map(
        (workoutProgressionStates ?? []).map((s) => [
          s.userWorkoutExerciseId,
          s,
        ]),
      ),
    [workoutProgressionStates],
  );

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

  const { ask: askWhichChanges, prompt: changesPrompt } =
    useWorkoutChangesPrompt();
  const completeWorkout = useWorkoutCompletion(askWhichChanges);
  const saveCompletedWorkoutMutation = useSaveCompletedWorkoutMutation(
    weightUnit,
    distanceUnit,
  );
  const lastCompletedWorkoutIdRef = useRef<number | null>(null);
  // Set when the saved duration was capped at the last logged set, so the
  // summary can say so.
  const durationTrimmedRef = useRef(false);
  const summaryParams = (completedWorkoutId: number) => ({
    completedWorkoutId: String(completedWorkoutId),
    fresh: "true",
    ...(durationTrimmedRef.current ? { durationTrimmed: "true" } : {}),
  });

  useKeepScreenOn();
  useWorkoutImmersiveMode();

  const restTimer = useRestTimerControls();

  const [timerHeight, setTimerHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  // Saved and asking about plan changes: Finish must not leave a second time.
  const isCompletingRef = useRef(false);
  const [loadingExerciseIndex, setLoadingExerciseIndex] = useState<
    number | null
  >(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  // Mirrors isLeaving synchronously so the back guard sees it during the
  // navigation that Finish/Cancel start.
  const isLeavingRef = useRef(false);
  const markLeaving = useCallback(() => {
    isLeavingRef.current = true;
    setIsLeaving(true);
  }, []);
  useWorkoutBackGuard(isLeavingRef);
  const [menuVisible, setMenuVisible] = useState<{ [key: number]: boolean }>(
    {},
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveWorkoutName, setSaveWorkoutName] = useState("");

  const groupedData = useMemo(
    () => (workout ? groupExercisesBySuperset(workout.exercises) : []),
    [workout],
  );

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
    markLeaving();
    if (savedId == null) {
      router.push("/(app)/(tabs)");
      clearPersistedStore();
    } else {
      router.push({
        pathname: "/(app)/(workout)/workout-summary" as any,
        params: summaryParams(savedId),
      });
    }
  };

  // No confirmation: the snackbar offers Undo.
  const handleDeleteExercise = useCallback(
    (index: number) => {
      const snapshot = useActiveWorkoutStore.getState().snapshotExercise(index);
      deleteExercise(index);
      if (!snapshot) return;
      showSnackbar(t`Exercise removed`, {
        duration: 5000,
        action: {
          label: t`Undo`,
          onPress: () =>
            useActiveWorkoutStore.getState().restoreExercise(snapshot),
        },
      });
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

      router.push(
        loggingStyle === "list"
          ? {
              pathname: "/(app)/(workout)/exercise-list",
              params: { exerciseIndex: index },
            }
          : {
              pathname: "/(app)/(workout)/workout-session",
              params: { selectedExerciseIndex: index },
            },
      );

      setTimeout(() => {
        setLoadingExerciseIndex(null);
        setIsNavigating(false);
      }, 500);
    },
    [isNavigating, loggingStyle],
  );

  // Open set lists, by the exercise's stable key; not persisted.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleOpenSet = useCallback(
    ({
      exerciseIndex,
      setIndex,
    }: {
      exerciseIndex: number;
      setIndex: number;
    }) => {
      if (isNavigating) return;
      setIsNavigating(true);
      router.push({
        pathname: "/(app)/(workout)/workout-session",
        params: {
          selectedExerciseIndex: exerciseIndex,
          selectedSetIndex: setIndex,
        },
      });
      setTimeout(() => setIsNavigating(false), 500);
    },
    [isNavigating],
  );

  const handleCompleteSetRow = useCallback(
    ({
      exerciseIndex,
      setIndex,
    }: {
      exerciseIndex: number;
      setIndex: number;
    }) => completeSetApiRef.current.completeSetInPlace(exerciseIndex, setIndex),
    [],
  );

  const handleOrderChange = useCallback(
    ({ data }: SortableGridDragEndParams<GroupedExerciseItem>) => {
      setMenuVisible({});
      const newExercises = data.flatMap((item) =>
        item.type === "single" ? [item.exercise] : item.exercises,
      );
      reorderExercises(newExercises);
    },
    [reorderExercises],
  );

  const renderItem: SortableGridRenderItem<GroupedExerciseItem> = useCallback(
    ({ item, index }) => {
      const renderCard = (
        exercise: UserExercise,
        exerciseIndex: number,
        label: number | string,
        isInSuperset: boolean,
        isFirstInSuperset: boolean,
        isLastInSuperset: boolean,
        isTappable: boolean,
        expandKey: string | null,
        footer: React.ReactNode,
      ) => {
        const completedSetsForExercise = completedSets[exerciseIndex] || {};
        const completedCount = Object.values(completedSetsForExercise).filter(
          Boolean,
        ).length;
        const allSetsCompleted = completedCount === exercise.sets.length;
        const isLoading = loadingExerciseIndex === exerciseIndex;
        const prCount = sessionPRs[exerciseIndex]?.length ?? 0;
        const setInfo = (
          <View style={styles.setInfoRow}>
            <ThemedText style={styles.setInfo}>
              <Trans>
                {completedCount}/{exercise.sets.length} sets completed
              </Trans>
            </ThemedText>
            {prCount > 0 && (
              <View
                style={styles.prBadge}
                accessible={true}
                accessibilityLabel={t`New personal record`}
              >
                <AppIcon
                  set="mci"
                  name="trophy"
                  size={12}
                  color={colors.onAccent}
                />
                <ThemedText style={styles.prBadgeText}>
                  <Trans>PR</Trans>
                </ThemedText>
              </View>
            )}
          </View>
        );

        const progressionState =
          exercise.id != null
            ? progressionStatesByUweId.get(exercise.id)
            : undefined;
        const suppressedByFeedback =
          exercise.id != null && feedbackSubmittedUweIds.includes(exercise.id);
        const progressionChip =
          progressionState &&
          progressionState.suggestionAction !== "hold" &&
          !suppressedByFeedback ? (
            <ProgressionSuggestionChip
              action={progressionState.suggestionAction}
              suggestedWeight={progressionState.suggestedWeight}
              suggestedRepsPerSet={progressionState.suggestedRepsPerSet}
              weightUnit={weightUnit}
            />
          ) : null;

        const inner = isTappable ? (
          <Sortable.Touchable
            accessibilityRole="button"
            onTap={() => handleExercisePress(exerciseIndex)}
            testID={`workout-exercise-${exerciseIndex}`}
            style={styles.cardTouchable}
          >
            <AppIcon
              set="mci"
              name="drag"
              size={20}
              color={colors.contentSecondary}
              style={styles.dragIcon}
            />
            <View
              style={[
                styles.numberContainer,
                allSetsCompleted && styles.numberContainerCompleted,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.contentPrimary} />
              ) : allSetsCompleted ? (
                <AppIcon
                  set="mci"
                  name="check"
                  size={24}
                  color={colors.contentPrimary}
                />
              ) : (
                <ThemedText style={styles.numberText}>{label}</ThemedText>
              )}
            </View>
            <View style={styles.exerciseInfo}>
              <ThemedText style={styles.exerciseName}>
                {instanceName(
                  workout?.exercises ?? [],
                  exerciseIndex,
                  exercise.name,
                )}
              </ThemedText>
              {setInfo}
              {progressionChip}
            </View>
          </Sortable.Touchable>
        ) : (
          <View style={styles.cardTouchable}>
            <AppIcon
              set="mci"
              name="drag"
              size={20}
              color={colors.contentSecondary}
              style={styles.dragIcon}
            />
            <View
              style={[
                styles.numberContainer,
                allSetsCompleted && styles.numberContainerCompleted,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.contentPrimary} />
              ) : allSetsCompleted ? (
                <AppIcon
                  set="mci"
                  name="check"
                  size={24}
                  color={colors.contentPrimary}
                />
              ) : (
                <ThemedText style={styles.numberText}>{label}</ThemedText>
              )}
            </View>
            <View style={styles.exerciseInfo}>
              <ThemedText style={styles.exerciseName}>
                {instanceName(
                  workout?.exercises ?? [],
                  exerciseIndex,
                  exercise.name,
                )}
              </ThemedText>
              {setInfo}
              {progressionChip}
            </View>
          </View>
        );

        const isExpanded = expandKey != null && !!expanded[expandKey];
        return (
          <View
            style={[
              styles.card,
              isInSuperset && styles.supersetCard,
              isFirstInSuperset && styles.supersetCardFirst,
              isLastInSuperset && styles.supersetCardLast,
            ]}
          >
            <View style={styles.cardRow}>
              {inner}
              {expandKey != null && (
                <Sortable.Touchable
                  onTap={() => toggleExpanded(expandKey)}
                  style={styles.expandButton}
                  testID={`workout-exercise-expand-${exerciseIndex}`}
                  accessible
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityLabel={
                    isInSuperset ? t`Show rounds` : t`Show sets`
                  }
                >
                  <AppIcon
                    set="mci"
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={colors.contentSecondary}
                  />
                </Sortable.Touchable>
              )}
              <Menu
                visible={!!menuVisible[exerciseIndex]}
                onDismiss={() => handleMenuClose(exerciseIndex)}
                anchor={
                  <AppIconButton
                    accessibilityLabel={t`Options for ${exercise.name}`}
                    testID={`workout-exercise-menu-${exerciseIndex}`}
                    icon="dots-vertical"
                    size={24}
                    onPress={() => handleMenuOpen(exerciseIndex)}
                    style={styles.optionsButton}
                    iconColor={colors.contentPrimary}
                  />
                }
              >
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(exerciseIndex);
                    handleDeleteExercise(exerciseIndex);
                  }}
                  title={t`Delete`}
                  testID="exercise-menu-delete"
                />
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(exerciseIndex);
                    handleReplaceExercise(exerciseIndex);
                  }}
                  title={t`Replace`}
                  testID="exercise-menu-replace"
                />
                {exercise.supersetGroupId ? (
                  <Menu.Item
                    onPress={() => handleRemoveSuperset(exerciseIndex)}
                    title={t`Remove Superset`}
                    testID="exercise-menu-remove-superset"
                  />
                ) : (
                  <Menu.Item
                    onPress={() => handleCreateSuperset(exerciseIndex)}
                    title={t`Create Superset`}
                    testID="exercise-menu-create-superset"
                  />
                )}
              </Menu>
            </View>
            {footer}
          </View>
        );
      };

      const rowProps = {
        getValues: shownValues,
        completedSets,
        sessionPRs,
        weightUnit,
        distanceUnit,
        onOpenSet: handleOpenSet,
        onCompleteSet: handleCompleteSetRow,
      };

      const baseLabel = itemLabels[index];

      if (item.type === "single") {
        const key = getStableKey(item.exercise);
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
              key,
              expanded[key] ? (
                <OverviewSetRows
                  exercise={item.exercise}
                  exerciseIndex={item.exerciseIndex}
                  {...rowProps}
                />
              ) : null,
            )}
          </View>
        );
      }

      const [exA, exB] = item.exercises;
      const [idxA, idxB] = item.exerciseIndices;
      const key = `ss-${getStableKey(exA)}`;
      const exercises = workout?.exercises ?? [];
      return (
        <View>
          {renderCard(exA, idxA, baseLabel, true, true, false, true, key, null)}
          <View style={styles.supersetConnector} />
          {renderCard(
            exB,
            idxB,
            baseLabel + 1,
            true,
            false,
            true,
            false,
            null,
            expanded[key] ? (
              <SupersetRoundRows
                exercises={item.exercises}
                exerciseIndices={item.exerciseIndices}
                names={[
                  instanceName(exercises, idxA, exA.name),
                  instanceName(exercises, idxB, exB.name),
                ]}
                {...rowProps}
              />
            ) : null,
          )}
        </View>
      );
    },
    [
      workout?.exercises,
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
      progressionStatesByUweId,
      feedbackSubmittedUweIds,
      sessionPRs,
      styles,
      colors,
      weightUnit,
      distanceUnit,
      expanded,
      toggleExpanded,
      getStableKey,
      handleOpenSet,
      handleCompleteSetRow,
      shownValues,
    ],
  );

  // Finish saves completed sets only, so say what would be left behind.
  const handleFinishPress = () => {
    if (isSavingRef.current || isCompletingRef.current) return;
    if (savedWorkoutSummaryParams() || !workout) {
      void handleSaveWorkout();
      return;
    }
    confirmUnfinishedSets(
      findUnfinishedSets(workout.exercises, completedSets),
      () => void handleSaveWorkout(),
    );
  };

  const handleSaveWorkout = async () => {
    if (isSavingRef.current || isCompletingRef.current) return;
    // Saved already, then killed during a post-save prompt: never save twice.
    const savedParams = savedWorkoutSummaryParams();
    if (savedParams) {
      markLeaving();
      router.push({
        pathname: "/(app)/(workout)/workout-summary" as any,
        params: savedParams,
      });
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);
    let mutateStarted = false;
    try {
      const planId = activeWorkout?.planId;
      const workoutId = activeWorkout?.workoutId;
      // A workout left for hours is saved up to its last logged set, not now.
      const {
        seconds: duration,
        trimmed,
        endedAt,
      } = resolveWorkoutDuration({
        startTime,
        lastActivityAt,
      });
      durationTrimmedRef.current = trimmed;

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
        const session = {
          exercises: workout!.exercises,
          completedSets,
          weightAndReps,
          setDurations,
          setNotes,
        };
        const exercises = buildCompletedExercises(session);
        // Only completed sets are saved; keep notes on the others in the
        // session note rather than dropping them.
        const notes = [
          sessionNote.trim(),
          ...unsavedSetNotes(session).map(
            ({ exerciseName, setNumber, note }) =>
              t`${exerciseName}, set ${setNumber}: ${note}`,
          ),
        ]
          .filter(Boolean)
          .join("\n");

        if (exercises.length > 0) {
          mutateStarted = true;
          saveCompletedWorkoutMutation.mutate(
            {
              planId: planId ?? null,
              workoutId: workoutId ?? null,
              duration,
              totalSetsCompleted,
              // The week it was trained in, which a stale save can have left.
              isDeload: planId != null && isDeloadWeekOf(endedAt ?? new Date()),
              exercises,
              // A stale workout counts towards the day it was trained.
              completedAt: endedAt ?? undefined,
              notes,
            },
            {
              onSuccess: async (completedWorkoutId) => {
                // First, before any prompt below gives the app a chance to be
                // killed with the session still in the store.
                useActiveWorkoutStore
                  .getState()
                  .setSavedCompletedWorkoutId(completedWorkoutId, trimmed);
                isCompletingRef.current = true;
                const outcome = await completeWorkout({
                  isQuickWorkout,
                  planId,
                  workoutId,
                  workout: workout!,
                  originalWorkout,
                });
                if (outcome.next === "quickSave") {
                  isCompletingRef.current = false;
                  lastCompletedWorkoutIdRef.current = completedWorkoutId;
                  setShowSaveModal(true);
                  return;
                }
                if (outcome.updateFailed) {
                  showSnackbar(
                    t`Your workout was saved, but the plan could not be updated.`,
                  );
                }
                markLeaving();
                router.push({
                  pathname: "/(app)/(workout)/workout-summary" as any,
                  params: summaryParams(completedWorkoutId),
                });
              },
              onError: (error) => {
                Alert.alert(
                  t`Error`,
                  t`Failed to save workout. Please try again.`,
                  [{ text: t`OK` }],
                );
                Bugsnag.notify(error);
              },
              onSettled: () => {
                isSavingRef.current = false;
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
        setIsSaving(false);
        if (!mutateStarted) {
          isSavingRef.current = false;
        }
      }, 500);
    }
  };

  // "Finish and save" on the stale-workout prompt lands here with finish=true.
  const { finish } = useLocalSearchParams<{ finish?: string }>();
  const autoFinishStartedRef = useRef(false);
  useEffect(() => {
    if (finish !== "true" || autoFinishStartedRef.current) return;
    if (!workout || !hasCompletedSets) return;
    // The save converts units and tags deload weeks, so wait for both.
    if (!settings || deloadWeekLoading) return;
    autoFinishStartedRef.current = true;
    // The ref only covers this mount; dropping the param stops a remount
    // (or a return here after a failed save) from saving a second time.
    router.setParams({ finish: undefined });
    void handleSaveWorkout();
    // Runs once per visit; handleSaveWorkout is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, workout, hasCompletedSets, settings, deloadWeekLoading]);

  const handleCancelWorkout = () => {
    Alert.alert(
      t`Discard workout?`,
      t`Your sets from this session will not be saved.`,
      [
        { text: t`Keep training`, style: "cancel" },
        {
          text: t`Discard`,
          style: "destructive",
          onPress: () => {
            void cancelRestNotifications();
            markLeaving();
            router.push("/(app)/(tabs)");
            clearPersistedStore();
          },
        },
      ],
    );
  };

  const handleRestartWorkout = () => {
    Alert.alert(
      t`Restart workout?`,
      t`Your sets from this session will be cleared.`,
      [
        { text: t`Keep training`, style: "cancel" },
        {
          text: t`Restart`,
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
              <ActivityIndicator size="large" color={colors.contentPrimary} />
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
              <WorkoutTimer />
              <Button
                mode="text"
                icon={SaveIcon}
                style={{ marginRight: 0 }}
                labelStyle={styles.buttonLabel}
                disabled={!hasCompletedSets || isSaving}
                testID="workout-finish"
                onPressIn={handleFinishPress}
              >
                <Trans>Finish</Trans>
              </Button>
              <Menu
                visible={menuVisible[69420]}
                onDismiss={() => handleMenuClose(69420)}
                anchor={
                  <AppIconButton
                    accessibilityLabel={t`Workout options`}
                    testID="workout-options"
                    icon="dots-vertical"
                    size={24}
                    onPressIn={() => handleMenuOpen(69420)}
                    style={styles.optionsButton}
                    iconColor={colors.contentPrimary}
                  />
                }
              >
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    void setLoggingStyle(
                      loggingStyle === "list" ? "focus" : "list",
                    );
                  }}
                  title={
                    loggingStyle === "list"
                      ? t`Show one set at a time`
                      : t`Show sets as a list`
                  }
                  testID="workout-options-logging-style"
                />
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleRestartWorkout();
                  }}
                  title={t`Restart`}
                  testID="workout-options-restart"
                />
                <Menu.Item
                  onPress={() => {
                    handleMenuClose(69420);
                    handleCancelWorkout();
                  }}
                  title={t`Discard workout`}
                  testID="workout-options-discard"
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
          theme={{ colors: { backdrop: colors.modalBackdrop } }}
        >
          <ThemedText style={styles.saveModalTitle}>
            <Trans>Save as a reusable workout?</Trans>
          </ThemedText>
          <ThemedText style={styles.saveModalSubtitle}>
            <Trans>
              Your session is saved. Give it a name to reuse it later.
            </Trans>
          </ThemedText>
          <TextInput
            accessibilityLabel={t`Workout name`}
            testID="save-workout-name"
            style={styles.saveModalInput}
            placeholder={t`Workout name`}
            placeholderTextColor={colors.contentSecondary}
            value={saveWorkoutName}
            onChangeText={setSaveWorkoutName}
            autoFocus
          />
          <View style={styles.saveModalButtons}>
            <Button
              mode="outlined"
              testID="save-workout-not-now"
              onPress={handleExitSaveModal}
            >
              <Trans>Not now</Trans>
            </Button>
            <Button
              mode="contained"
              theme={{ colors: { primary: colors.accent } }}
              testID="save-workout-save"
              onPress={async () => {
                // The fallback is stored in English and translated on display.
                const name = saveWorkoutName.trim() || QUICK_WORKOUT_NAME;
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
        {workout.exercises.length > 0 && <ListViewHint />}
        {/* In the rest overlay while resting, otherwise at the top. */}
        {hasQueuedFeedback && !timerRunning && (
          <View style={styles.feedbackCard}>
            <QueuedFeedbackCard />
          </View>
        )}
        {workout.exercises.length > 0 && durationEstimate != null && (
          <ThemedText style={styles.durationEstimate}>
            <Trans>
              Estimated Duration: {formatDurationEstimate(durationEstimate)}
            </Trans>
          </ThemedText>
        )}
        {/* A quick workout is built as you go, so its balance is worth a look. */}
        {isQuickWorkout && <MusclesWorkedRow exercises={workout.exercises} />}
        <View style={styles.notesRow}>
          {/* A written note takes the row's width, beside the Cues button. */}
          <View style={sessionNote.trim() ? styles.noteFilled : undefined}>
            <SessionNoteField note={sessionNote} onSave={setSessionNote} />
          </View>
          {/* A quick workout has no template to hang cues on. */}
          {!isQuickWorkout && !!workout.id && (
            <View>
              <Cues
                noteType="workout"
                referenceId={workout.id}
                buttonType="button"
              />
            </View>
          )}
        </View>
        {isQuickWorkout && workout.exercises.length === 0 && (
          <View style={styles.emptyQuickWorkout}>
            <AppIcon
              set="mci"
              name="dumbbell"
              size={48}
              color={colors.contentSecondary}
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
          testID="workout-add-exercise"
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
      <RestTimerOverlay
        minutes={restTimer.minutes}
        seconds={restTimer.seconds}
        increment={restTimer.increment}
        timerRunning={timerRunning}
        animStyle={restTimer.animStyle}
        buttonSize={restTimer.buttonSize}
        onAdjust={(delta) => void restTimer.adjust(delta)}
        onSkip={restTimer.skip}
        hint={restTimer.hint}
        hintAction={restTimer.hintAction}
        onLayout={(e) => setTimerHeight(e.nativeEvent.layout.height)}
        containerStyle={styles.restOverlay}
        topContent={
          timerRunning && hasQueuedFeedback ? (
            <ScrollView
              style={styles.feedbackCardScroll}
              keyboardShouldPersistTaps="handled"
            >
              <QueuedFeedbackCard />
            </ScrollView>
          ) : null
        }
      />
      {pendingRecovery && pendingRecovery.length > 0 && (
        <RecoveryCheckInSheet
          ref={recoverySheetRef}
          pendingCheckIns={pendingRecovery}
          onSubmit={(payloads) => submitRecovery(payloads)}
        />
      )}
      {changesPrompt}
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
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
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    feedbackCard: {
      marginBottom: 12,
    },
    feedbackCardScroll: {
      flexGrow: 0,
      maxHeight: FEEDBACK_CARD_MAX_HEIGHT,
    },
    expandButton: {
      width: 40,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
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
      borderRadius: radii.full,
      borderWidth: 2,
      borderColor: colors.contentPrimary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    numberContainerCompleted: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    numberText: {
      fontSize: 18,
      color: colors.contentPrimary,
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
      color: colors.contentSecondary,
      textAlign: "center",
    },
    durationEstimate: {
      fontSize: 13,
      color: colors.contentSecondary,
      marginTop: 4,
      marginBottom: 4,
    },
    notesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 16,
    },
    // The exercise cards use colors.card; the rest panel over them must not.
    restOverlay: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.accentBorderStrong,
    },
    noteFilled: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 160,
    },
    saveModal: {
      backgroundColor: colors.card,
      margin: 24,
      borderRadius: radii.lg,
      padding: 24,
    },
    saveModalTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 8,
    },
    saveModalSubtitle: {
      fontSize: 14,
      color: colors.contentSecondary,
      marginBottom: 16,
    },
    saveModalInput: {
      borderWidth: 1,
      borderColor: colors.contentSecondary,
      borderRadius: radii.md,
      padding: 10,
      color: colors.contentPrimary,
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
      color: colors.contentPrimary,
    },
    setInfo: {
      fontSize: 14,
      color: colors.contentSecondary,
    },
    setInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    prBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 6,
      borderRadius: radii.sm,
      backgroundColor: colors.accent,
    },
    prBadgeText: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      color: colors.onAccent,
    },
    optionsButton: {
      padding: 0,
      marginRight: 0,
    },
    loadingOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.modalBackdrop,
      position: "absolute",
      width: "100%",
      height: "100%",
    },
    loadingText: {
      marginTop: 10,
      fontSize: 18,
      color: colors.contentPrimary,
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
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    supersetConnector: {
      width: 3,
      height: 8,
      backgroundColor: colors.accent,
      marginLeft: 27,
      marginBottom: 0,
    },
    supersetCard: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
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
  });
}
