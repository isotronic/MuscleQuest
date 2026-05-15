import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
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
import { useSoundStore } from "@/store/soundStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
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
  weightIncrement: number;
  buttonSize: number;
  weightUnit: string;
  restMinutes: number;
  restSeconds: number;
  repsMin: number;
  repsMax: number;
  timeMin: number;
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

const noop = () => {};
const noopNum = (_: number) => {};

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
  handlePreviousSet: noop,
  handleNextSet: noop,
  handleCompleteSet: noop,
  removeSet: noopNum,
  addSet: noop,
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
  } = useActiveWorkoutStore();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const parsedIncrement = parseFloat(settings?.weightIncrement ?? "");
  const weightIncrement = Number.isNaN(parsedIncrement) ? 1 : parsedIncrement;
  const parsedRestIncrement = parseInt(settings?.restTimerIncrement ?? "");
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

  const prevExercisesByExerciseId = useMemo(() => {
    const map = new Map<
      number,
      NonNullable<typeof previousWorkoutData>[number]["exercises"][number][]
    >();
    if (!previousWorkoutData) return map;
    for (const w of previousWorkoutData) {
      for (const ex of w.exercises) {
        const arr = map.get(ex.exercise_id) ?? [];
        arr.push(ex);
        map.set(ex.exercise_id, arr);
      }
    }
    return map;
  }, [previousWorkoutData]);

  const findLastAvailableSetData = (exerciseId: number, setIndex: number) => {
    const exercises = prevExercisesByExerciseId.get(exerciseId);
    if (!exercises) return null;
    for (const ex of exercises) {
      if (ex.sets[setIndex]) return ex.sets[setIndex];
    }
    return null;
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
    const currentRemaining = minutes * 60 + seconds;
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

  const handleRemoveSet = (index: number) => {
    Alert.alert("Delete Set", "Are you sure you want to delete this set?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeSet(index);
        },
      },
    ]);
  };

  // Compute next set index and exercise index
  let nextExerciseIndex = currentExerciseIndex;
  let nextSetIndex = currentSetIndex + 1;

  if (currentExercise && nextSetIndex >= currentExercise.sets.length) {
    nextExerciseIndex = currentExerciseIndex + 1;
    nextSetIndex = 0;
  }

  const hasNextSet =
    workout &&
    nextExerciseIndex < workout.exercises.length &&
    workout.exercises[nextExerciseIndex].sets[nextSetIndex];

  // Compute previous set index and exercise index
  let previousExerciseIndex: number | null = currentExerciseIndex;
  let previousSetIndex: number | null = currentSetIndex - 1;

  if (previousSetIndex < 0) {
    previousExerciseIndex = currentExerciseIndex - 1;
    if (previousExerciseIndex >= 0) {
      const prevExercise = workout?.exercises[previousExerciseIndex];
      previousSetIndex = prevExercise!.sets.length - 1;
    } else {
      previousSetIndex = null;
      previousExerciseIndex = null;
    }
  }

  const hasPreviousSet =
    previousExerciseIndex !== null &&
    previousSetIndex !== null &&
    previousExerciseIndex >= 0 &&
    previousSetIndex >= 0 &&
    workout &&
    workout.exercises[previousExerciseIndex].sets[previousSetIndex];

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
    const exercise = workout.exercises[exIdx];
    // next
    let nxEx = exIdx;
    let nxSet = setIdx + 1;
    if (exercise && nxSet >= exercise.sets.length) {
      nxEx = exIdx + 1;
      nxSet = 0;
    }
    const hasNx =
      nxEx < workout.exercises.length && !!workout.exercises[nxEx]?.sets[nxSet];
    // prev
    let pvEx = exIdx;
    let pvSet = setIdx - 1;
    if (pvSet < 0) {
      pvEx = exIdx - 1;
      pvSet = pvEx >= 0 ? workout.exercises[pvEx]?.sets.length - 1 || 0 : 0;
    }
    const hasPv = pvEx >= 0;
    setSlots([
      { exerciseIndex: exIdx, setIndex: setIdx },
      hasNx
        ? { exerciseIndex: nxEx, setIndex: nxSet }
        : { exerciseIndex: exIdx, setIndex: setIdx },
      hasPv
        ? { exerciseIndex: pvEx, setIndex: pvSet }
        : { exerciseIndex: exIdx, setIndex: setIdx },
    ]);
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
      weightIncrement,
      buttonSize,
      weightUnit: settings?.weightUnit || "kg",
      restMinutes: set.restMinutes || 0,
      restSeconds: set.restSeconds || 0,
      repsMin: set.repsMin || 0,
      repsMax: set.repsMax || 0,
      timeMin: set.time || 0,
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
      let pvEx = cur.exerciseIndex;
      let pvSet = cur.setIndex - 1;
      if (pvSet < 0) {
        pvEx = cur.exerciseIndex - 1;
        pvSet = pvEx >= 0 ? workout.exercises[pvEx]?.sets.length - 1 || 0 : 0;
      }
      setSlots((prev) => {
        const u = [...prev] as [SlotData, SlotData, SlotData];
        u[newPrevSlotIdx] =
          pvEx >= 0 ? { exerciseIndex: pvEx, setIndex: pvSet } : cur;
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
      const ex = workout.exercises[cur.exerciseIndex];
      let nxEx = cur.exerciseIndex;
      let nxSet = cur.setIndex + 1;
      if (ex && nxSet >= ex.sets.length) {
        nxEx = cur.exerciseIndex + 1;
        nxSet = 0;
      }
      setSlots((prev) => {
        const u = [...prev] as [SlotData, SlotData, SlotData];
        u[newNextSlotIdx] =
          nxEx < workout.exercises.length
            ? { exerciseIndex: nxEx, setIndex: nxSet }
            : cur;
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
        runOnJS(onSwipePrevCommit)();
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
        runOnJS(onSwipeNextCommit)();
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
      } else if (hasNextSet) {
        void startRestTimer(currentSet.restMinutes, currentSet.restSeconds);
      } else {
        void cancelRestNotifications();
      }
      lastCompletedSetRef.current = {
        exerciseIndex: currentExerciseIndex,
        setIndex: currentSetIndex,
      };
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
      weightIncrement,
      buttonSize,
      weightUnit: settings?.weightUnit || "kg",
      restMinutes: currentSet.restMinutes || 0,
      restSeconds: currentSet.restSeconds || 0,
      repsMin: currentSet.repsMin || 0,
      repsMax: currentSet.repsMax || 0,
      timeMin: currentSet.time || 0,
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
    nextSet();

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
        const newExercise = workout.exercises[newExIdx];
        let nxEx = newExIdx;
        let nxSet = newSetIdx + 1;
        if (newExercise && nxSet >= newExercise.sets.length) {
          nxEx = newExIdx + 1;
          nxSet = 0;
        }
        let pvEx = newExIdx;
        let pvSet = newSetIdx - 1;
        if (pvSet < 0) {
          pvEx = newExIdx - 1;
          pvSet = pvEx >= 0 ? workout.exercises[pvEx]?.sets.length - 1 || 0 : 0;
        }
        setSlots((prev) => {
          const u = [...prev] as [SlotData, SlotData, SlotData];
          const nxSlot = (capturedSlotIndex + 1) % 3;
          const pvSlot = (capturedSlotIndex + 2) % 3;
          if (nxEx < workout.exercises.length)
            u[nxSlot] = { exerciseIndex: nxEx, setIndex: nxSet };
          if (pvEx >= 0) u[pvSlot] = { exerciseIndex: pvEx, setIndex: pvSet };
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
          if (finished) {
            runOnJS(afterAnimation)();
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
              runOnJS(onSwipePrevCommit)();
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
              runOnJS(onSwipeNextCommit)();
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
        <ThemedText>Error: {settingsError.message}</ThemedText>
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
                            Superset {ss.isFirstInSuperset ? "A" : "B"}
                          </ThemedText>
                          <ThemedText
                            style={styles.supersetPartner}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {ss.isFirstInSuperset ? "Next: " : "Prev: "}
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
                          handlePreviousSet={handlePreviousSet}
                          handleNextSet={handleNextSet}
                          handleCompleteSet={handleCompleteSet}
                          removeSet={handleRemoveSet}
                          addSet={addSet}
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
                      Superset {outgoingSnapshot.isFirstInSuperset ? "A" : "B"}
                    </ThemedText>
                    <ThemedText
                      style={styles.supersetPartner}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {outgoingSnapshot.isFirstInSuperset ? "Next: " : "Prev: "}
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
      <AnimatedView
        style={[
          styles.timerContainer,
          { paddingBottom: insets.bottom },
          timerAnimStyle,
          { pointerEvents: timerRunning ? "auto" : "none" },
        ]}
      >
        <ThemedText style={styles.timerLabel}>Rest Time Left:</ThemedText>
        <View style={styles.timerRow}>
          <TouchableOpacity
            style={styles.timerAdjustButton}
            onPress={() => void adjustTimer(-restTimerIncrement)}
          >
            <ThemedText style={styles.timerAdjustText}>
              −{restTimerIncrement}s
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
              +{restTimerIncrement}s
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
