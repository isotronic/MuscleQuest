import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, Dimensions } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import SessionSetInfo from "@/components/SessionSetInfo";
import { useTimer } from "react-timer-hook";
import { Colors } from "@/constants/Colors";
import { useLocalSearchParams } from "expo-router";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

export default function WorkoutSessionScreen() {
  const screenWidth = Dimensions.get("window").width; // Get the screen width
  const translateX = useRef(new Animated.Value(0)).current;

  const [isAnimating, setIsAnimating] = useState(false);

  const {
    workout,
    currentExerciseIndex,
    currentSetIndices,
    weightAndReps,
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
  } = useActiveWorkoutStore();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const { selectedExerciseIndex, workoutHistory } = useLocalSearchParams();

  useEffect(() => {
    if (workoutHistory) {
      const previousWorkoutData: CompletedWorkout = JSON.parse(
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

  const weight =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight || "0";
  const reps =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps || "0";

  // Fetch animated image for current exercise
  const {
    data: animatedUrl,
    error: animatedImageError,
    isLoading: animatedImageLoading,
  } = useAnimatedImageQuery(currentExercise?.animated_url);

  useKeepScreenOn();

  const { seconds, minutes, restart } = useTimer({
    expiryTimestamp: timerExpiry || new Date(),
    autoStart: timerRunning,
    onExpire: () => stopTimer(),
  });

  useEffect(() => {
    if (timerRunning && timerExpiry) {
      restart(new Date(timerExpiry));
    }
  }, [timerRunning, timerExpiry, restart]);

  const startRestTimer = (restMinutes: number, restSeconds: number) => {
    const time = new Date();
    time.setSeconds(time.getSeconds() + restMinutes * 60 + restSeconds);
    startTimer(time);
    restart(time);
  };

  const handleWeightChange = (amount: number) => {
    const newWeight = (parseFloat(weight) + amount).toFixed(1);
    updateWeightAndReps(currentExerciseIndex, currentSetIndex, newWeight, reps);
  };

  const handleRepsChange = (amount: number) => {
    const newReps = (parseInt(reps) + amount).toString();
    updateWeightAndReps(currentExerciseIndex, currentSetIndex, weight, newReps);
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
  } = useAnimatedImageQuery(nextExercise?.animated_url);

  const nextWeight =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.weight || "0";
  const nextReps =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.reps || "0";

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
  } = useAnimatedImageQuery(previousExercise?.animated_url);

  const previousWeight =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.weight
      : "0";
  const previousReps =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.reps
      : "0";

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

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Prevent action if already animating
    if (isAnimating) {
      return;
    }

    updateWeightAndReps(currentExerciseIndex, currentSetIndex, weight, reps);

    if (hasNextSet) {
      // Trigger the same animation as swiping to next set
      animateSets(-screenWidth, () => {
        // After animation completes
        nextSet();
        startRestTimer(currentSet.restMinutes, currentSet.restSeconds);
      });
    } else {
      // No next set, workout completed
      nextSet();
      // Optionally navigate to a summary screen or perform other actions
    }
  };

  const weightIncrement = settings ? parseFloat(settings.weightIncrement) : 2.5;
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
    return <ThemedText>Error: {settingsError.message}</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <PanGestureHandler
        onGestureEvent={handleSwipeGesture}
        onHandlerStateChange={handleSwipeGesture}
      >
        <View>
          {/* Current set */}
          <Animated.View
            style={{
              transform: [{ translateX: translateX }],
              position: "absolute",
              width: "100%",
            }}
          >
            <SessionSetInfo
              exerciseName={currentExercise?.name || ""}
              animatedUrl={animatedUrl}
              animatedImageLoading={animatedImageLoading}
              animatedImageError={animatedImageError}
              currentSetIndex={currentSetIndex}
              totalSets={currentExercise?.sets.length || 0}
              weight={weight}
              reps={reps}
              weightIncrement={weightIncrement}
              buttonSize={buttonSize}
              weightUnit={settings?.weightUnit || "kg"}
              restMinutes={currentSet?.restMinutes || 0}
              restSeconds={currentSet?.restSeconds || 0}
              timerRunning={timerRunning}
              seconds={seconds}
              minutes={minutes}
              currentSetCompleted={currentSetCompleted}
              handleWeightChange={handleWeightChange}
              handleRepsChange={handleRepsChange}
              handlePreviousSet={handlePreviousSet}
              handleNextSet={handleNextSet}
              handleCompleteSet={handleCompleteSet}
            />
          </Animated.View>

          {/* Next set - initially off-screen */}
          {hasNextSet && (
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
                exerciseName={nextExerciseName}
                animatedUrl={nextAnimatedUrl}
                animatedImageLoading={nextAnimatedImageLoading}
                animatedImageError={nextAnimatedImageError}
                currentSetIndex={nextSetIndex}
                totalSets={nextExercise?.sets.length || 0}
                weight={nextWeight}
                reps={nextReps}
                weightIncrement={weightIncrement}
                buttonSize={buttonSize}
                weightUnit={settings?.weightUnit || "kg"}
                restMinutes={upcomingSet?.restMinutes || 0}
                restSeconds={upcomingSet?.restSeconds || 0}
                timerRunning={false} // Timer should only be running for the current set
                seconds={0}
                minutes={0}
                currentSetCompleted={false}
                handleWeightChange={() => {}}
                handleRepsChange={() => {}}
                handlePreviousSet={() => {}}
                handleNextSet={() => {}}
                handleCompleteSet={() => {}}
              />
            </Animated.View>
          )}

          {/* Previous set - initially off-screen */}
          {hasPreviousSet &&
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
                  exerciseName={previousExerciseName}
                  animatedUrl={previousAnimatedUrl}
                  animatedImageLoading={previousAnimatedImageLoading}
                  animatedImageError={previousAnimatedImageError}
                  currentSetIndex={previousSetIndex}
                  totalSets={previousExercise?.sets.length || 0}
                  weight={previousWeight}
                  reps={previousReps}
                  weightIncrement={weightIncrement}
                  buttonSize={buttonSize}
                  weightUnit={settings?.weightUnit || "kg"}
                  restMinutes={previousSet?.restMinutes || 0}
                  restSeconds={previousSet?.restSeconds || 0}
                  timerRunning={false} // Timer should only be running for the current set
                  seconds={0}
                  minutes={0}
                  currentSetCompleted={false}
                  handleWeightChange={() => {}}
                  handleRepsChange={() => {}}
                  handlePreviousSet={() => {}}
                  handleNextSet={() => {}}
                  handleCompleteSet={() => {}}
                />
              </Animated.View>
            )}
        </View>
      </PanGestureHandler>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
  },
});
