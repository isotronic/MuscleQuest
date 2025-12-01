import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Alert } from "react-native";
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
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WorkoutTimer from "@/components/WorkoutTimer";
import Bugsnag from "@bugsnag/expo";
import {
  cancelRestNotifications,
  scheduleRestNotification,
} from "@/utils/restNotification";
import { Notes } from "@/components/Notes";
import { convertTimeStrToSeconds } from "@/utils/utility";
import { useSoundStore } from "@/store/soundStore";

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();

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
    initializeWeightAndReps,
    nextSet,
    timerRunning,
    timerExpiry,
    startTimer,
    stopTimer,
    removeSet,
    addSet,
  } = useActiveWorkoutStore();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const { selectedExerciseIndex, workoutHistory } = useLocalSearchParams();

  useEffect(() => {
    if (workoutHistory) {
      const previousWorkoutData: CompletedWorkout[] = JSON.parse(
        workoutHistory as string,
      );
      initializeWeightAndReps(previousWorkoutData);
    }
  }, [workoutHistory, initializeWeightAndReps]);

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

  const findLastAvailableSetData = (exerciseId: number, setIndex: number) => {
    if (!previousWorkoutData) {
      return null;
    }

    for (const workout of previousWorkoutData) {
      const exerciseData = workout.exercises.find(
        (prevEx) => prevEx.exercise_id === exerciseId,
      );

      if (exerciseData && exerciseData.sets[setIndex]) {
        return exerciseData.sets[setIndex]; // Return the first non-null data found
      }
    }

    return null; // No data found in any past workout
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

  // Fetch animated image for current exercise
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

    // If we're more than 2 seconds late, assume background notification already played
    if (diffMs < 2000) {
      // user is in the foreground at the actual expiry
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
    if (timerRunning && timerExpiry) {
      const time = new Date(timerExpiry);
      expiryTimestampRef.current = time;
      restart(time);

      // Add debug breadcrumb
      Bugsnag.leaveBreadcrumb("Timer restarted", {
        timerExpiry: timerExpiry.toISOString(),
        currentTime: new Date().toISOString(),
      });
    }
  }, [timerRunning, timerExpiry, restart]);

  const startRestTimer = (restMinutes: number, restSeconds: number) => {
    if (restMinutes > 0 || restSeconds > 0) {
      const totalSeconds = restMinutes * 60 + restSeconds;
      cancelRestNotifications();

      if (settings?.restTimerNotification === "true") {
        scheduleRestNotification(
          totalSeconds,
          "Rest Timer Finished!",
          "Time to do your next set!",
          "rest-timer1",
        );
      }

      const time = new Date();
      time.setSeconds(time.getSeconds() + totalSeconds);
      expiryTimestampRef.current = time;
      startTimer(time);
      restart(time);

      // Add debug breadcrumb
      Bugsnag.leaveBreadcrumb("Timer started", {
        totalSeconds,
        expiryTimestamp: time.toISOString(),
        currentTime: new Date().toISOString(),
      });
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
    // Remove any non-digits first
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
    const newWeight = (currentWeight + amount).toFixed(1);
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
    const newReps = (currentReps + amount).toString();
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
    // Move to first set of next exercise
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
    // Move to last set of previous exercise
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

  const handlePreviousSet = () => {
    if (
      hasPreviousSet &&
      previousExerciseIndex !== null &&
      previousSetIndex !== null
    ) {
      setCurrentExerciseIndex(previousExerciseIndex as number);
      setCurrentSetIndex(
        previousExerciseIndex as number,
        previousSetIndex as number,
      );
    }
  };

  const handleNextSet = () => {
    if (hasNextSet) {
      setCurrentExerciseIndex(nextExerciseIndex);
      setCurrentSetIndex(nextExerciseIndex, nextSetIndex);
    }
  };

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Parse weight and reps, treating empty strings as zero
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

    // Convert time from MM:SS format to total seconds
    const validTimeNum = convertTimeStrToSeconds(timeStr);

    // Update the weightAndReps with valid values for the current set
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      validWeightInKg.toString(),
      validRepsNum.toString(),
      validTimeNum.toString(), // Store as seconds
    );

    if (hasNextSet) {
      startRestTimer(currentSet.restMinutes, currentSet.restSeconds);
      // Update state immediately without animation
      nextSet();
    } else {
      // No next set, workout completed
      nextSet();
    }
  };

  const weightIncrement = settings ? parseFloat(settings.weightIncrement) : 1;
  const buttonSize = settings
    ? settings.buttonSize === "Standard"
      ? 40
      : settings.buttonSize === "Large"
        ? 60
        : 80
    : 40;

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
      <View style={{ flex: 1 }}>
        <SessionSetInfo
          exercise_id={currentExercise?.exercise_id || 0}
          exerciseName={currentExercise?.name || ""}
          animatedUrl={animatedUrl}
          animatedImageLoading={animatedImageLoading}
          animatedImageError={animatedImageError}
          currentSetIndex={currentSetIndex}
          isLastSetOfLastExercise={currentIsLastSetOfLastExercise}
          isFirstSetOfFirstExercise={currentIsFirstSetOfFirstExercise}
          totalSets={currentExercise?.sets.length || 0}
          weight={weight}
          reps={reps}
          time={time}
          weightIncrement={weightIncrement}
          buttonSize={buttonSize}
          weightUnit={settings?.weightUnit || "kg"}
          restMinutes={currentSet?.restMinutes || 0}
          restSeconds={currentSet?.restSeconds || 0}
          repsMin={currentSet?.repsMin || 0}
          repsMax={currentSet?.repsMax || 0}
          timeMin={currentSet?.time || 0}
          currentSetCompleted={currentSetCompleted}
          isWarmup={currentSet?.isWarmup || false}
          isDropSet={currentSet?.isDropSet || false}
          isToFailure={currentSet?.isToFailure || false}
          trackingType={currentExercise?.tracking_type || "weight"}
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
      </View>
      {timerRunning ? (
        <ThemedView
          style={[styles.timerContainer, { paddingBottom: insets.bottom }]}
        >
          <ThemedText style={styles.timerLabel}>Rest Time Left:</ThemedText>
          <ThemedText style={styles.timerText}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </ThemedText>
        </ThemedView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
  },
  timerContainer: {
    position: "absolute",
    bottom: 0,
    right: 16,
    left: 16,
    width: "100%",
    height: 70,
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
    elevation: 5,
    marginBottom: 0,
  },
  timerLabel: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 4,
    textAlign: "center",
  },
  timerText: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.dark.text,
    textAlign: "center",
    lineHeight: 32,
  },
});
