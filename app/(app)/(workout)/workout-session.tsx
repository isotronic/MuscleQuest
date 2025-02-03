import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Dimensions,
  Alert,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { PanGestureHandler, State } from "react-native-gesture-handler";
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
import { useSoundAndVibration } from "@/hooks/useSoundAndVibration";
import WorkoutTimer from "@/components/WorkoutTimer";
import Bugsnag from "@bugsnag/expo";
import {
  cancelRestNotifications,
  scheduleRestNotification,
} from "@/utils/restNotification";

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width; // Get the screen width
  const translateX = useRef(new Animated.Value(0)).current;

  const [isAnimating, setIsAnimating] = useState(false);
  const [nextSetData, setNextSetData] = useState<{
    weight?: string;
    reps?: string;
    time?: string;
  }>({});

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
  const { playSound, triggerVibration } = useSoundAndVibration();
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
      return;
    }

    const now = new Date();
    const diffMs = now.getTime() - expiryTimestampRef.current.getTime();

    // If we're more than 2 seconds late, assume background notification already played
    if (diffMs < 2000) {
      // user is in the foreground at the actual expiry
      if (settings?.restTimerSound === "true") {
        await playSound();
      }
      if (settings?.restTimerVibration === "true") {
        triggerVibration();
      }
      // Cancel the local notification so it won't show
      cancelRestNotifications();
    }
  }

  useEffect(() => {
    if (timerRunning && timerExpiry) {
      restart(new Date(timerExpiry));
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
    const sanitizedInput = inputValue.replace(/[^0-9.]/g, "");
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

  // Next set data
  const nextExercise = hasNextSet ? workout.exercises[nextExerciseIndex] : null;
  const upcomingSet = nextExercise ? nextExercise.sets[nextSetIndex] : null;
  const nextExerciseName = nextExercise?.name || "";
  const {
    data: nextAnimatedUrl,
    error: nextAnimatedImageError,
    isLoading: nextAnimatedImageLoading,
  } = useAnimatedImageQuery(
    nextExercise?.exercise_id || 0,
    nextExercise?.animated_url || "",
    nextExercise?.local_animated_uri,
  );

  const previousWorkoutNextSetData = findLastAvailableSetData(
    nextExercise?.exercise_id || 0,
    nextSetIndex,
  );

  const nextWeight =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.weight ??
    previousWorkoutNextSetData?.weight?.toString() ??
    "";

  const nextReps =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.reps ??
    previousWorkoutNextSetData?.reps?.toString() ??
    "";

  const nextTime =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.time ??
    previousWorkoutNextSetData?.time?.toString() ??
    "";

  // Previous set data
  const previousExercise =
    hasPreviousSet && previousExerciseIndex !== null
      ? workout.exercises[previousExerciseIndex]
      : null;
  const previousSet =
    previousExercise && previousSetIndex !== null
      ? previousExercise.sets[previousSetIndex]
      : null;
  const previousExerciseName = previousExercise?.name || "";
  const {
    data: previousAnimatedUrl,
    error: previousAnimatedImageError,
    isLoading: previousAnimatedImageLoading,
  } = useAnimatedImageQuery(
    previousExercise?.exercise_id || 0,
    previousExercise?.animated_url || "",
    previousExercise?.local_animated_uri,
  );

  const previousExerciseData = previousWorkoutData
    ?.map((workout) => workout.exercises)
    .flat()
    .find((prevEx) => prevEx.exercise_id === previousExercise?.exercise_id);

  let previousSetData = null;

  if (previousSetIndex !== null && previousExerciseData) {
    previousSetData = previousExerciseData.sets[previousSetIndex];
  }

  const previousWeight =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.weight ??
        previousSetData?.weight?.toString() ??
        ""
      : "";

  const previousReps =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.reps ??
        previousSetData?.reps?.toString() ??
        ""
      : "";

  const previousTime =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.time ??
        previousSetData?.time?.toString() ??
        ""
      : "";

  const previousSetCompleted =
    previousExerciseIndex !== null &&
    previousSetIndex !== null &&
    completedSets[previousExerciseIndex] &&
    typeof completedSets[previousExerciseIndex][previousSetIndex] === "boolean"
      ? completedSets[previousExerciseIndex][previousSetIndex]
      : false;

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

  const nextIsLastSetOfLastExercise =
    workout &&
    nextExercise &&
    nextExerciseIndex === workout.exercises.length - 1 &&
    nextSetIndex === nextExercise.sets.length - 1;

  const nextIsFirstSetOfFirstExercise =
    workout && nextExercise && nextExerciseIndex === 0 && nextSetIndex === 0;

  const previousIsLastSetOfLastExercise =
    workout &&
    previousExercise &&
    previousExerciseIndex === workout.exercises.length - 1 &&
    previousSetIndex === previousExercise.sets.length - 1;

  const previousIsFirstSetOfFirstExercise =
    workout &&
    previousExercise &&
    previousExerciseIndex === 0 &&
    previousSetIndex === 0;

  const handlePreviousSet = () => {
    if (
      hasPreviousSet &&
      !isAnimating &&
      previousExerciseIndex !== null &&
      previousSetIndex !== null
    ) {
      animateSets(screenWidth, () => {
        setCurrentExerciseIndex(previousExerciseIndex as number);
        setCurrentSetIndex(
          previousExerciseIndex as number,
          previousSetIndex as number,
        );
      });
    }
  };

  const handleNextSet = () => {
    if (hasNextSet && !isAnimating) {
      animateSets(-screenWidth, () => {
        setCurrentExerciseIndex(nextExerciseIndex);
        setCurrentSetIndex(nextExerciseIndex, nextSetIndex);
      });
    }
  };

  const handleSwipeGesture = ({ nativeEvent }: any) => {
    const { translationX, state } = nativeEvent;
    const swipeThreshold = 50;

    if (state === State.ACTIVE && !isAnimating) {
      translateX.setValue(translationX);
    }

    if (state === State.END && !isAnimating) {
      if (
        translationX > swipeThreshold &&
        hasPreviousSet &&
        previousExerciseIndex !== null &&
        previousSetIndex !== null
      ) {
        // Swiping right to go to previous set
        animateSets(screenWidth, () => {
          setCurrentExerciseIndex(previousExerciseIndex);
          setCurrentSetIndex(previousExerciseIndex, previousSetIndex);
        });
      } else if (translationX < -swipeThreshold && hasNextSet) {
        // Swiping left to go to next set
        animateSets(-screenWidth, () => {
          setCurrentExerciseIndex(nextExerciseIndex);
          setCurrentSetIndex(nextExerciseIndex, nextSetIndex);
        });
      } else {
        resetSwipe();
      }
    }
  };

  const animateSets = (direction: number, callback: () => void) => {
    setIsAnimating(true);

    Animated.timing(translateX, {
      toValue: direction,
      duration: 250,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setIsAnimating(false);
      translateX.setValue(0);
      callback();
    });
  };

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const getNextSetData = () => {
    // Compute temporary next indices
    let tempNextExerciseIndex = currentExerciseIndex;
    let tempNextSetIndex = currentSetIndex + 1;

    if (currentExercise && tempNextSetIndex >= currentExercise.sets.length) {
      tempNextExerciseIndex += 1;
      tempNextSetIndex = 0;
    }

    if (
      workout &&
      tempNextExerciseIndex < workout.exercises.length &&
      workout.exercises[tempNextExerciseIndex].sets[tempNextSetIndex]
    ) {
      const nextExercise = workout.exercises[tempNextExerciseIndex];
      const previousWorkoutNextSetData = previousWorkoutData
        ?.map((workout) => workout.exercises)
        .flat()
        .find((prevEx) => prevEx.exercise_id === nextExercise?.exercise_id)
        ?.sets[tempNextSetIndex];

      // Logic to carry over weight/reps from current set
      const currentSetValues =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex] || {};

      const { isWarmup, isDropSet } =
        workout.exercises[currentExerciseIndex].sets[currentSetIndex];

      const isNextDropSet =
        workout.exercises[currentExerciseIndex].sets[tempNextSetIndex]
          .isDropSet;

      const nextSetValues = {
        weight:
          (isWarmup || isDropSet || isNextDropSet) &&
          previousWorkoutNextSetData?.weight
            ? previousWorkoutNextSetData?.weight?.toString()
            : currentSetValues.weight || "",
        reps: previousWorkoutNextSetData?.reps?.toString() || "",
        time: previousWorkoutNextSetData?.time?.toString() || "",
      };

      return {
        weight: nextSetValues.weight,
        reps: nextSetValues.reps,
        time: nextSetValues.time,
      };
    } else {
      return {};
    }
  };

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Prevent action if already animating
    if (isAnimating) {
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

    const timeNum = parseInt(timeStr);
    const validTimeNum = isNaN(timeNum) ? 0 : timeNum;

    // Update the weightAndReps with valid values for the current set
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      validWeightInKg.toString(),
      validRepsNum.toString(),
      validTimeNum.toString(),
    );

    if (hasNextSet) {
      startRestTimer(currentSet.restMinutes, currentSet.restSeconds);

      // Compute next set data with carried-over weight
      const nextSetInfo = getNextSetData();
      setNextSetData(nextSetInfo);

      // Start animation
      animateSets(-screenWidth, () => {
        // Update indices after animation completes
        nextSet();
        // Clear nextSetData
        setNextSetData({});
      });
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
          headerRight: () => <WorkoutTimer />,
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
