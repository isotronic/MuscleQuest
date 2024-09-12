import React, { useState, useEffect } from "react";
import { TextInput, StyleSheet, View } from "react-native";
import { Button, IconButton } from "react-native-paper";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTimer } from "react-timer-hook";
import storage from "@react-native-firebase/storage";
import FastImage from "react-native-fast-image";
import { Colors } from "@/constants/Colors";
import { useLocalSearchParams } from "expo-router";

export default function WorkoutSessionScreen() {
  const {
    workout,
    currentExerciseIndex,
    currentSetIndices,
    setCurrentExerciseIndex,
    setCurrentSetIndex,
    nextSet,
    timerRunning,
    timerExpiry,
    startTimer,
    stopTimer,
  } = useActiveWorkoutStore();
  const [weight, setWeight] = useState("0");
  const [reps, setReps] = useState("0");
  const [animatedUrl, setAnimatedUrl] = useState<string | null>(null);

  const { selectedExerciseIndex } = useLocalSearchParams(); // Get the selected exercise index

  // Fetch the selected exercise from the workout based on the passed index
  useEffect(() => {
    if (workout && selectedExerciseIndex !== undefined) {
      setCurrentExerciseIndex(Number(selectedExerciseIndex)); // Set current exercise
      setWeight("0");
      setReps("0");
    }
  }, [selectedExerciseIndex, setCurrentExerciseIndex, stopTimer, workout]);

  const currentExercise = workout?.exercises[currentExerciseIndex];
  const currentSetIndex = currentSetIndices[currentExerciseIndex] || 0;
  const currentSet = currentExercise?.sets[currentSetIndex];

  // Fetch animated webp image
  useEffect(() => {
    if (currentExercise?.animated_url) {
      const loadAnimatedImage = async () => {
        try {
          const url = await storage()
            .ref(currentExercise.animated_url)
            .getDownloadURL();
          setAnimatedUrl(url);
        } catch (error) {
          console.error("Failed to load WebP:", error);
        }
      };
      loadAnimatedImage();
    }
  }, [currentExercise?.animated_url]);

  // Timer hook for rest countdown
  const { seconds, minutes, restart } = useTimer({
    expiryTimestamp: timerExpiry || new Date(),
    autoStart: timerRunning, // Auto-start the timer if it was running
    onExpire: () => stopTimer(),
  });

  // Handle restarting the timer when returning to the screen
  useEffect(() => {
    if (timerRunning && timerExpiry) {
      restart(new Date(timerExpiry)); // Restart the timer with the stored expiry
    }
  }, [timerRunning, timerExpiry, restart]);

  const startRestTimer = (restMinutes: number, restSeconds: number) => {
    const time = new Date();
    time.setSeconds(time.getSeconds() + restMinutes * 60 + restSeconds);
    startTimer(time); // Start the timer globally with expiry
    restart(time); // Start the countdown timer in the UI
  };

  if (!workout) {
    return <ThemedText>Workout complete!</ThemedText>;
  }

  // Helper functions to handle plus/minus buttons
  const handleWeightChange = (amount: number) => {
    setWeight((prevWeight) => {
      const newWeight = parseFloat(prevWeight) + amount;
      return Number.isInteger(newWeight)
        ? newWeight.toString()
        : newWeight.toFixed(1);
    });
  };

  const handleRepsChange = (amount: number) => {
    setReps((prevReps) => (parseInt(prevReps) + amount).toString());
  };

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    if (currentSet) {
      startRestTimer(currentSet.restMinutes, currentSet.restSeconds);
    }

    const isLastSet = currentSetIndex === currentExercise.sets.length - 1;
    nextSet();

    if (isLastSet) {
      setWeight("0");
      setReps("0");
    }
  };

  return (
    <ThemedView style={styles.container}>
      {animatedUrl ? (
        <FastImage
          style={styles.animatedImage}
          source={{
            uri: animatedUrl,
            priority: FastImage.priority.normal,
          }}
          resizeMode={FastImage.resizeMode.contain}
        />
      ) : (
        <ThemedText style={styles.loadingText}>Loading GIF...</ThemedText>
      )}

      <ThemedText style={styles.title}>{currentExercise?.name}</ThemedText>
      <ThemedText>
        Set {currentSetIndex + 1} of {currentExercise?.sets.length}
      </ThemedText>

      {/* Weight Input */}
      <View style={styles.centeredLabelContainer}>
        <ThemedText style={styles.label}>Weight (kg)</ThemedText>
      </View>
      <View style={styles.inputContainer}>
        <IconButton
          icon="minus"
          onPress={() => handleWeightChange(-1)}
          size={40}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
        <TextInput
          placeholder="Enter weight"
          placeholderTextColor={Colors.dark.text}
          value={weight}
          onBlur={() => {
            setWeight((prevWeight) =>
              isNaN(parseFloat(prevWeight)) ? "0" : prevWeight,
            );
          }}
          onChangeText={(text: string) => {
            // If the input is empty, set it to an empty string to trigger the placeholder
            if (text === "") {
              setWeight("");
            } else {
              const value = text.replace(/[^0-9.]/g, ""); // Keep only numbers and decimal
              setWeight(
                Number.isInteger(parseFloat(value))
                  ? value
                  : parseFloat(value).toFixed(1),
              );
            }
          }}
          keyboardType="numeric"
          style={styles.input}
        />
        <IconButton
          icon="plus"
          onPress={() => handleWeightChange(1)}
          size={40}
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
          size={40}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
        <TextInput
          placeholder="Enter reps"
          placeholderTextColor={Colors.dark.text}
          value={reps}
          onBlur={() => {
            setReps((prevReps) =>
              isNaN(parseFloat(prevReps)) ? "0" : prevReps,
            );
          }}
          onChangeText={setReps}
          keyboardType="numeric"
          style={styles.input}
        />
        <IconButton
          icon="plus"
          onPress={() => handleRepsChange(1)}
          size={40}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
      </View>

      <Button
        mode="contained"
        onPress={handleCompleteSet}
        style={styles.completeButton}
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
    marginBottom: 20,
  },
  animatedImage: {
    width: "100%",
    height: 200,
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
  timerContainer: {
    padding: 20,
    backgroundColor: Colors.dark.cardBackground,
    alignItems: "center",
    justifyContent: "center", // Center everything in the container
    borderRadius: 10,
    marginBottom: 20,
    marginTop: 20, // Create space above the timer container
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: "column", // Ensure label and timer are stacked vertically
  },

  timerLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 10, // Add margin below the label to create space between the label and the timer
    textAlign: "center", // Center the label
  },

  timerText: {
    fontSize: 48,
    fontWeight: "bold",
    color: Colors.dark.text,
    textAlign: "center", // Center the timer text
    lineHeight: 48,
  },

  loadingText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
});
