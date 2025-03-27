import React, { useState, useEffect } from "react";
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [timeInput, setTimeInput] = useState(time);

  // Update timeInput when time prop changes
  useEffect(() => {
    setTimeInput(time);
  }, [time]);

  const handleLocalTimeInputChange = (value: string) => {
    // Only allow numbers
    const sanitizedInput = value.replace(/[^0-9]/g, "");
    setTimeInput(sanitizedInput);
    handleTimeInputChange(sanitizedInput);
  };

  // Format display value - now always formatted
  const displayValue = formatTimeInput(timeInput);

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
      pathname: "/(app)/exercise-details",
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
            <ThemedText style={styles.title}>{exerciseName}</ThemedText>

            {trackingType !== "time" && !!repRange && (
              <ThemedText style={styles.headerText}>
                Reps: {repRange}
              </ThemedText>
            )}
            {trackingType === "time" && !!timeMin && (
              <ThemedText style={styles.headerText}>
                Time: {formatFromTotalSeconds(timeMin)}
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
        {(isWarmup || isDropSet) && (
          <View style={styles.setTypeContainer}>
            {isWarmup && (
              <>
                <MaterialCommunityIcons
                  name="speedometer-slow"
                  size={24}
                  color={Colors.dark.text}
                  style={styles.setIcon}
                />
                <ThemedText style={styles.setTypeLabel}>Warm-up</ThemedText>
              </>
            )}
            {isDropSet && (
              <>
                <MaterialCommunityIcons
                  name="arrow-down-bold"
                  size={24}
                  color={Colors.dark.text}
                  style={styles.setIcon}
                />
                <ThemedText style={styles.setTypeLabel}>Drop</ThemedText>
              </>
            )}
          </View>
        )}
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
            <ThemedText style={styles.label}>Time (Min:Sec)</ThemedText>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              placeholderTextColor={Colors.dark.text}
              value={displayValue}
              onChangeText={handleLocalTimeInputChange}
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
    marginBottom: 16,
  },
  setTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  setTypeLabel: {
    fontSize: 18,
  },
  setIcon: {
    marginRight: 8,
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
