import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ActivityIndicator } from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import SessionSetInfo from "@/components/SessionSetInfo";
import { useTimer } from "react-timer-hook";
import { Colors } from "@/constants/Colors";
import { Stack, useLocalSearchParams } from "expo-router";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WorkoutTimer from "@/components/WorkoutTimer";
import Bugsnag from "@bugsnag/expo";
import {
  cancelRestNotifications,
  scheduleRestNotificationWithCancellation,
} from "@/utils/restNotification";
import { Notes } from "@/components/Notes";
import { findSupersetPartnerIndex } from "@/utils/supersetUtils";
import { UserExercise } from "@/store/workoutStore";
import { useSoundStore } from "@/store/soundStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

// Reanimated 4: Animated.View types don't include children in strict TS
const AnimatedView = Animated.View as unknown as React.ComponentType<{
  style?: any;
  children?: React.ReactNode;
}>;

const SCREEN_WIDTH = Dimensions.get("window").width;
const COMMIT_DISTANCE = SCREEN_WIDTH * 0.3;
const COMMIT_VELOCITY = 500;

interface OutgoingSnapshot {
  exercise_id: number;
  exerciseName: string;
  currentSetIndex: number;
  totalSets: number;
  weight: string;
  reps: string;
  time: string;
  distance: string;
  weightIncrement: number;
  buttonSize: number;
  weightUnit: string;
  distanceUnit: string;
  restMinutes: number;
  restSeconds: number;
  repsMin: number;
  repsMax: number;
  timeMin: number;
  distanceMin: number | undefined;
  currentSetCompleted: boolean;
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
  trackingType: string;
  isInSuperset: boolean;
  isFirstInSuperset: boolean;
  partnerName?: string;
}

interface SlotData {
  exerciseIndex: number;
  setIndex: number;
}

function getNextSlotData(
  exercises: UserExercise[],
  exerciseIndex: number,
  setIndex: number,
): SlotData | null {
  const exercise = exercises[exerciseIndex];
  if (!exercise) return null;

  const partnerIndex = findSupersetPartnerIndex(exercises, exerciseIndex);
  if (partnerIndex !== -1) {
    const isFirst = exerciseIndex < partnerIndex;
    const firstIndex = isFirst ? exerciseIndex : partnerIndex;
    const secondIndex = isFirst ? partnerIndex : exerciseIndex;
    const supersetLength = Math.max(
      exercises[firstIndex].sets.length,
      exercises[secondIndex].sets.length,
    );
    if (isFirst) {
      return { exerciseIndex: secondIndex, setIndex };
    }
    const nextSetIndex = setIndex + 1;
    if (nextSetIndex < supersetLength) {
      const firstHas = nextSetIndex < exercises[firstIndex].sets.length;
      return {
        exerciseIndex: firstHas ? firstIndex : secondIndex,
        setIndex: nextSetIndex,
      };
    }
    const afterIndex = secondIndex + 1;
    return afterIndex < exercises.length
      ? { exerciseIndex: afterIndex, setIndex: 0 }
      : null;
  }

  const nextSetIndex = setIndex + 1;
  if (nextSetIndex < exercise.sets.length) {
    return { exerciseIndex, setIndex: nextSetIndex };
  }
  const nextExIdx = exerciseIndex + 1;
  return nextExIdx < exercises.length
    ? { exerciseIndex: nextExIdx, setIndex: 0 }
    : null;
}

function getPrevSlotData(
  exercises: UserExercise[],
  exerciseIndex: number,
  setIndex: number,
): SlotData | null {
  const partnerIndex = findSupersetPartnerIndex(exercises, exerciseIndex);
  if (partnerIndex !== -1) {
    const isFirst = exerciseIndex < partnerIndex;
    const firstIndex = isFirst ? exerciseIndex : partnerIndex;
    const secondIndex = isFirst ? partnerIndex : exerciseIndex;

    if (isFirst) {
      if (setIndex > 0) {
        return { exerciseIndex: secondIndex, setIndex: setIndex - 1 };
      }
      const beforeIndex = firstIndex - 1;
      return beforeIndex >= 0
        ? {
            exerciseIndex: beforeIndex,
            setIndex: exercises[beforeIndex].sets.length - 1,
          }
        : null;
    }
    return { exerciseIndex: firstIndex, setIndex };
  }

  const prevSetIndex = setIndex - 1;
  if (prevSetIndex >= 0) {
    return { exerciseIndex, setIndex: prevSetIndex };
  }
  const prevExIdx = exerciseIndex - 1;
  return prevExIdx >= 0
    ? {
        exerciseIndex: prevExIdx,
        setIndex: exercises[prevExIdx].sets.length - 1,
      }
    : null;
}

const noop = () => {};
const noopNum = (_: number) => {};
const noopType = (_: "isWarmup" | "isDropSet" | "isToFailure") => {};

const READONLY_PANEL_DEFAULTS = {
  animatedUrl: undefined,
  animatedImageLoading: false,
  animatedImageError: null,
  isLastSetOfLastExercise: false,
  isFirstSetOfFirstExercise: false,
  handleWeightInputChange: noop,
  handleWeightChange: noopNum,
  handleRepsInputChange: noop,
  handleRepsChange: noopNum,
  handleTimeInputChange: noop,
  handleDistanceInputChange: noop,
  handleDistanceChange: noopNum,
  handlePreviousSet: noop,
  handleNextSet: noop,
  handleCompleteSet: noop,
  removeSet: noopNum,
  addSet: noop,
  onToggleSetType: noopType,
} as const;

