import React, { useState, useCallback } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import {
  IconButton,
  ActivityIndicator,
  Button,
  Menu,
} from "react-native-paper";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatFromTotalSeconds, formatTimeInput } from "@/utils/utility";
import { TimeInput } from "./TimeInput";
import { useContinuousPress } from "@/hooks/useContinuousPress";
import { ExerciseTimerModal } from "./ExerciseTimerModal";

const fallbackImage = require("@/assets/images/placeholder.webp");

interface SessionSetInfoProps {
  exercise_id: number;
  exerciseName: string;
  animatedUrl: string | undefined;
  animatedImageLoading: boolean;
  animatedImageError: Error | null;
  isLastSetOfLastExercise: boolean | null | undefined;
  isFirstSetOfFirstExercise: boolean | null | undefined;
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
  isDropSet: boolean;
  isToFailure: boolean;
  trackingType: string;
  distance: string;
  distanceUnit: string;
  distanceMin: number | undefined;
  handleWeightInputChange: (text: string) => void;
  handleWeightChange: (amount: number) => void;
  handleRepsInputChange: (text: string) => void;
  handleRepsChange: (amount: number) => void;
  handleTimeInputChange: (text: string) => void;
  handleDistanceInputChange: (text: string) => void;
  handleDistanceChange: (amount: number) => void;
  handlePreviousSet: () => void;
  handleNextSet: () => void;
  handleCompleteSet: () => void;
  removeSet: (currentSetIndex: number) => void;
  addSet: () => void;
  onToggleSetType: (type: "isWarmup" | "isDropSet" | "isToFailure") => void;
}

