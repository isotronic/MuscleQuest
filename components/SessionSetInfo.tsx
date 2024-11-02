import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { IconButton, ActivityIndicator, Button } from "react-native-paper";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";

const fallbackImage = require("@/assets/images/placeholder.webp");

interface SessionSetInfoProps {
  exercise_id: number;
  exerciseName: string;
  animatedUrl: string | undefined;
  animatedImageLoading: boolean;
  animatedImageError: Error | null;
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
  repsMin: number | undefined;
  repsMax: number | undefined;
  timeMin: number | undefined;
  currentSetCompleted: boolean;
  isWarmup: boolean;
  trackingType: string;
  handleWeightInputChange: (text: string) => void;
  handleWeightChange: (amount: number) => void;
  handleRepsInputChange: (text: string) => void;
  handleRepsChange: (amount: number) => void;
  handleTimeInputChange: (text: string) => void;
  handlePreviousSet: () => void;
  handleNextSet: () => void;
  handleCompleteSet: () => void;
  removeSet: (currentSetIndex: number) => void;
  addSet: () => void;
}

export default function SessionSetInfo({
  exercise_id,
  exerciseName,
  animatedUrl,
  animatedImageLoading,
  animatedImageError,
  currentSetIndex,
  totalSets,
  weight,
  reps,
  time,
  weightIncrement,
  buttonSize,
  weightUnit,
  restMinutes,
  restSeconds,
  repsMin,
  repsMax,
  timeMin,
  currentSetCompleted,
  isWarmup,
  trackingType,
  handleWeightInputChange,
  handleWeightChange,
  handleRepsInputChange,
  handleRepsChange,
  handleTimeInputChange,
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

  const handleImagePress = () => {
    router.push({
      pathname: "/(app)/exercise-details",
      params: { exercise_id: exercise_id.toString() },
    });
  };
  return (
    <View>
      <View style={styles.headerContainer}>
        {animatedImageLoading ? (
          <ActivityIndicator size="small" color={Colors.dark.text} />
        ) : animatedImageError ? (
          <ThemedText style={styles.loadingText}>Failed to load GIF</ThemedText>
        ) : animatedUrl ? (
          <TouchableOpacity onPress={handleImagePress}>
            <Image
              style={styles.animatedImage}
              source={{
                uri: animatedUrl,
              }}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleImagePress}>
            <Image style={styles.animatedImage} source={fallbackImage} />
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>{exerciseName}</ThemedText>

          {trackingType !== "time" && repRange && (
            <ThemedText style={styles.headerText}>Reps: {repRange}</ThemedText>
          )}
          {trackingType === "time" && timeMin && (
            <ThemedText style={styles.headerText}>
              Time: {timeMin} Seconds
            </ThemedText>
          )}

          <ThemedText style={styles.headerText}>
            Rest Time: {restMinutes}:{String(restSeconds).padStart(2, "0")}
          </ThemedText>
        </View>

        <IconButton
          icon="close"
          onPress={() => removeSet(currentSetIndex)}
          size={24}
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

      {/* Conditionally Render Weight/Assistance, Reps, or Time Input Fields */}
      {trackingType === "weight" ||
      trackingType === "assisted" ||
      trackingType === "" ||
      !trackingType ? (
        <>
          <View style={styles.centeredLabelContainer}>
            <ThemedText style={styles.label}>
              {trackingType === "weight" ? "Weight" : "Assistance"} (
              {weightUnit})
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
              placeholderTextColor={Colors.dark.text}
              value={weight}
              onChangeText={(text: string) => handleWeightInputChange(text)}
              keyboardType="numeric"
              selectTextOnFocus
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
        </>
      ) : null}
      {trackingType !== "time" ? (
        <>
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
              selectTextOnFocus
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
        </>
      ) : trackingType === "time" ? (
        <>
          <View style={styles.centeredLabelContainer}>
            <ThemedText style={styles.label}>Time (seconds)</ThemedText>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              placeholderTextColor={Colors.dark.text}
              value={time}
              onChangeText={(text: string) => handleTimeInputChange(text)}
              keyboardType="numeric"
              selectTextOnFocus
              style={styles.input}
            />
          </View>
        </>
      ) : null}

      <Button
        mode="contained"
        onPress={handleCompleteSet}
        labelStyle={
          buttonSize === 40 ? styles.buttonLabel : styles.largeButtonLabel
        }
        style={[
          styles.completeButton,
          buttonSize === 40 ? "" : styles.largeButton,
          currentSetCompleted && styles.disabledButton,
        ]}
        disabled={currentSetCompleted}
      >
        Complete Set
      </Button>

      {isLastSet && (
        <Button
          mode="outlined"
          onPress={addSet}
          labelStyle={
            buttonSize === 40 ? styles.buttonLabel : styles.largeButtonLabel
          }
          style={[
            styles.addSetButton,
            buttonSize === 40 ? "" : styles.largeButton,
          ]}
        >
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
  largeButton: {
    height: 55,
  },
  disabledButton: {
    backgroundColor: Colors.dark.disabledButtonBackground,
  },
  addSetButton: {
    marginTop: 8,
  },
  buttonLabel: {
    fontSize: 18,
  },
  largeButtonLabel: {
    fontSize: 24,
    lineHeight: 31,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
});
