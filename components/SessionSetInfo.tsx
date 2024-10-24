import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { IconButton, ActivityIndicator, Button } from "react-native-paper";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

interface SessionSetInfoProps {
  exerciseName: string;
  animatedUrl: string | undefined;
  animatedImageLoading: boolean;
  animatedImageError: Error | null;
  currentSetIndex: number;
  totalSets: number;
  weight: string;
  reps: string;
  weightIncrement: number;
  buttonSize: number;
  weightUnit: string;
  restMinutes: number;
  restSeconds: number;
  repsMin: number | undefined;
  repsMax: number | undefined;
  currentSetCompleted: boolean;
  isWarmup: boolean;
  handleWeightInputChange: (text: string) => void;
  handleWeightChange: (amount: number) => void;
  handleRepsInputChange: (text: string) => void;
  handleRepsChange: (amount: number) => void;
  handlePreviousSet: () => void;
  handleNextSet: () => void;
  handleCompleteSet: () => void;
  removeSet: (currentSetIndex: number) => void;
  addSet: () => void;
}

export default function SessionSetInfo({
  exerciseName,
  animatedUrl,
  animatedImageLoading,
  animatedImageError,
  currentSetIndex,
  totalSets,
  weight,
  reps,
  weightIncrement,
  buttonSize,
  weightUnit,
  restMinutes,
  restSeconds,
  repsMin,
  repsMax,
  currentSetCompleted,
  isWarmup,
  handleWeightInputChange,
  handleWeightChange,
  handleRepsInputChange,
  handleRepsChange,
  handlePreviousSet,
  handleNextSet,
  handleCompleteSet,
  removeSet,
  addSet,
}: SessionSetInfoProps) {
  const repRange =
    repsMin === repsMax
      ? repsMin
      : !repsMin
        ? repsMax
        : repsMax
          ? `${repsMin} - ${repsMax}`
          : repsMin;

  const isLastSet = currentSetIndex === totalSets - 1;
  return (
    <View>
      <View style={styles.headerContainer}>
        {animatedImageLoading ? (
          <ActivityIndicator size="small" color={Colors.dark.text} />
        ) : animatedImageError ? (
          <ThemedText style={styles.loadingText}>Failed to load GIF</ThemedText>
        ) : animatedUrl ? (
          <Image
            style={styles.animatedImage}
            source={{
              uri: animatedUrl,
            }}
          />
        ) : (
          <ThemedText style={styles.loadingText}>No GIF available</ThemedText>
        )}

        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>{exerciseName}</ThemedText>

          {repRange && (
            <ThemedText style={styles.headerText}>Reps: {repRange}</ThemedText>
          )}

          <ThemedText style={styles.headerText}>
            Rest Time: {restMinutes}:{String(restSeconds).padStart(2, "0")}
          </ThemedText>
        </View>

        {/* Add Close Button to remove set */}
        <IconButton
          icon="close"
          onPress={() => removeSet(currentSetIndex)} // Remove the set
          size={24} // Small size for close button
          iconColor={Colors.dark.text}
          style={styles.closeButton}
        />
      </View>

      {/* Set Navigation */}
      <View style={styles.setNavigationContainer}>
        <IconButton
          icon="chevron-left"
          onPress={handlePreviousSet}
          size={buttonSize}
          disabled={currentSetIndex === 0}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
        <ThemedText style={styles.setNavigationText}>
          Set {currentSetIndex + 1} of {totalSets}
        </ThemedText>
        <IconButton
          icon="chevron-right"
          onPress={handleNextSet}
          size={buttonSize}
          disabled={currentSetIndex === totalSets - 1}
          iconColor={Colors.dark.text}
          style={styles.iconButton}
        />
      </View>

      {isWarmup && (
        <View style={styles.centeredLabelContainer}>
          <ThemedText style={styles.warmupLabel}>Warm-up</ThemedText>
        </View>
      )}

      {/* Weight Input */}
      <View style={styles.centeredLabelContainer}>
        <ThemedText style={styles.label}>Weight ({weightUnit})</ThemedText>
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
          placeholderTextColor={Colors.dark.text}
          value={weight}
          onChangeText={(text: string) => handleWeightInputChange(text)}
          keyboardType="numeric"
          selectTextOnFocus={true}
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
          placeholderTextColor={Colors.dark.text}
          value={reps}
          onChangeText={(text: string) => handleRepsInputChange(text)}
          keyboardType="numeric"
          selectTextOnFocus={true}
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
        ]}
        disabled={currentSetCompleted}
      >
        Complete Set
      </Button>
      {/* Conditionally render the Add Set button */}
      {isLastSet && (
        <Button mode="outlined" onPress={addSet} style={styles.addSetButton}>
          Add Set
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  animatedImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 16,
  },
  titleContainer: {
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerText: {
    fontSize: 14,
    color: Colors.dark.subText,
    marginBottom: -5,
  },
  closeButton: {
    marginLeft: "auto",
    marginBottom: "auto",
  },
  centeredLabelContainer: {
    alignItems: "center",
  },
  warmupLabel: {
    fontSize: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconButton: {
    marginHorizontal: 5,
    color: Colors.dark.text,
  },
  setNavigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  setNavigationText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 26,
    color: Colors.dark.text,
  },
  completeButton: {
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: Colors.dark.disabledButtonBackground,
  },
  addSetButton: {
    marginTop: 8,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
});
