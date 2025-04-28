import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { PanGestureHandler } from "react-native-gesture-handler";
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
  scheduleRestNotification,
} from "@/utils/restNotification";
import { Notes } from "@/components/Notes";
import { useSoundStore } from "@/store/soundStore";
import { useWorkoutSessionLogic } from "@/hooks/useWorkoutSessionLogic";
import { useSwipeAnimation } from "@/hooks/useSwipeAnimation";

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();

  console.log("Workout Session Screen load");

  const [nextSetData, setNextSetData] = useState<{
    weight?: string;
    reps?: string;
    time?: string;
  }>({});

  const { selectedExerciseIndex, workoutHistory } = useLocalSearchParams();

  // Use the workout session logic hook
  const sessionLogic = useWorkoutSessionLogic(
    selectedExerciseIndex,
    workoutHistory,
  );

  const { timerRunning, timerExpiry, startTimer, stopTimer, addSet } =
    useActiveWorkoutStore();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  // Extract data from the session logic hook
  const {
    // Current set data
    currentExercise,
    currentSetIndex,
    currentSet,
    currentSetCompleted,
    weight,
    reps,
    time,

    // Next set data
    hasNextSet,
    nextExerciseIndex,
    nextSetIndex,
    nextExercise,
    upcomingSet,
    nextExerciseName,
    nextWeight,
    nextReps,
    nextTime,
    nextIsLastSetOfLastExercise,
    nextIsFirstSetOfFirstExercise,

    // Previous set data
    hasPreviousSet,
    previousExerciseIndex,
    previousSetIndex,
    previousExercise,
    previousSet,
    previousExerciseName,
    previousWeight,
    previousReps,
    previousTime,
    previousSetCompleted,
    previousIsLastSetOfLastExercise,
    previousIsFirstSetOfFirstExercise,

    // Position indicators
    currentIsLastSetOfLastExercise,
    currentIsFirstSetOfFirstExercise,

    // Actions
    handleWeightInputChange,
    handleRepsInputChange,
    handleTimeInputChange,
    handleWeightChange,
    handleRepsChange,
    handleRemoveSet,
    handleCompleteSet,
    getNextSetData,
    setCurrentExerciseAndSetIndex,
  } = sessionLogic;

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

  // All input handling functions are now provided by the hook

  // Animation and UI state management
  const {
    data: nextAnimatedUrl,
    error: nextAnimatedImageError,
    isLoading: nextAnimatedImageLoading,
  } = useAnimatedImageQuery(
    nextExercise?.exercise_id || 0,
    nextExercise?.animated_url || "",
    nextExercise?.local_animated_uri,
  );

  const {
    data: previousAnimatedUrl,
    error: previousAnimatedImageError,
    isLoading: previousAnimatedImageLoading,
  } = useAnimatedImageQuery(
    previousExercise?.exercise_id || 0,
    previousExercise?.animated_url || "",
    previousExercise?.local_animated_uri,
  );

  // Initialize the swipe animation hook
  const {
    translateX,
    isAnimating,
    handleSwipeGesture,
    animateSets,
    screenWidth,
  } = useSwipeAnimation({
    onSwipeLeft: hasNextSet
      ? () => {
          setCurrentExerciseAndSetIndex(nextExerciseIndex, nextSetIndex);
        }
      : undefined,
    onSwipeRight:
      hasPreviousSet &&
      previousExerciseIndex !== null &&
      previousSetIndex !== null
        ? () => {
            setCurrentExerciseAndSetIndex(
              previousExerciseIndex as number,
              previousSetIndex as number,
            );
          }
        : undefined,
  });

  const handlePreviousSet = () => {
    if (
      hasPreviousSet &&
      !isAnimating &&
      previousExerciseIndex !== null &&
      previousSetIndex !== null
    ) {
      animateSets(screenWidth, () => {
        setCurrentExerciseAndSetIndex(
          previousExerciseIndex as number,
          previousSetIndex as number,
        );
      });
    }
  };

  const handleNextSet = () => {
    if (hasNextSet && !isAnimating) {
      animateSets(-screenWidth, () => {
        setCurrentExerciseAndSetIndex(nextExerciseIndex, nextSetIndex);
      });
    }
  };

  // These functions are now provided by the hook

  // Custom wrapper for handleCompleteSet that adds timer functionality
  const handleCompleteSetWithTimer = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Prevent action if already animating
    if (isAnimating) {
      return;
    }

    // Start the rest timer before completing the set
    if (hasNextSet) {
      startRestTimer(currentSet.restMinutes, currentSet.restSeconds);
    }

    // Get next set data with carried-over weight
    const nextSetInfo = getNextSetData();
    setNextSetData(nextSetInfo);

    // Call the hook's handleCompleteSet function
    handleCompleteSet();

    // Animate to the next set if there is one
    if (hasNextSet) {
      // Start animation
      animateSets(-screenWidth, () => {
        // Clear nextSetData after animation completes
        setNextSetData({});
      });
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
      <PanGestureHandler
        onGestureEvent={handleSwipeGesture}
        onHandlerStateChange={handleSwipeGesture}
      >
        <View>
          <Animated.View
            style={{
              transform: [{ translateX: translateX }],
              position: "absolute",
              width: "100%",
            }}
          >
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
              handleCompleteSet={handleCompleteSetWithTimer}
              removeSet={handleRemoveSet}
              addSet={addSet}
            />
          </Animated.View>

          {!!hasNextSet && (
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: Animated.add(
                      translateX,
                      new Animated.Value(screenWidth),
                    ),
                  },
                ],
                position: "absolute",
                width: "100%",
              }}
            >
              <SessionSetInfo
                exercise_id={nextExercise?.exercise_id || 0}
                exerciseName={nextExerciseName}
                animatedUrl={nextAnimatedUrl}
                animatedImageLoading={nextAnimatedImageLoading}
                animatedImageError={nextAnimatedImageError}
                isLastSetOfLastExercise={nextIsLastSetOfLastExercise}
                isFirstSetOfFirstExercise={nextIsFirstSetOfFirstExercise}
                currentSetIndex={nextSetIndex}
                totalSets={nextExercise?.sets.length || 0}
                weight={nextSetData.weight || nextWeight}
                reps={nextSetData.reps || nextReps}
                time={nextSetData.time || nextTime}
                weightIncrement={weightIncrement}
                buttonSize={buttonSize}
                weightUnit={settings?.weightUnit || "kg"}
                restMinutes={upcomingSet?.restMinutes || 0}
                restSeconds={upcomingSet?.restSeconds || 0}
                repsMin={upcomingSet?.repsMin || 0}
                repsMax={upcomingSet?.repsMax || 0}
                timeMin={upcomingSet?.time || 0}
                currentSetCompleted={false}
                isWarmup={upcomingSet?.isWarmup || false}
                isDropSet={upcomingSet?.isDropSet || false}
                isToFailure={upcomingSet?.isToFailure || false}
                trackingType={nextExercise?.tracking_type || "weight"}
                handleWeightInputChange={() => {}}
                handleWeightChange={() => {}}
                handleRepsInputChange={() => {}}
                handleRepsChange={() => {}}
                handleTimeInputChange={() => {}}
                handlePreviousSet={() => {}}
                handleNextSet={() => {}}
                handleCompleteSet={() => {}}
                removeSet={() => {}}
                addSet={() => {}}
              />
            </Animated.View>
          )}

          {!!hasPreviousSet &&
            previousExerciseIndex !== null &&
            previousSetIndex !== null && (
              <Animated.View
                style={{
                  transform: [
                    {
                      translateX: Animated.add(
                        translateX,
                        new Animated.Value(-screenWidth),
                      ),
                    },
                  ],
                  position: "absolute",
                  width: "100%",
                }}
              >
                <SessionSetInfo
                  exercise_id={previousExercise?.exercise_id || 0}
                  exerciseName={previousExerciseName}
                  animatedUrl={previousAnimatedUrl}
                  animatedImageLoading={previousAnimatedImageLoading}
                  animatedImageError={previousAnimatedImageError}
                  isLastSetOfLastExercise={previousIsLastSetOfLastExercise}
                  isFirstSetOfFirstExercise={previousIsFirstSetOfFirstExercise}
                  currentSetIndex={previousSetIndex}
                  totalSets={previousExercise?.sets.length || 0}
                  weight={previousWeight || ""}
                  reps={previousReps || ""}
                  time={previousTime || ""}
                  weightIncrement={weightIncrement}
                  buttonSize={buttonSize}
                  weightUnit={settings?.weightUnit || "kg"}
                  restMinutes={previousSet?.restMinutes || 0}
                  restSeconds={previousSet?.restSeconds || 0}
                  repsMin={previousSet?.repsMin || 0}
                  repsMax={previousSet?.repsMax || 0}
                  timeMin={previousSet?.time || 0}
                  currentSetCompleted={previousSetCompleted}
                  isWarmup={previousSet?.isWarmup || false}
                  isDropSet={previousSet?.isDropSet || false}
                  isToFailure={previousSet?.isToFailure || false}
                  trackingType={previousExercise?.tracking_type || "weight"}
                  handleWeightInputChange={() => {}}
                  handleWeightChange={() => {}}
                  handleRepsInputChange={() => {}}
                  handleRepsChange={() => {}}
                  handleTimeInputChange={() => {}}
                  handlePreviousSet={() => {}}
                  handleNextSet={() => {}}
                  handleCompleteSet={() => {}}
                  removeSet={() => {}}
                  addSet={() => {}}
                />
              </Animated.View>
            )}
        </View>
      </PanGestureHandler>
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
