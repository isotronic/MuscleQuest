import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { IconButton, ActivityIndicator, Button } from "react-native-paper";
import FastImage from "react-native-fast-image";
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
  currentSetCompleted: boolean;
  handleWeightInputChange: (text: string) => void;
  handleWeightChange: (amount: number) => void;
  handleRepsInputChange: (text: string) => void;
  handleRepsChange: (amount: number) => void;
  handlePreviousSet: () => void;
  handleNextSet: () => void;
  handleCompleteSet: () => void;
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
  currentSetCompleted,
  handleWeightInputChange,
  handleWeightChange,
  handleRepsInputChange,
  handleRepsChange,
  handlePreviousSet,
  handleNextSet,
  handleCompleteSet,
}: SessionSetInfoProps) {
  return (
    <View>
      <View style={styles.headerContainer}>
        {animatedImageLoading ? (
          <ActivityIndicator size="small" color={Colors.dark.text} />
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

        <View style={styles.titleContainer}>
          <ThemedText style={styles.title}>{exerciseName}</ThemedText>
          <ThemedText style={styles.restTime}>
            Rest Time: {restMinutes} min {restSeconds} sec
          </ThemedText>
        </View>
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
        <ThemedText>
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  animatedImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 15,
  },
  titleContainer: {
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  restTime: {
    fontSize: 14,
    color: Colors.dark.subText,
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
    backgroundColor: Colors.dark.disabledButtonBackground,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
});
