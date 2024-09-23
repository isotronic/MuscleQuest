import React, { useEffect } from "react";
import { TextInput, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, IconButton } from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTimer } from "react-timer-hook";
import FastImage from "react-native-fast-image";
import { Colors } from "@/constants/Colors";
import { useLocalSearchParams } from "expo-router";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

export default function WorkoutSessionScreen() {
  const {
    workout,
    currentExerciseIndex,
    currentSetIndices,
    weightAndReps, // Access weight and reps from the store
    completedSets,
    setCurrentExerciseIndex,
    setCurrentSetIndex,
    updateWeightAndReps, // Update weight and reps
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

  // Fetch the selected exercise from the workout based on the passed index
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

  // Retrieve current weight and reps for the current set
  const weight =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight || "0";
  const reps =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps || "0";

  const {
    data: animatedUrl,
    error: animatedImageError,
    isLoading: animatedImageLoading,
  } = useAnimatedImageQuery(currentExercise?.animated_url);

  useEffect(() => {
    let keepAwakeActive = false;

    if (settings?.keepScreenOn === "true") {
      activateKeepAwakeAsync().then(() => {
        keepAwakeActive = true;
      });
    }

    return () => {
      if (keepAwakeActive) {
        deactivateKeepAwake();
      }
    };
  }, [settings?.keepScreenOn]);

  // Timer hook for rest countdown
  const { seconds, minutes, restart } = useTimer({
    expiryTimestamp: timerExpiry || new Date(),
    autoStart: timerRunning,
    onExpire: () => stopTimer(),
  });

  // Handle restarting the timer when returning to the screen
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

  // Helper functions to handle plus/minus buttons
  const handleWeightChange = (amount: number) => {
    const newWeight = (parseFloat(weight) + amount).toFixed(1);
    updateWeightAndReps(currentExerciseIndex, currentSetIndex, newWeight, reps);
  };

  const handleRepsChange = (amount: number) => {
    const newReps = (parseInt(reps) + amount).toString();
    updateWeightAndReps(currentExerciseIndex, currentSetIndex, weight, newReps);
  };

  // Handle previous and next set buttons
  const handlePreviousSet = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentExerciseIndex, currentSetIndex - 1);
    }
  };

  const handleNextSet = () => {
    if (currentSetIndex < (currentExercise?.sets.length || 0) - 1) {
      setCurrentSetIndex(currentExerciseIndex, currentSetIndex + 1);
    }
  };

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Persist the current weight and reps for the current set
    updateWeightAndReps(currentExerciseIndex, currentSetIndex, weight, reps);

    nextSet();

    // Start rest timer for the current set
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
      {animatedImageLoading ? (
        <ThemedText style={styles.loadingText}>Loading GIF...</ThemedText>
      ) : animatedImageError ? (
        <ThemedText style={styles.loadingText}>Failed to load GIF</ThemedText>
      ) : animatedUrl ? (
        <FastImage
          style={styles.animatedImage}
          source={{
            uri: animatedUrl,
            priority: FastImage.priority.normal,
          }}
          resizeMode={FastImage.resizeMode.contain}
        />
      ) : (
        <ThemedText style={styles.loadingText}>No GIF available</ThemedText>
      )}

      <ThemedText style={styles.title}>{currentExercise?.name}</ThemedText>
      {/* Set Navigation */}
      <View style={styles.setNavigationContainer}>
        <IconButton
          icon="chevron-left"
          onPress={handlePreviousSet}
          size={buttonSize}
          disabled={currentSetIndex === 0} // Disable if on the first set
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
        <ThemedText>
          Set {currentSetIndex + 1} of {currentExercise?.sets.length}
        </ThemedText>
        <IconButton
          icon="chevron-right"
          onPress={handleNextSet}
          size={buttonSize}
          disabled={
            currentSetIndex === (currentExercise?.sets?.length || 0) - 1
          } // Disable if on the last set
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
      </View>

      {/* Weight Input */}
      <View style={styles.centeredLabelContainer}>
        <ThemedText style={styles.label}>
          Weight ({settings?.weightUnit})
        </ThemedText>
      </View>
      <View style={styles.inputContainer}>
        <IconButton
          icon="minus"
          onPress={() => handleWeightChange(-weightIncrement)}
          size={buttonSize}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
        <TextInput
          placeholder="Enter weight"
          placeholderTextColor={Colors.dark.text}
          value={weight} // Use weight from store
          onBlur={() => {
            const newWeight = isNaN(parseFloat(weight)) ? "0" : weight;
            updateWeightAndReps(
              currentExerciseIndex,
              currentSetIndex,
              newWeight,
              reps,
            );
          }}
          onChangeText={(text: string) => {
            const sanitizedValue = text.replace(/[^0-9.]/g, ""); // Keep only numbers and decimal
            updateWeightAndReps(
              currentExerciseIndex,
              currentSetIndex,
              Number.isInteger(parseFloat(sanitizedValue))
                ? sanitizedValue
                : parseFloat(sanitizedValue).toFixed(1),
              reps,
            );
          }}
          keyboardType="numeric"
          style={styles.input}
        />
        <IconButton
          icon="plus"
          onPress={() => handleWeightChange(weightIncrement)}
          size={buttonSize}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
      </View>

      {/* Reps Input */}
      <View style={styles.centeredLabelContainer}>
        <ThemedText style={styles.label}>Reps</ThemedText>
      </View>
      <View style={styles.inputContainer}>
        <IconButton
          icon="minus"
          onPress={() => handleRepsChange(-1)}
          size={buttonSize}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
        <TextInput
          placeholder="Enter reps"
          placeholderTextColor={Colors.dark.text}
          value={reps} // Use reps from store
          onBlur={() => {
            const newReps = isNaN(parseFloat(reps)) ? "0" : reps;
            updateWeightAndReps(
              currentExerciseIndex,
              currentSetIndex,
              weight,
              newReps,
            );
          }}
          onChangeText={(text: string) =>
            updateWeightAndReps(
              currentExerciseIndex,
              currentSetIndex,
              weight,
              text,
            )
          }
          keyboardType="numeric"
          style={styles.input}
        />
        <IconButton
          icon="plus"
          onPress={() => handleRepsChange(1)}
          size={buttonSize}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
      </View>

      <Button
        mode="contained"
        onPress={handleCompleteSet}
        style={[
          styles.completeButton,
          currentSetCompleted && styles.disabledButton,
          settings?.buttonSize === "Standard"
            ? {}
            : settings?.buttonSize === "Large"
              ? { height: 50 }
              : { height: 60 },
        ]}
        labelStyle={[
          currentSetCompleted ? styles.disabledButtonText : {},
          settings?.buttonSize === "Standard"
            ? {}
            : settings?.buttonSize === "Large"
              ? { fontSize: 20, lineHeight: 25 }
              : { fontSize: 24, lineHeight: 35 },
        ]}
        disabled={currentSetCompleted}
      >
        Complete Set
      </Button>

      {timerRunning && (
        <ThemedView style={styles.timerContainer}>
          <ThemedText style={styles.timerLabel}>Rest Time Left:</ThemedText>
          <ThemedText style={styles.timerText}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  animatedImage: {
    width: "100%",
    height: 150,
    marginBottom: 20,
  },
  centeredLabelContainer: {
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconButton: {
    marginHorizontal: 5,
    color: Colors.dark.text,
  },
  setNavigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
    color: Colors.dark.text,
  },
  completeButton: {
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: Colors.dark.disabledButtonBackground, // Custom disabled background color
  },
  disabledButtonText: {
    color: Colors.dark.disabledButtonText, // Custom disabled text color
    opacity: 0.6, // Make the text slightly faded
  },
  timerContainer: {
    padding: 20,
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginBottom: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: "column",
  },

  timerLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 10,
    textAlign: "center",
  },

  timerText: {
    fontSize: 48,
    fontWeight: "bold",
    color: Colors.dark.text,
    textAlign: "center",
    lineHeight: 48,
  },

  loadingText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
});