function snapshotToProps(snapshot: OutgoingSnapshot) {
  const {
    isInSuperset: _a,
    isFirstInSuperset: _b,
    partnerName: _c,
    ...sessionProps
  } = snapshot;
  return { ...sessionProps, ...READONLY_PANEL_DEFAULTS };
}

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();

  // Animation shared values — all hooks must be before any early returns
  const offsetX = useSharedValue(0);
  const snapshotOffsetX = useSharedValue(0);
  const completionIncomingX = useSharedValue(0);
  const canGoNext = useSharedValue(false);
  const canGoPrev = useSharedValue(false);
  const isTransitioning = useSharedValue(false);
  const activeSlot = useSharedValue(0);
  const timerTranslateY = useSharedValue(200);
  const pendingRestTimerRef = useRef<{
    minutes: number;
    seconds: number;
  } | null>(null);

  const [outgoingSnapshot, setOutgoingSnapshot] =
    useState<OutgoingSnapshot | null>(null);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [slots, setSlots] = useState<[SlotData, SlotData, SlotData]>([
    { exerciseIndex: 0, setIndex: 0 },
    { exerciseIndex: 0, setIndex: 0 },
    { exerciseIndex: 0, setIndex: 0 },
  ]);

  // Ring-buffer slot positions: relPos 0=current, 1=next(right), 2=prev(left)
  const slot0Style = useAnimatedStyle(() => {
    const relPos = (0 - activeSlot.value + 3) % 3;
    const shift =
      relPos === 0
        ? completionIncomingX.value
        : relPos === 1
          ? SCREEN_WIDTH
          : -SCREEN_WIDTH;
    return { transform: [{ translateX: offsetX.value + shift }] };
  });
  const slot1Style = useAnimatedStyle(() => {
    const relPos = (1 - activeSlot.value + 3) % 3;
    const shift =
      relPos === 0
        ? completionIncomingX.value
        : relPos === 1
          ? SCREEN_WIDTH
          : -SCREEN_WIDTH;
    return { transform: [{ translateX: offsetX.value + shift }] };
  });
  const slot2Style = useAnimatedStyle(() => {
    const relPos = (2 - activeSlot.value + 3) % 3;
    const shift =
      relPos === 0
        ? completionIncomingX.value
        : relPos === 1
          ? SCREEN_WIDTH
          : -SCREEN_WIDTH;
    return { transform: [{ translateX: offsetX.value + shift }] };
  });
  const outgoingSnapshotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: snapshotOffsetX.value }],
  }));
  const timerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: timerTranslateY.value }],
  }));

  const {
    workout,
    currentExerciseIndex,
    currentSetIndices,
    weightAndReps,
    previousWorkoutData,
    globalHistoryData,
    completedSets,
    setCurrentExerciseIndex,
    setCurrentSetIndex,
    updateWeightAndReps,
    nextSet,
    timerRunning,
    timerExpiry,
    startTimer,
    stopTimer,
    removeSet,
    addSet,
    updateSetRestTime,
    updateSetType,
    currentSetStartedAt,
    setCurrentSetStartedAt,
    recordSetDuration,
  } = useActiveWorkoutStore();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const parsedIncrement = parseFloat(settings?.weightIncrement ?? "");
  const weightIncrement = Number.isNaN(parsedIncrement) ? 1 : parsedIncrement;
  const parsedRestIncrement = parseInt(settings?.restTimerIncrement ?? "", 10);
  const restTimerIncrement = Number.isNaN(parsedRestIncrement)
    ? 15
    : parsedRestIncrement;
  const buttonSize = settings
    ? settings.buttonSize === "Standard"
      ? 40
      : settings.buttonSize === "Large"
        ? 60
        : 80
    : 40;

  const { selectedExerciseIndex } = useLocalSearchParams();

  useEffect(() => {
    if (workout && selectedExerciseIndex !== undefined) {
      setCurrentExerciseIndex(Number(selectedExerciseIndex));
    }
  }, [selectedExerciseIndex, setCurrentExerciseIndex, workout]);

  const currentExercise = workout?.exercises[currentExerciseIndex];
  const currentSetIndex = currentSetIndices[currentExerciseIndex] || 0;
  const currentSet = currentExercise?.sets[currentSetIndex];
  const currentSetCompleted =
    completedSets[currentExerciseIndex] &&
    typeof completedSets[currentExerciseIndex][currentSetIndex] === "boolean"
      ? completedSets[currentExerciseIndex][currentSetIndex]
      : false;

  type ExerciseEntry = NonNullable<
    typeof previousWorkoutData
  >[number]["exercises"][number];

  const buildExerciseMap = (
    data: typeof previousWorkoutData,
  ): Map<number, ExerciseEntry[]> => {
    const map = new Map<number, ExerciseEntry[]>();
    if (!data) return map;
    for (const w of data) {
      for (const ex of w.exercises) {
        const arr = map.get(ex.exercise_id) ?? [];
        arr.push(ex);
        map.set(ex.exercise_id, arr);
      }
    }
    return map;
  };

  const prevExercisesByExerciseId = useMemo(
    () => buildExerciseMap(previousWorkoutData),
    [previousWorkoutData],
  );

  const globalExercisesByExerciseId = useMemo(
    () => buildExerciseMap(globalHistoryData),
    [globalHistoryData],
  );

  const alwaysUseGlobalHistory = settings?.alwaysUseGlobalHistory === "true";

  const findLastAvailableSetData = (exerciseId: number, setIndex: number) => {
    const targetSets =
      workout?.exercises.find((e) => e.exercise_id === exerciseId)?.sets ?? [];
    const isWarmup = targetSets[setIndex]?.isWarmup ?? false;
    const ordinal = targetSets
      .slice(0, setIndex)
      .filter((s) => (s.isWarmup ?? false) === isWarmup).length;

    const lookup = (map: Map<number, ExerciseEntry[]>) => {
      const exercises = map.get(exerciseId);
      if (!exercises) return null;
      for (const ex of exercises) {
        const setsOfType = ex.sets.filter((s) => s.is_warmup === isWarmup);
        if (setsOfType[ordinal]) return setsOfType[ordinal];
      }
      return null;
    };

    if (alwaysUseGlobalHistory) {
      return lookup(globalExercisesByExerciseId);
    }

    return (
      lookup(prevExercisesByExerciseId) ?? lookup(globalExercisesByExerciseId)
    );
  };

  const previousWorkoutSetData = findLastAvailableSetData(
    currentExercise?.exercise_id || 0,
    currentSetIndex,
  );

  const weight =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight ??
    previousWorkoutSetData?.weight?.toString() ??
    "";

  const reps =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps ??
    previousWorkoutSetData?.reps?.toString() ??
    "";

  const time =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.time ??
    previousWorkoutSetData?.time?.toString() ??
    "";

  const distance =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.distance ??
    previousWorkoutSetData?.distance?.toString() ??
    "";

  const {
    data: animatedUrl,
    error: animatedImageError,
    isLoading: animatedImageLoading,
  } = useAnimatedImageQuery(
    currentExercise?.exercise_id || 0,
    currentExercise?.animated_url || "",
    currentExercise?.local_animated_uri,
  );

  useKeepScreenOn();

  const expiryTimestampRef = useRef<Date | null>(null);
  const lastCompletedSetRef = useRef<{
    exerciseIndex: number;
    setIndex: number;
  } | null>(null);
  const adjustedRestSecondsRef = useRef<number>(0);
  const { playSound, triggerVibration } = useSoundStore();
  const { seconds, minutes, restart } = useTimer({
    expiryTimestamp: timerExpiry || new Date(),
    autoStart: timerRunning,
    onExpire: () => {
      stopTimer();

      handleExpire();
    },
  });

  async function handleExpire() {
    if (!expiryTimestampRef.current) {
      Bugsnag.notify(new Error("Timer expired but no expiry timestamp found"));
      return;
    }

    const now = new Date();
    const diffMs = now.getTime() - expiryTimestampRef.current.getTime();

    Bugsnag.leaveBreadcrumb("Timer expired", {
      diffMs,
      soundEnabled: settings?.restTimerSound === "true",
      vibrationEnabled: settings?.restTimerVibration === "true",
      timestamp: now.toISOString(),
      expiryTimestamp: expiryTimestampRef.current.toISOString(),
    });

    if (diffMs < 2000) {
      if (settings?.restTimerSound === "true") {
        playSound();
      }
      if (settings?.restTimerVibration === "true") {
        triggerVibration();
      }
    } else {
      Bugsnag.leaveBreadcrumb("Skipped sound/vibration", {
        reason: "Too late after expiry",
        diffMs,
      });
    }

    setCurrentSetStartedAt(new Date());
  }

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

      Bugsnag.leaveBreadcrumb("Timer restarted", {
        timerExpiry: timerExpiry.toISOString(),
        currentTime: new Date().toISOString(),
      });
    }
  }, [timerRunning, timerExpiry, restart]);

  useEffect(() => {
    return () => {
      pendingRestTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!currentSetStartedAt) {
      setCurrentSetStartedAt(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRestTimer = async (restMinutes: number, restSeconds: number) => {
    if (restMinutes > 0 || restSeconds > 0) {
      const totalSeconds = restMinutes * 60 + restSeconds;

      if (settings?.restTimerNotification === "true") {
        await scheduleRestNotificationWithCancellation(
          totalSeconds,
          "Rest Timer Finished!",
          "Time to do your next set!",
          "rest-timer1",
        );
      } else {
        await cancelRestNotifications();
      }

      adjustedRestSecondsRef.current = totalSeconds;
      const time = new Date();
      time.setSeconds(time.getSeconds() + totalSeconds);
      expiryTimestampRef.current = time;
      startTimer(time);

      Bugsnag.leaveBreadcrumb("Timer started", {
        totalSeconds,
        expiryTimestamp: time.toISOString(),
        currentTime: new Date().toISOString(),
      });
    }
  };

  const adjustTimer = async (deltaSeconds: number) => {
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

    // Track the intended rest time (original + all deltas) separately from the
    // live countdown, so we save the right value even if the timer has already
    // ticked down before the user presses confirm.
    adjustedRestSecondsRef.current = Math.max(
      0,
      adjustedRestSecondsRef.current + deltaSeconds,
    );

    if (settings?.restTimerNotification === "true") {
      await scheduleRestNotificationWithCancellation(
        newRemaining,
        "Rest Timer Finished!",
        "Time to do your next set!",
        "rest-timer1",
      );
    }

    if (lastCompletedSetRef.current) {
      const { exerciseIndex, setIndex } = lastCompletedSetRef.current;
      const target = adjustedRestSecondsRef.current;
      updateSetRestTime(
        exerciseIndex,
        setIndex,
        Math.floor(target / 60),
        target % 60,
      );
    }
  };

  const handleWeightInputChange = (inputValue: string) => {
    const sanitizedInput = inputValue.replace(/[^0-9.]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      sanitizedInput,
      reps,
      time,
    );
  };

  const handleRepsInputChange = (inputValue: string) => {
    const sanitizedInput = inputValue.replace(/[^0-9.]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      weight,
      sanitizedInput,
      time,
    );
  };

  const handleTimeInputChange = (inputValue: string) => {
    const sanitizedInput = inputValue.replace(/[^0-9]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      weight,
      reps,
      sanitizedInput,
    );
  };

  const handleWeightChange = (amount: number) => {
    const currentWeight = isNaN(parseFloat(weight)) ? 0 : parseFloat(weight);
    const newWeight = Math.max(0, currentWeight + amount).toFixed(1);
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      newWeight,
      reps,
      time,
    );
  };

  const handleRepsChange = (amount: number) => {
    const currentReps = isNaN(parseInt(reps)) ? 0 : parseInt(reps);
    const newReps = Math.max(0, currentReps + amount).toString();
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      weight,
      newReps,
      time,
    );
  };

  const handleDistanceInputChange = (inputValue: string) => {
    const sanitizedInput = inputValue.replace(/[^0-9.]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      undefined,
      undefined,
      undefined,
      sanitizedInput,
    );
  };

  const handleDistanceChange = (amount: number) => {
    const currentDistance = isNaN(parseFloat(distance))
      ? 0
      : parseFloat(distance);
    const newDistance = Math.max(0, currentDistance + amount).toFixed(1);
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      undefined,
      undefined,
      undefined,
      newDistance,
    );
  };

  const handleToggleSetType = (
    type: "isWarmup" | "isDropSet" | "isToFailure",
  ) => {
    const currentVal = currentSet?.[type] || false;
    updateSetType(currentExerciseIndex, currentSetIndex, type, !currentVal);
  };

  const handleRemoveSet = (index: number) => {
    Alert.alert(t`Delete Set`, t`Are you sure you want to delete this set?`, [
      { text: t`Cancel`, style: "cancel" },
      {
        text: t`Delete`,
        style: "destructive",
        onPress: () => {
          removeSet(index);
          const st = useActiveWorkoutStore.getState();
          const newExerciseIndex = st.currentExerciseIndex;
          const newSetIndex = st.currentSetIndices[newExerciseIndex] ?? 0;
          setSlots((prev) => {
            const u = [...prev] as [SlotData, SlotData, SlotData];
            u[currentSlotIndex] = {
              exerciseIndex: newExerciseIndex,
              setIndex: newSetIndex,
            };
            return u;
          });
        },
      },
    ]);
  };

  const nextSlotData =
    workout && currentExercise
      ? getNextSlotData(
          workout.exercises,
          currentExerciseIndex,
          currentSetIndex,
        )
      : null;
  const hasNextSet =
    nextSlotData &&
    workout?.exercises[nextSlotData.exerciseIndex]?.sets[nextSlotData.setIndex];

  const prevSlotData =
    workout && currentExercise
      ? getPrevSlotData(
          workout.exercises,
          currentExerciseIndex,
          currentSetIndex,
        )
      : null;
  const hasPreviousSet =
    prevSlotData &&
    workout?.exercises[prevSlotData.exerciseIndex]?.sets[prevSlotData.setIndex];

  const currentIsLastSetOfLastExercise =
    workout &&
    currentExercise &&
    currentExerciseIndex === workout.exercises.length - 1 &&
    currentSetIndex === currentExercise.sets.length - 1;

  const currentIsFirstSetOfFirstExercise =
    workout &&
    currentExercise &&
    currentExerciseIndex === 0 &&
    currentSetIndex === 0;

  // Keep shared values in sync so gesture worklets see current edge state
  useEffect(() => {
    canGoNext.value = !!hasNextSet;
    canGoPrev.value = !!hasPreviousSet;
  }, [hasNextSet, hasPreviousSet]);

  // Populate ring-buffer slots once the workout is available.
  // Reads directly from the store so the selectedExerciseIndex effect is already applied.
  const slotsInitialized = useRef(false);
  useEffect(() => {
    if (!workout || slotsInitialized.current) return;
    slotsInitialized.current = true;
    const st = useActiveWorkoutStore.getState();
    const exIdx = st.currentExerciseIndex;
    const setIdx = st.currentSetIndices[exIdx] || 0;
    const initNext = getNextSlotData(workout.exercises, exIdx, setIdx);
    const initPrev = getPrevSlotData(workout.exercises, exIdx, setIdx);
    const cur = { exerciseIndex: exIdx, setIndex: setIdx };
    setSlots([cur, initNext ?? cur, initPrev ?? cur]);
  }, [workout]);

  const getPanelSuperset = (exerciseIndex: number) => {
    if (!workout)
      return {
        isInSuperset: false,
        isFirstInSuperset: false,
        partnerName: undefined,
      };
    const partnerIdx = findSupersetPartnerIndex(
      workout.exercises,
      exerciseIndex,
    );
    const inSuperset = partnerIdx !== -1;
    return {
      isInSuperset: inSuperset,
      isFirstInSuperset: inSuperset && exerciseIndex < partnerIdx,
      partnerName: inSuperset ? workout.exercises[partnerIdx]?.name : undefined,
    };
  };

  // Returns full SessionSetInfo props for any (exerciseIndex, setIndex) without
  // touching store indices — used to pre-render adjacent panels with correct data
  const getPanelData = (exerciseIndex: number, setIndex: number) => {
    if (!workout) return null;
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return null;
    const set = exercise.sets[setIndex];
    if (!set) return null;

    const prevData = findLastAvailableSetData(exercise.exercise_id, setIndex);
    const panelWeight =
      weightAndReps[exerciseIndex]?.[setIndex]?.weight ??
      prevData?.weight?.toString() ??
      "";
    const panelReps =
      weightAndReps[exerciseIndex]?.[setIndex]?.reps ??
      prevData?.reps?.toString() ??
      "";
    const panelTime =
      weightAndReps[exerciseIndex]?.[setIndex]?.time ??
      prevData?.time?.toString() ??
      "";
    const panelDistance =
      weightAndReps[exerciseIndex]?.[setIndex]?.distance ??
      prevData?.distance?.toString() ??
      "";
    const isCompleted = completedSets[exerciseIndex]?.[setIndex] ?? false;
    const isFirst = exerciseIndex === 0 && setIndex === 0;
    const isLast =
      exerciseIndex === workout.exercises.length - 1 &&
      setIndex === exercise.sets.length - 1;

    return {
      ...READONLY_PANEL_DEFAULTS,
      exercise_id: exercise.exercise_id,
      exerciseName: exercise.name,
      currentSetIndex: setIndex,
      totalSets: exercise.sets.length,
      weight: panelWeight,
      reps: panelReps,
      time: panelTime,
      distance: panelDistance,
      weightIncrement,
      buttonSize,
      weightUnit: settings?.weightUnit || "kg",
      distanceUnit: settings?.distanceUnit || "m",
      restMinutes: set.restMinutes || 0,
      restSeconds: set.restSeconds || 0,
      repsMin: set.repsMin || 0,
      repsMax: set.repsMax || 0,
      timeMin: set.time || 0,
      distanceMin: set.distance,
      currentSetCompleted: !!isCompleted,
      isWarmup: set.isWarmup || false,
      isDropSet: set.isDropSet || false,
      isToFailure: set.isToFailure || false,
      trackingType: exercise.tracking_type || "weight",
      isLastSetOfLastExercise: isLast,
      isFirstSetOfFirstExercise: isFirst,
    };
  };

  // Called from the snapshot slide-out callback: clears snapshot and starts any
  // rest timer that was deferred until after the animation.
  const afterAnimation = () => {
    setOutgoingSnapshot(null);
    if (pendingRestTimerRef.current) {
      const { minutes, seconds } = pendingRestTimerRef.current;
      pendingRestTimerRef.current = null;
      void startRestTimer(minutes, seconds);
    }
  };

  // Ring-buffer swipe commits: rotate activeSlot atomically in worklet then call these on JS thread
  const onSwipePrevCommit = () => {
    const newActive = activeSlot.value; // already decremented in worklet
    const cur = slots[newActive];
    setCurrentExerciseIndex(cur.exerciseIndex);
    setCurrentSetIndex(cur.exerciseIndex, cur.setIndex);
    setCurrentSlotIndex(newActive);
    if (workout) {
      const newPrevSlotIdx = (newActive + 2) % 3;
      const prevSlot = getPrevSlotData(
        workout.exercises,
        cur.exerciseIndex,
        cur.setIndex,
      );
      setSlots((prev) => {
        const u = [...prev] as [SlotData, SlotData, SlotData];
        u[newPrevSlotIdx] = prevSlot ?? cur;
        return u;
      });
    }
  };

  const onSwipeNextCommit = () => {
    const newActive = activeSlot.value; // already incremented in worklet
    const cur = slots[newActive];
    setCurrentExerciseIndex(cur.exerciseIndex);
    setCurrentSetIndex(cur.exerciseIndex, cur.setIndex);
    setCurrentSlotIndex(newActive);
    if (workout) {
      const newNextSlotIdx = (newActive + 1) % 3;
      const nextSlot = getNextSlotData(
        workout.exercises,
        cur.exerciseIndex,
        cur.setIndex,
      );
      setSlots((prev) => {
        const u = [...prev] as [SlotData, SlotData, SlotData];
        u[newNextSlotIdx] = nextSlot ?? cur;
        return u;
      });
    }
  };

  const handlePreviousSet = () => {
    if (!hasPreviousSet || isTransitioning.value) return;
    isTransitioning.value = true;
    offsetX.value = withTiming(SCREEN_WIDTH, { duration: 250 }, (finished) => {
      "worklet";
      isTransitioning.value = false;
      if (finished) {
        offsetX.value = 0;
        activeSlot.value = (activeSlot.value + 2) % 3; // -1 mod 3
        scheduleOnRN(onSwipePrevCommit);
      }
    });
  };

  const handleNextSet = () => {
    if (!hasNextSet || isTransitioning.value) return;
    isTransitioning.value = true;
    offsetX.value = withTiming(-SCREEN_WIDTH, { duration: 250 }, (finished) => {
      "worklet";
      isTransitioning.value = false;
      if (finished) {
        offsetX.value = 0;
        activeSlot.value = (activeSlot.value + 1) % 3;
        scheduleOnRN(onSwipeNextCommit);
      }
    });
  };

  // Determine superset context (used for completion logic)
  const supersetPartnerIndex =
    workout && currentExercise
      ? findSupersetPartnerIndex(workout.exercises, currentExerciseIndex)
      : -1;
  const isInSuperset = supersetPartnerIndex !== -1;
  const isFirstInSuperset =
    isInSuperset && currentExerciseIndex < supersetPartnerIndex;

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }
    if (outgoingSnapshot || isTransitioning.value) return;

    const weightStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight ??
      previousWorkoutSetData?.weight?.toString() ??
      "";
    const repsStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps ??
      previousWorkoutSetData?.reps?.toString() ??
      "";
    const timeStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.time ??
      previousWorkoutSetData?.time?.toString() ??
      "";
    const distanceStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.distance ??
      previousWorkoutSetData?.distance?.toString() ??
      "";

    const weightInKg = parseFloat(weightStr);
    const validWeightInKg = isNaN(weightInKg) ? 0 : weightInKg;

    const repsNum = parseInt(repsStr);
    const validRepsNum = isNaN(repsNum) ? 0 : repsNum;

    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      validWeightInKg.toString(),
      validRepsNum.toString(),
      timeStr,
      distanceStr,
    );

    // Only animate when nextSet() will keep this screen mounted.
    // hasNextSet can be true even when the store calls router.back() — e.g. the
    // next sequential exercise exists but is already fully completed.
    const shouldAnimate = (() => {
      if (!workout || !currentExercise) return false;
      // First in superset always transitions to the partner — never navigates away.
      if (isFirstInSuperset) return true;
      // Second in superset: the superset may have more rounds even when the
      // current exercise's sets are exhausted (uneven set counts).
      if (isInSuperset) {
        const partnerExercise = workout.exercises[supersetPartnerIndex];
        const supersetLength = Math.max(
          currentExercise.sets.length,
          partnerExercise.sets.length,
        );
        if (currentSetIndex + 1 < supersetLength) return true;
      } else if (currentSetIndex + 1 < currentExercise.sets.length) {
        return true;
      }
      // Simulate the completed-sets state after marking this set done, then
      // check whether any exercise ahead still has sets to do.
      const updatedCompleted = {
        ...completedSets,
        [currentExerciseIndex]: {
          ...(completedSets[currentExerciseIndex] || {}),
          [currentSetIndex]: true,
        },
      };
      const startIdx = isInSuperset
        ? Math.max(currentExerciseIndex, supersetPartnerIndex) + 1
        : currentExerciseIndex + 1;
      for (let idx = startIdx; idx < workout.exercises.length; idx++) {
        const done = updatedCompleted[idx];
        if (
          (done ? Object.keys(done).length : 0) <
          workout.exercises[idx].sets.length
        ) {
          return true;
        }
      }
      return false;
    })();

    if (!shouldAnimate) {
      if (isFirstInSuperset) {
        stopTimer();
        void cancelRestNotifications();
      } else {
        void cancelRestNotifications();
      }
      lastCompletedSetRef.current = {
        exerciseIndex: currentExerciseIndex,
        setIndex: currentSetIndex,
      };
      const durationNoAnim = currentSetStartedAt
        ? Math.round(
            (Date.now() - new Date(currentSetStartedAt).getTime()) / 1000,
          )
        : null;
      recordSetDuration(currentExerciseIndex, currentSetIndex, durationNoAnim);
      setCurrentSetStartedAt(null);
      nextSet();
      return;
    }

    // Build snapshot with superset info so the banner animates with the panel
    const snapshotData: OutgoingSnapshot = {
      exercise_id: currentExercise.exercise_id,
      exerciseName: currentExercise.name,
      currentSetIndex,
      totalSets: currentExercise.sets.length,
      weight: validWeightInKg.toString(),
      reps: validRepsNum.toString(),
      time: timeStr,
      distance: distanceStr,
      weightIncrement,
      buttonSize,
      weightUnit: settings?.weightUnit || "kg",
      distanceUnit: settings?.distanceUnit || "m",
      restMinutes: currentSet.restMinutes || 0,
      restSeconds: currentSet.restSeconds || 0,
      repsMin: currentSet.repsMin || 0,
      repsMax: currentSet.repsMax || 0,
      timeMin: currentSet.time || 0,
      distanceMin: currentSet.distance,
      currentSetCompleted: true,
      isWarmup: currentSet.isWarmup || false,
      isDropSet: currentSet.isDropSet || false,
      isToFailure: currentSet.isToFailure || false,
      trackingType: currentExercise.tracking_type || "weight",
      isInSuperset,
      isFirstInSuperset,
      partnerName: isInSuperset
        ? workout?.exercises[supersetPartnerIndex]?.name
        : undefined,
    };

    if (isFirstInSuperset) {
      stopTimer();
      void cancelRestNotifications();
    } else if (hasNextSet) {
      pendingRestTimerRef.current = {
        minutes: currentSet.restMinutes,
        seconds: currentSet.restSeconds,
      };
    } else {
      void cancelRestNotifications();
    }

    isTransitioning.value = true;

    // Reset snapshot position and move live panel off-screen BEFORE the snapshot
    // panel is created, so both panels are never at position 0 simultaneously.
    snapshotOffsetX.value = 0;
    completionIncomingX.value = SCREEN_WIDTH;

    // Advance the store — carry-forward weight is written inside nextSet()
    lastCompletedSetRef.current = {
      exerciseIndex: currentExerciseIndex,
      setIndex: currentSetIndex,
    };
    const durationAnim = currentSetStartedAt
      ? Math.round(
          (Date.now() - new Date(currentSetStartedAt).getTime()) / 1000,
        )
      : null;
    recordSetDuration(currentExerciseIndex, currentSetIndex, durationAnim);
    setCurrentSetStartedAt(null);
    nextSet();
    if (
      isFirstInSuperset ||
      (hasNextSet &&
        currentSet.restMinutes === 0 &&
        currentSet.restSeconds === 0)
    ) {
      setCurrentSetStartedAt(new Date());
    }

    // Update current slot to point to the new exercise that nextSet() navigated to.
    // The panel is already off-screen (completionIncomingX = SCREEN_WIDTH), so
    // the content swap is invisible.
    const stAfter = useActiveWorkoutStore.getState();
    const newExIdx = stAfter.currentExerciseIndex;
    const newSetIdx = stAfter.currentSetIndices[newExIdx] || 0;
    const capturedSlotIndex = currentSlotIndex;
    setSlots((prev) => {
      const u = [...prev] as [SlotData, SlotData, SlotData];
      u[capturedSlotIndex] = { exerciseIndex: newExIdx, setIndex: newSetIdx };
      return u;
    });

    // Defer snapshot creation by one frame so completionIncomingX = SCREEN_WIDTH
    // has been applied on the UI thread before the snapshot panel appears.
    requestAnimationFrame(() => {
      // Also refresh adjacent slots (off-screen) for the new position.
      if (workout) {
        const nxSlotData = getNextSlotData(
          workout.exercises,
          newExIdx,
          newSetIdx,
        );
        const pvSlotData = getPrevSlotData(
          workout.exercises,
          newExIdx,
          newSetIdx,
        );
        setSlots((prev) => {
          const u = [...prev] as [SlotData, SlotData, SlotData];
          const nxSlot = (capturedSlotIndex + 1) % 3;
          const pvSlot = (capturedSlotIndex + 2) % 3;
          if (nxSlotData) u[nxSlot] = nxSlotData;
          if (pvSlotData) u[pvSlot] = pvSlotData;
          return u;
        });
      }

      setOutgoingSnapshot(snapshotData);
      snapshotOffsetX.value = withTiming(
        -SCREEN_WIDTH,
        { duration: 250 },
        (finished) => {
          "worklet";
          isTransitioning.value = false;
          // Always clear the snapshot so the UI can never get permanently stuck
          // if Reanimated fires finished=false (e.g. an animation edge case that
          // would otherwise leave outgoingSnapshot set with the live panel
          // hidden behind completionIncomingX = SCREEN_WIDTH).
          scheduleOnRN(afterAnimation);
          if (!finished) {
            completionIncomingX.value = 0;
          }
        },
      );
      completionIncomingX.value = withTiming(
        0,
        { duration: 250 },
        (finished) => {
          "worklet";
          if (finished) {
            completionIncomingX.value = 0;
          }
        },
      );
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      "worklet";
      if (isTransitioning.value) return;
      const dx = e.translationX;
      if (dx > 0 && !canGoPrev.value) {
        offsetX.value = dx * 0.15;
      } else if (dx < 0 && !canGoNext.value) {
        offsetX.value = dx * 0.15;
      } else {
        offsetX.value = dx;
      }
    })
    .onEnd((e) => {
      "worklet";
      if (isTransitioning.value) {
        offsetX.value = withSpring(0, { damping: 20, stiffness: 200 });
        return;
      }
      const dx = e.translationX;
      const vx = e.velocityX;
      if ((dx > COMMIT_DISTANCE || vx > COMMIT_VELOCITY) && canGoPrev.value) {
        isTransitioning.value = true;
        offsetX.value = withTiming(
          SCREEN_WIDTH,
          { duration: 200 },
          (finished) => {
            "worklet";
            isTransitioning.value = false;
            if (finished) {
              offsetX.value = 0;
              activeSlot.value = (activeSlot.value + 2) % 3;
              scheduleOnRN(onSwipePrevCommit);
            }
          },
        );
      } else if (
        (dx < -COMMIT_DISTANCE || vx < -COMMIT_VELOCITY) &&
        canGoNext.value
      ) {
        isTransitioning.value = true;
        offsetX.value = withTiming(
          -SCREEN_WIDTH,
          { duration: 200 },
          (finished) => {
            "worklet";
            isTransitioning.value = false;
            if (finished) {
              offsetX.value = 0;
              activeSlot.value = (activeSlot.value + 1) % 3;
              scheduleOnRN(onSwipeNextCommit);
            }
          },
        );
      } else {
        offsetX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  if (settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (settingsError) {
    Bugsnag.notify(settingsError);
    return (
      <ThemedView style={styles.container}>
        <ThemedText>
          <Trans>Error: {settingsError.message}</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <>
              <Notes
                noteType="exercise"
                referenceId={currentExercise?.exercise_id || 0}
                buttonType="icon"
              />
              <WorkoutTimer />
            </>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <GestureDetector gesture={panGesture}>
          <View style={styles.panelContainer}>
            {([slot0Style, slot1Style, slot2Style] as const).map(
              (slotStyle, slotIdx) => {
                const isCurrentSlot = slotIdx === currentSlotIndex;
                const p = getPanelData(
                  slots[slotIdx].exerciseIndex,
                  slots[slotIdx].setIndex,
                );
                const ss = getPanelSuperset(slots[slotIdx].exerciseIndex);
                return (
                  <AnimatedView
                    key={slotIdx}
                    style={[
                      StyleSheet.absoluteFill,
                      slotStyle,
                      isCurrentSlot ? undefined : { pointerEvents: "none" },
                    ]}
                  >
                    {p && (
                      <View style={{ flex: 1 }}>
                        {ss.isInSuperset && (
                          <View style={styles.supersetBanner}>
                            <ThemedText style={styles.supersetLabel}>
                              <Trans>
                                Superset {ss.isFirstInSuperset ? "A" : "B"}
                              </Trans>
                            </ThemedText>
                            <ThemedText
                              style={styles.supersetPartner}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {ss.isFirstInSuperset ? (
                                <Trans>Next: </Trans>
                              ) : (
                                <Trans>Prev: </Trans>
                              )}
                              {ss.partnerName}
                            </ThemedText>
                          </View>
                        )}
                        {isCurrentSlot ? (
                          <SessionSetInfo
                            {...p}
                            animatedUrl={animatedUrl}
                            animatedImageLoading={animatedImageLoading}
                            animatedImageError={animatedImageError}
                            isLastSetOfLastExercise={
                              !!currentIsLastSetOfLastExercise
                            }
                            isFirstSetOfFirstExercise={
                              !!currentIsFirstSetOfFirstExercise
                            }
                            currentSetCompleted={currentSetCompleted}
                            handleWeightInputChange={handleWeightInputChange}
                            handleWeightChange={handleWeightChange}
                            handleRepsInputChange={handleRepsInputChange}
                            handleRepsChange={handleRepsChange}
                            handleTimeInputChange={handleTimeInputChange}
                            handleDistanceInputChange={
                              handleDistanceInputChange
                            }
                            handleDistanceChange={handleDistanceChange}
                            handlePreviousSet={handlePreviousSet}
                            handleNextSet={handleNextSet}
                            handleCompleteSet={handleCompleteSet}
                            removeSet={handleRemoveSet}
                            addSet={addSet}
                            onToggleSetType={handleToggleSetType}
                          />
                        ) : (
                          <SessionSetInfo {...p} />
                        )}
                      </View>
                    )}
                  </AnimatedView>
                );
              },
            )}
            {outgoingSnapshot && (
              <AnimatedView
                style={[
                  StyleSheet.absoluteFill,
                  outgoingSnapshotStyle,
                  { pointerEvents: "none" },
                ]}
              >
                <View style={{ flex: 1 }}>
                  {outgoingSnapshot.isInSuperset && (
                    <View style={styles.supersetBanner}>
                      <ThemedText style={styles.supersetLabel}>
                        <Trans>
                          Superset{" "}
                          {outgoingSnapshot.isFirstInSuperset ? "A" : "B"}
                        </Trans>
                      </ThemedText>
                      <ThemedText
                        style={styles.supersetPartner}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {outgoingSnapshot.isFirstInSuperset ? (
                          <Trans>Next: </Trans>
                        ) : (
                          <Trans>Prev: </Trans>
                        )}
                        {outgoingSnapshot.partnerName}
                      </ThemedText>
                    </View>
                  )}
                  <SessionSetInfo {...snapshotToProps(outgoingSnapshot)} />
                </View>
              </AnimatedView>
            )}
          </View>
        </GestureDetector>
      </KeyboardAvoidingView>
      <AnimatedView
        style={[
          styles.timerContainer,
          { paddingBottom: insets.bottom },
          timerAnimStyle,
          { pointerEvents: timerRunning ? "auto" : "none" },
        ]}
      >
        <ThemedText style={styles.timerLabel}>
          <Trans>Rest Time Left:</Trans>
        </ThemedText>
        <View style={styles.timerRow}>
          <TouchableOpacity
            style={styles.timerAdjustButton}
            onPress={() => void adjustTimer(-restTimerIncrement)}
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
            onPress={() => void adjustTimer(restTimerIncrement)}
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
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
  },
  panelContainer: {
    flex: 1,
    overflow: "hidden",
  },
  timerContainer: {
    position: "absolute",
    bottom: 0,
    right: 16,
    left: 16,
    width: "100%",
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
    elevation: 5,
    marginBottom: 0,
  },
  supersetBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  supersetLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.dark.tint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  supersetPartner: {
    fontSize: 13,
    color: Colors.dark.subText,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 8,
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