export default function SessionSetInfo({
  exercise_id,
  exerciseName,
  animatedUrl,
  animatedImageLoading,
  animatedImageError,
  isLastSetOfLastExercise,
  isFirstSetOfFirstExercise,
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
  isDropSet,
  isToFailure,
  trackingType,
  distance,
  distanceUnit,
  distanceMin,
  handleWeightInputChange,
  handleWeightChange,
  handleRepsInputChange,
  handleRepsChange,
  handleTimeInputChange,
  handleDistanceInputChange,
  handleDistanceChange,
  handlePreviousSet,
  handleNextSet,
  handleCompleteSet,
  removeSet,
  addSet,
  onToggleSetType,
}: SessionSetInfoProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);

  const weightMinusPress = useContinuousPress(
    useCallback(
      () => handleWeightChange(-weightIncrement),
      [handleWeightChange, weightIncrement],
    ),
  );
  const weightPlusPress = useContinuousPress(
    useCallback(
      () => handleWeightChange(weightIncrement),
      [handleWeightChange, weightIncrement],
    ),
  );
  const repsMinusPress = useContinuousPress(
    useCallback(() => handleRepsChange(-1), [handleRepsChange]),
  );
  const repsPlusPress = useContinuousPress(
    useCallback(() => handleRepsChange(1), [handleRepsChange]),
  );
  const distanceMinusPress = useContinuousPress(
    useCallback(() => handleDistanceChange(-1), [handleDistanceChange]),
  );
  const distancePlusPress = useContinuousPress(
    useCallback(() => handleDistanceChange(1), [handleDistanceChange]),
  );

  const displayValue = formatTimeInput(time);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const repRange =
    repsMin === repsMax
      ? repsMin
      : !repsMin
        ? repsMax
        : repsMax
          ? `${repsMin} - ${repsMax}`
          : repsMin;

  const handleImagePress = () => {
    router.push({
      pathname: "/(app)/exercise-info",
      params: { exercise_id: exercise_id.toString() },
    });
  };
  return (
    <View>
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          {animatedImageLoading ? (
            <ActivityIndicator size="small" color={Colors.dark.text} />
          ) : animatedImageError ? (
            <TouchableOpacity onPress={handleImagePress}>
              <Image style={styles.animatedImage} source={fallbackImage} />
            </TouchableOpacity>
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
            <ThemedText
              style={styles.title}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {exerciseName}
            </ThemedText>

            {trackingType !== "time" &&
              trackingType !== "distance" &&
              !!repRange && (
                <ThemedText style={styles.headerText}>
                  Reps: {repRange}
                </ThemedText>
              )}
            {trackingType === "time" && !!timeMin && (
              <ThemedText style={styles.headerText}>
                Time: {formatFromTotalSeconds(timeMin)}
              </ThemedText>
            )}
            {trackingType === "distance" && !!distanceMin && (
              <ThemedText style={styles.headerText}>
                Target: {distanceMin} {distanceUnit}
              </ThemedText>
            )}

            <ThemedText style={styles.headerText}>
              Rest Time: {restMinutes}:{String(restSeconds).padStart(2, "0")}
            </ThemedText>
          </View>
        </View>
        {/* Menu Button */}
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={openMenu}
              size={30}
              iconColor={Colors.dark.text}
              style={styles.menuButton}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              removeSet(currentSetIndex);
              closeMenu();
            }}
            title="Delete Set"
          />
          <Menu.Item
            onPress={() => {
              addSet();
              closeMenu();
            }}
            title="Add Set"
          />
          <Menu.Item
            onPress={() => {
              onToggleSetType("isWarmup");
              closeMenu();
            }}
            title="Warm-up"
            leadingIcon={isWarmup ? "check" : undefined}
          />
          <Menu.Item
            onPress={() => {
              onToggleSetType("isDropSet");
              closeMenu();
            }}
            title="Drop Set"
            leadingIcon={isDropSet ? "check" : undefined}
          />
          <Menu.Item
            onPress={() => {
              onToggleSetType("isToFailure");
              closeMenu();
            }}
            title="To Failure"
            leadingIcon={isToFailure ? "check" : undefined}
          />
        </Menu>
      </View>
      {/* Set Navigation */}
      <View style={styles.setNavigationContainer}>
        <IconButton
          icon="chevron-left"
          onPress={handlePreviousSet}
          size={buttonSize}
          disabled={isFirstSetOfFirstExercise}
          iconColor={Colors.dark.text}
        />
        <ThemedText style={styles.setNavigationText}>
          Set {currentSetIndex + 1} of {totalSets}
        </ThemedText>
        <IconButton
          icon="chevron-right"
          onPress={handleNextSet}
          size={buttonSize}
          disabled={isLastSetOfLastExercise}
          iconColor={Colors.dark.text}
        />
      </View>
      {/* Set Type Indicators */}
      {(isWarmup || isDropSet || isToFailure) && (
        <View style={styles.setTypeContainer}>
          {isWarmup && (
            <View style={[styles.setTypeBadge, styles.setTypeBadgeWarmup]}>
              <MaterialCommunityIcons
                name="speedometer-slow"
                size={16}
                color="#fff"
                style={styles.setIcon}
              />
              <ThemedText style={styles.setTypeLabel}>Warm-up</ThemedText>
            </View>
          )}
          {isDropSet && (
            <View style={[styles.setTypeBadge, styles.setTypeBadgeDrop]}>
              <MaterialCommunityIcons
                name="arrow-down-bold"
                size={16}
                color="#fff"
                style={styles.setIcon}
              />
              <ThemedText style={styles.setTypeLabel}>Drop Set</ThemedText>
            </View>
          )}
          {isToFailure && (
            <View style={[styles.setTypeBadge, styles.setTypeBadgeFailure]}>
              <MaterialCommunityIcons
                name="fire"
                size={16}
                color="#fff"
                style={styles.setIcon}
              />
              <ThemedText style={styles.setTypeLabel}>To Failure</ThemedText>
            </View>
          )}
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
              {...weightMinusPress}
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
              {...weightPlusPress}
              size={buttonSize}
              iconColor={Colors.dark.text}
              style={styles.iconButton}
            />
          </View>
        </>
      ) : null}
      {trackingType !== "time" && trackingType !== "distance" ? (
        <>
          <View style={styles.centeredLabelContainer}>
            <ThemedText style={styles.label}>Reps</ThemedText>
          </View>
          <View style={styles.inputContainer}>
            <IconButton
              icon="minus"
              {...repsMinusPress}
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
              {...repsPlusPress}
              size={buttonSize}
              iconColor={Colors.dark.text}
              style={styles.iconButton}
            />
          </View>
        </>
      ) : trackingType === "time" ? (
        <>
          <View style={styles.centeredLabelContainer}>
            <ThemedText style={styles.label}>Time (Min:Sec)</ThemedText>
          </View>
          <View style={styles.inputContainer}>
            <TimeInput
              key={`${exercise_id}-${currentSetIndex}`}
              value={displayValue}
              onChange={handleTimeInputChange}
              style={styles.input}
            />
          </View>
          <Button
            mode="contained"
            onPress={() => setTimerModalVisible(true)}
            icon="timer-play-outline"
            labelStyle={
              buttonSize === 40 ? styles.buttonLabel : styles.largeButtonLabel
            }
            style={[
              styles.startTimerButton,
              buttonSize === 40 ? null : styles.largeButton,
            ]}
          >
            Start Timer
          </Button>
          <ExerciseTimerModal
            visible={timerModalVisible}
            goalTimeSeconds={timeMin}
            onStop={(elapsedSeconds) => {
              handleTimeInputChange(formatFromTotalSeconds(elapsedSeconds));
              setTimerModalVisible(false);
            }}
            onCancel={() => setTimerModalVisible(false)}
          />
        </>
      ) : trackingType === "distance" ? (
        <>
          <View style={styles.centeredLabelContainer}>
            <ThemedText style={styles.label}>
              Distance ({distanceUnit})
            </ThemedText>
          </View>
          <View style={styles.inputContainer}>
            <IconButton
              icon="minus"
              {...distanceMinusPress}
              size={buttonSize}
              iconColor={Colors.dark.text}
              style={styles.iconButton}
            />
            <TextInput
              placeholderTextColor={Colors.dark.text}
              value={distance}
              onChangeText={(text: string) => handleDistanceInputChange(text)}
              keyboardType="numeric"
              selectTextOnFocus
              style={styles.input}
            />
            <IconButton
              icon="plus"
              {...distancePlusPress}
              size={buttonSize}
              iconColor={Colors.dark.text}
              style={styles.iconButton}
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
  menuButton: {
    marginLeft: "auto",
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
    marginBottom: 12,
  },
  setNavigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  setTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  setTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  setTypeBadgeWarmup: {
    backgroundColor: "#4A90D9",
  },
  setTypeBadgeDrop: {
    backgroundColor: "#9B59B6",
  },
  setTypeBadgeFailure: {
    backgroundColor: "#E74C3C",
  },
  setTypeLabel: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  setIcon: {
    marginRight: 4,
  },
  setNavigationText: {
    fontSize: 18,
    marginHorizontal: 8,
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
  startTimerButton: {
    marginBottom: 12,
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
  buttonLabel: {
    fontSize: 18,
    lineHeight: 25,
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
