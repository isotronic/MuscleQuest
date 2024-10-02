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

  const nextSetIndex =
    currentSetIndex + 1 < currentExercise!.sets.length
      ? currentSetIndex + 1
      : null;
  const previousSetIndex =
    currentSetIndex - 1 >= 0 ? currentSetIndex - 1 : null;

  const upcomingSet =
    nextSetIndex !== null ? currentExercise?.sets[nextSetIndex] : null;
  const previousSet =
    previousSetIndex !== null ? currentExercise?.sets[previousSetIndex] : null;

  const weight =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight || "0";
  const reps =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps || "0";

  const nextWeight =
    nextSetIndex !== null
      ? weightAndReps[currentExerciseIndex]?.[nextSetIndex]?.weight || "0"
      : null;
  const nextReps =
    nextSetIndex !== null
      ? weightAndReps[currentExerciseIndex]?.[nextSetIndex]?.reps || "0"
      : null;

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

  const handlePreviousSet = () => {
    if (previousSetIndex !== null) {
      setCurrentSetIndex(currentExerciseIndex, previousSetIndex);
    }
  };

  const handleNextSet = () => {
    if (nextSetIndex !== null) {
      setCurrentSetIndex(currentExerciseIndex, nextSetIndex);
    }
  };

  const handleSwipeGesture = ({ nativeEvent }: any) => {
    const { translationX, state } = nativeEvent;
    const swipeThreshold = 50;

    // Prevent swipe if there's no previous or next set
    if (
      (translationX > 0 && previousSetIndex === null) ||
      (translationX < 0 && nextSetIndex === null)
    ) {
      resetSwipe(); // Reset position immediately if no valid set to swipe to
      return;
    }

    if (state === State.ACTIVE && !isAnimating) {
      translateX.setValue(translationX);
    }

    if (state === State.END && !isAnimating) {
      if (translationX > swipeThreshold && previousSetIndex !== null) {
        // Swiping right to go to previous set
        animateSets(screenWidth, handlePreviousSet);
      } else if (translationX < -swipeThreshold && nextSetIndex !== null) {
        // Swiping left to go to next set
        animateSets(-screenWidth, handleNextSet);
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

    updateWeightAndReps(currentExerciseIndex, currentSetIndex, weight, reps);
    nextSet();
    startRestTimer(currentSet.restMinutes, currentSet.restSeconds);
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
          {nextSetIndex !== null && (
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
                exerciseName={currentExercise?.name || ""}
                animatedUrl={animatedUrl}
                animatedImageLoading={animatedImageLoading}
                animatedImageError={animatedImageError}
                currentSetIndex={nextSetIndex}
                totalSets={currentExercise?.sets.length || 0}
                weight={nextWeight || "0"}
                reps={nextReps || "0"}
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
          {previousSetIndex !== null && (
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
                exerciseName={currentExercise?.name || ""}
                animatedUrl={animatedUrl}
                animatedImageLoading={animatedImageLoading}
                animatedImageError={animatedImageError}
                currentSetIndex={previousSetIndex}
                totalSets={currentExercise?.sets.length || 0}
                weight={nextWeight || "0"}
                reps={nextReps || "0"}
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
