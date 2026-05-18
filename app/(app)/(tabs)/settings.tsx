import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Linking,
} from "react-native";
import {
  ActivityIndicator,
  Divider,
  Switch,
  ProgressBar,
  Button,
} from "react-native-paper";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { SettingsModal } from "@/components/SettingsModal";
// import { clearDatabaseAndReinitialize } from "@/utils/clearUserData";
import { useImageManagement } from "@/hooks/useImageManagement";
import { useQueryClient } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import { AuthContext } from "@/context/AuthProvider";
import { signInWithGoogle } from "@/utils/auth";
import Bugsnag from "@bugsnag/expo";
import {
  fetchLastBackupDate,
  restoreDatabaseBackup,
  uploadDatabaseBackup,
} from "@/utils/backup";
import * as Notifications from "expo-notifications";
import {
  rescheduleWorkoutReminders,
  requestNotificationPermission,
} from "@/utils/workoutReminder";
// import { clearActivePlanStatus } from "@/utils/clearUserData";

const REMINDER_DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const REMINDER_DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

export default function SettingsScreen() {
  const user = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { data: settings, isLoading, isError, error } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();

  const {
    isToggled: isDownloadToggled,
    isDownloading,
    isDeleting,
    progress,
    toggleDownloadImages,
  } = useImageManagement(updateSetting, settings?.downloadImages);

  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(1);
  const [restoreProgress, setRestoreProgress] = useState(1);

  const [lastBackupDate, setLastBackupDate] = useState<Date | null>(null);
  const [isLoadingBackupDate, setIsLoadingBackupDate] = useState(false);

  useEffect(() => {
    const getBackupDate = async () => {
      if (user) {
        setIsLoadingBackupDate(true);
        const date = await fetchLastBackupDate();
        setLastBackupDate(date);
        setIsLoadingBackupDate(false);
      }
    };

    getBackupDate();
  }, [isBackupLoading, user]);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentSettingKey, setCurrentSettingKey] = useState<string | null>(
    null,
  );
  const [inputValue, setInputValue] = useState<
    | string
    | number
    | { minutes: number; seconds: number }
    | { hours: number; minutes: number }
  >("");
  const [settingType, setSettingType] = useState<
    | "number"
    | "radio"
    | "dropdown"
    | "restTime"
    | "reminderTime"
    | "slider"
    | null
  >(null);
  const [options, setOptions] = useState<string[] | undefined>(undefined);

  const [toggleValues, setToggleValues] = useState({
    keepScreenOn: settings?.keepScreenOn,
    restTimerVibration: settings?.restTimerVibration,
    restTimerSound: settings?.restTimerSound,
    restTimerNotification: settings?.restTimerNotification,
    showOnboarding: settings?.showOnboarding,
    excludeWarmupSets: settings?.excludeWarmupSets,
    countUnilateralDouble: settings?.countUnilateralDouble,
    doubleWeightForPaired: settings?.doubleWeightForPaired,
  });

  const [workoutReminderEnabled, setWorkoutReminderEnabled] = useState(false);
  const [workoutReminderDays, setWorkoutReminderDays] = useState<number[]>([]);

  const defaultRestTime = settings
    ? `${Math.floor(parseInt(settings?.defaultRestTime) / 60)}:${(
        parseInt(settings?.defaultRestTime) % 60
      )
        .toString()
        .padStart(2, "0")} minutes`
    : "";

  // When weightUnit or distanceUnit changes, refetch completed workouts
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
  }, [settings?.weightUnit, settings?.distanceUnit, queryClient]);

  // Sync local states with fetched settings data on load
  useEffect(() => {
    if (settings) {
      setToggleValues({
        keepScreenOn: settings?.keepScreenOn,
        restTimerVibration: settings?.restTimerVibration,
        restTimerSound: settings?.restTimerSound,
        restTimerNotification: settings?.restTimerNotification,
        showOnboarding: settings?.showOnboarding,
        excludeWarmupSets: settings?.excludeWarmupSets,
        countUnilateralDouble: settings?.countUnilateralDouble,
        doubleWeightForPaired: settings?.doubleWeightForPaired,
      });
      setWorkoutReminderEnabled(settings.workoutReminderEnabled === "true");
      try {
        const parsed = JSON.parse(settings.workoutReminderDays || "[]");
        setWorkoutReminderDays(Array.isArray(parsed) ? parsed : []);
      } catch {
        setWorkoutReminderDays([]);
      }
    }
  }, [settings]);

  const showOverlay = (
    key: string,
    value: string | number,
    type:
      | "number"
      | "radio"
      | "dropdown"
      | "restTime"
      | "reminderTime"
      | "slider",
    options?: string[],
  ) => {
    if (key === "defaultRestTime") {
      const totalSeconds = parseInt(value as string, 10);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setInputValue({ minutes, seconds });
      setSettingType("restTime");
    } else if (key === "workoutReminderTime") {
      const [h, m] = (value as string).split(":").map(Number);
      setInputValue({ hours: h || 0, minutes: m || 0 });
      setSettingType("reminderTime");
    } else {
      setInputValue(value);
      setSettingType(type);
    }

    setCurrentSettingKey(key);
    setOptions(options);
    setOverlayVisible(true);
  };

  const saveSetting = async () => {
    try {
      if (currentSettingKey === "defaultRestTime") {
        const { minutes, seconds } = inputValue as {
          minutes: number;
          seconds: number;
        };
        const totalSeconds = minutes * 60 + seconds;

        updateSetting({
          key: currentSettingKey as string,
          value: totalSeconds.toString(),
        });
      } else if (currentSettingKey === "workoutReminderTime") {
        const { hours, minutes } = inputValue as {
          hours: number;
          minutes: number;
        };
        const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        updateSetting({ key: "workoutReminderTime", value: timeStr });
        rescheduleWorkoutReminders(
          workoutReminderEnabled ? "true" : "false",
          JSON.stringify(workoutReminderDays),
          timeStr,
        ).catch((err: any) => {
          Bugsnag.notify(err);
          console.error("Failed to reschedule workout reminders:", err);
        });
      } else if (currentSettingKey === "bodyWeight") {
        // Convert to kg if the unit is lbs
        const db = await openDatabase("userData.db");
        let bodyWeightInKg = inputValue as number;

        if (settings?.weightUnit === "lbs") {
          bodyWeightInKg = Number(
            ((inputValue as number) / 2.2046226).toFixed(1),
          ); // Convert lbs to kg
        }

        // Save body weight to body_measurements table
        await db.runAsync(
          `INSERT INTO body_measurements (date, body_weight) VALUES (datetime('now'), ?)`,
          [bodyWeightInKg],
        );

        // Save the body weight setting
        updateSetting({
          key: currentSettingKey as string,
          value: bodyWeightInKg.toString(), // Save in kg
        });
      } else {
        updateSetting({
          key: currentSettingKey as string,
          value: inputValue.toString(),
        });
      }
    } catch (error: any) {
      Bugsnag.notify(error);
      console.error("Error saving setting:", error);
    } finally {
      setOverlayVisible(false);
    }
  };

  const cancelOverlay = () => {
    setOverlayVisible(false);
  };

  const toggleOnboarding = (value: boolean) => {
    setToggleValues({ ...toggleValues, showOnboarding: value.toString() });
    updateSetting({ key: "showOnboarding", value: value.toString() });
  };

  const toggleKeepScreenOn = (value: boolean) => {
    setToggleValues({ ...toggleValues, keepScreenOn: value.toString() });
    updateSetting({ key: "keepScreenOn", value: value.toString() });
  };

  const toggleExcludeWarmupSets = (value: boolean) => {
    setToggleValues({ ...toggleValues, excludeWarmupSets: value.toString() });
    updateSetting({ key: "excludeWarmupSets", value: value.toString() });
  };

  const toggleCountUnilateralDouble = (value: boolean) => {
    setToggleValues({
      ...toggleValues,
      countUnilateralDouble: value.toString(),
    });
    updateSetting({ key: "countUnilateralDouble", value: value.toString() });
  };

  const toggleDoubleWeightForPaired = (value: boolean) => {
    setToggleValues({
      ...toggleValues,
      doubleWeightForPaired: value.toString(),
    });
    updateSetting({ key: "doubleWeightForPaired", value: value.toString() });
  };

  const toggleVibration = (value: boolean) => {
    setToggleValues({ ...toggleValues, restTimerVibration: value.toString() });
    updateSetting({ key: "restTimerVibration", value: value.toString() });
  };

  const toggleSound = (value: boolean) => {
    setToggleValues({ ...toggleValues, restTimerSound: value.toString() });
    updateSetting({ key: "restTimerSound", value: value.toString() });
  };

  const toggleNotification = async (value: boolean) => {
    setToggleValues({
      ...toggleValues,
      restTimerNotification: value.toString(),
    });

    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "To enable rest timer notifications, grant notification permissions in your device settings.",
        );
        updateSetting({
          key: "restTimerNotification",
          value: false.toString(),
        });
        return;
      }
    }

    updateSetting({ key: "restTimerNotification", value: value.toString() });
  };

  const toggleWorkoutReminder = async (value: boolean) => {
    if (value) {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        Alert.alert(
          "Permission Required",
          "To enable workout reminders, grant notification permissions in your device settings.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" },
          ],
        );
        return;
      }
    }
    setWorkoutReminderEnabled(value);
    updateSetting({ key: "workoutReminderEnabled", value: value.toString() });
    rescheduleWorkoutReminders(
      value.toString(),
      JSON.stringify(workoutReminderDays),
      settings?.workoutReminderTime ?? "08:00",
    ).catch((err: any) => {
      Bugsnag.notify(err);
      console.error("Failed to reschedule workout reminders:", err);
    });
  };

  const toggleReminderDay = async (day: number) => {
    const newDays = workoutReminderDays.includes(day)
      ? workoutReminderDays.filter((d) => d !== day)
      : [...workoutReminderDays, day].sort((a, b) => a - b);
    setWorkoutReminderDays(newDays);
    updateSetting({
      key: "workoutReminderDays",
      value: JSON.stringify(newDays),
    });
    if (workoutReminderEnabled) {
      rescheduleWorkoutReminders(
        "true",
        JSON.stringify(newDays),
        settings?.workoutReminderTime ?? "08:00",
      ).catch((err: any) => {
        Bugsnag.notify(err);
        console.error("Failed to reschedule workout reminders:", err);
      });
    }
  };

  // const handleClearDatabase = async () => {
  //   try {
  //     await clearDatabaseAndReinitialize();
  //   } catch (error) {
  //     console.error("Error clearing database:", error);
  //     Alert.alert("Error", "Failed to clear database. Please try again.");
  //   }
  // };

  // const confirmClearDatabase = () => {
  //   Alert.alert(
  //     "Clear App Data",
  //     "Are you sure you want to clear all app data? This action cannot be undone. The app will reload after clearing.",
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       { text: "Clear", onPress: handleClearDatabase },
  //     ],
  //   );
  // };

  // const resetLoginShownSetting = async () => {
  //   try {
  //     const db = await openDatabase("userData.db");
  //     await db.runAsync("DELETE FROM settings WHERE key = ?", ["loginShown"]);
  //     console.log("loginShown setting has been reset.");
  //   } catch (error: any) {
  //     Bugsnag.notify(error);
  //     console.error("Error resetting loginShown setting:", error);
  //   }
  // };

  const confirmRestoreBackup = async () => {
    Alert.alert(
      "Restore Backup",
      "Are you sure you want to restore the backup?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: () =>
            restoreDatabaseBackup(
              setRestoreProgress,
              setIsRestoreLoading,
              queryClient,
            ),
        },
      ],
    );
  };

  useEffect(() => {
    if (isError) {
      console.error("Error fetching settings:", error);
      Bugsnag.notify(error);
    }
  }, [isError, error]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (isError) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  return (
    <ThemedView>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Modal for Overlay */}
        <SettingsModal
          visible={overlayVisible}
          settingKey={currentSettingKey}
          inputValue={inputValue}
          onCancel={cancelOverlay}
          onSave={saveSetting}
          onChangeValue={setInputValue}
          settingType={settingType}
          options={options}
        />
        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Personal</ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="account"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            {!user ? (
              <>
                <View style={styles.textContainer}>
                  <ThemedText style={styles.itemText}>
                    Sign in with Google
                  </ThemedText>
                  <ThemedText style={styles.currentSetting}>
                    Log in to secure your data
                  </ThemedText>
                </View>
                <Button mode="outlined" compact onPress={signInWithGoogle}>
                  Sign in
                </Button>
              </>
            ) : (
              <View style={styles.textContainer}>
                <ThemedText style={styles.itemText}>
                  Signed in as {user.displayName || user.email}
                </ThemedText>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("weeklyGoal", settings?.weeklyGoal || "1", "slider")
            }
          >
            <MaterialCommunityIcons
              name="target"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Weekly goal</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.weeklyGoal} days per week
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("bodyWeight", settings?.bodyWeight || "", "number")
            }
          >
            <MaterialCommunityIcons
              name="scale-bathroom"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Body weight</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.bodyWeight} {settings?.weightUnit} (used for assisted
                exercises)
              </ThemedText>
            </View>
          </TouchableOpacity>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="cloud-upload"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Backup and restore
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {!user
                  ? "You need to sign in to use this feature"
                  : isLoadingBackupDate
                    ? "Checking for backups..."
                    : lastBackupDate
                      ? `Last backup: ${lastBackupDate.toLocaleDateString()}`
                      : "No backups found"}
              </ThemedText>
            </View>
            {user && (
              <>
                <Button
                  style={styles.backupButton}
                  mode="outlined"
                  compact
                  onPress={() =>
                    uploadDatabaseBackup(setBackupProgress, setIsBackupLoading)
                  }
                >
                  Backup
                </Button>
                <Button mode="outlined" compact onPress={confirmRestoreBackup}>
                  Restore
                </Button>
              </>
            )}
          </View>
          {(isBackupLoading || isRestoreLoading) && (
            <View style={styles.progressContainer}>
              <ThemedText style={styles.progressText}>
                {isBackupLoading
                  ? "Uploading. Please wait..."
                  : "Restoring. Please wait..."}
              </ThemedText>
              <ProgressBar
                animatedValue={
                  isBackupLoading ? backupProgress / 100 : restoreProgress / 100
                }
                color={Colors.dark.tint}
              />
            </View>
          )}
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>
            Units of measurement
          </ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("weightUnit", settings?.weightUnit || "", "radio", [
                "kg",
                "lbs",
              ])
            }
          >
            <MaterialCommunityIcons
              name="weight"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Weight unit</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.weightUnit}
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay(
                "distanceUnit",
                settings?.distanceUnit || "m",
                "radio",
                ["m", "ft"],
              )
            }
          >
            <MaterialCommunityIcons
              name="map-marker-distance"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Distance unit</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.distanceUnit || "m"}
              </ThemedText>
            </View>
          </TouchableOpacity>
          {/* <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("sizeUnit", settings?.sizeUnit || "", "radio", [
                "Centimeters",
                "Inches",
              ])
            }
          >
            <MaterialCommunityIcons
              name="tape-measure"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Size unit</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.sizeUnit}
              </ThemedText>
            </View>
          </TouchableOpacity> */}
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Workout</ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay(
                "weightIncrement",
                settings?.weightIncrement || "",
                "number",
              )
            }
          >
            <MaterialCommunityIcons
              name="plus"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Weight increment</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.weightIncrement} {settings?.weightUnit}
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay(
                "restTimerIncrement",
                settings?.restTimerIncrement || "",
                "number",
              )
            }
          >
            <MaterialCommunityIcons
              name="timer"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Rest timer increment
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.restTimerIncrement} seconds
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay(
                "timerCountdown",
                settings?.timerCountdown || "5",
                "number",
              )
            }
          >
            <MaterialCommunityIcons
              name="timer-play-outline"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Exercise timer countdown
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.timerCountdown || "5"} seconds
              </ThemedText>
            </View>
          </TouchableOpacity>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="vibrate"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Vibrate after rest
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.restTimerVibration === "true"
                  ? "Enabled"
                  : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.restTimerVibration === "true"}
              onValueChange={toggleVibration}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="volume-high"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Play sound after rest
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.restTimerSound === "true" ? "Enabled" : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={settings?.restTimerSound === "true"}
              onValueChange={toggleSound}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialIcons
              name="notifications-active"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Send notification in background after rest
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.restTimerNotification === "true"
                  ? "Enabled"
                  : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={settings?.restTimerNotification === "true"}
              onValueChange={toggleNotification}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="cellphone"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Keep screen on during workout
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.keepScreenOn === "true" ? "Enabled" : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.keepScreenOn === "true"}
              onValueChange={toggleKeepScreenOn}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Stats</ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="fire-off"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Exclude warmup sets from stats
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.excludeWarmupSets === "true"
                  ? "Enabled"
                  : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.excludeWarmupSets === "true"}
              onValueChange={toggleExcludeWarmupSets}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="arm-flex"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                I log one side only for single-arm/leg exercises
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.countUnilateralDouble === "true"
                  ? "Counting reps ×2 for these exercises"
                  : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.countUnilateralDouble === "true"}
              onValueChange={toggleCountUnilateralDouble}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                I enter weight per dumbbell/cable, not total
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.doubleWeightForPaired === "true"
                  ? "Doubling weight for volume calculations"
                  : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.doubleWeightForPaired === "true"}
              onValueChange={toggleDoubleWeightForPaired}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Reminders</ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="bell"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Workout reminders</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {workoutReminderEnabled ? "Enabled" : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={workoutReminderEnabled}
              onValueChange={toggleWorkoutReminder}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          {workoutReminderEnabled && (
            <>
              <View style={[styles.item, { alignItems: "flex-start" }]}>
                <MaterialCommunityIcons
                  name="calendar-week"
                  size={24}
                  color={Colors.dark.icon}
                  style={[styles.icon, { marginTop: 2 }]}
                />
                <View style={styles.textContainer}>
                  <ThemedText style={styles.itemText}>Reminder days</ThemedText>
                  <View style={styles.dayChipsRow}>
                    {REMINDER_DAY_LABELS.map((label, index) => {
                      const dayValue = REMINDER_DAY_VALUES[index];
                      const selected = workoutReminderDays.includes(
                        dayValue as number,
                      );
                      return (
                        <TouchableOpacity
                          key={index}
                          onPress={() => toggleReminderDay(dayValue as number)}
                          style={[
                            styles.dayChip,
                            selected && styles.dayChipSelected,
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.dayChipText,
                              selected && styles.dayChipTextSelected,
                            ]}
                          >
                            {label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {workoutReminderDays.length === 0 && (
                    <ThemedText style={styles.reminderHint}>
                      Select at least one day
                    </ThemedText>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.item}
                onPress={() =>
                  showOverlay(
                    "workoutReminderTime",
                    settings?.workoutReminderTime ?? "08:00",
                    "reminderTime",
                  )
                }
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={24}
                  color={Colors.dark.icon}
                  style={styles.icon}
                />
                <View style={styles.textContainer}>
                  <ThemedText style={styles.itemText}>Reminder time</ThemedText>
                  <ThemedText style={styles.currentSetting}>
                    {settings?.workoutReminderTime ?? "08:00"}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Exercise</ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("defaultSets", settings?.defaultSets || "", "number")
            }
          >
            <MaterialCommunityIcons
              name="numeric"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Default sets</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.defaultSets} sets
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay(
                "defaultRestTime",
                settings?.defaultRestTime || "",
                "number",
              )
            }
          >
            <MaterialCommunityIcons
              name="clock"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Default rest time</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {defaultRestTime}
              </ThemedText>
            </View>
          </TouchableOpacity>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="cloud-download"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Download all exercise animations
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                Size: ~100MB
              </ThemedText>
            </View>
            <Switch
              value={isDownloadToggled === "true"}
              onValueChange={toggleDownloadImages}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          {(isDownloading || isDeleting) && (
            <View style={styles.progressContainer}>
              <ThemedText style={styles.progressText}>
                {isDownloading
                  ? "Downloading. Please wait..."
                  : "Deleting. Please wait..."}
              </ThemedText>
              <ProgressBar
                animatedValue={progress}
                color={isDownloading ? Colors.dark.tint : Colors.dark.highlight}
              />
            </View>
          )}
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Appearance</ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="view-dashboard"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Show onboarding on home screen
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.showOnboarding === "true" ? "Enabled" : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={settings?.showOnboarding === "true"}
              onValueChange={toggleOnboarding}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("buttonSize", settings?.buttonSize || "", "radio", [
                "Standard",
                "Large",
                "XLarge",
              ])
            }
          >
            <MaterialCommunityIcons
              name="resize"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Button size during workout
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.buttonSize}
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} />

        {/* <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Manage Data</ThemedText>
          <TouchableOpacity
            style={styles.item}
            // onPress={confirmClearDatabase}
          >
            <MaterialCommunityIcons
              name="delete"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Clear all user data
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            // onPress={resetLoginShownSetting}
          >
            <MaterialCommunityIcons
              name="delete"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Reset "loginShown" setting
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => Bugsnag.notify(new Error("Settings test error"))}
          >
            <MaterialCommunityIcons
              name="bug"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Send test error</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} onPress={clearActivePlanStatus}>
            <MaterialCommunityIcons
              name="bug"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Clear Active Plan Status
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} /> */}

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>About</ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              Linking.openURL("https://www.featurize.io/p/musclequest")
            }
          >
            <MaterialCommunityIcons
              name="vote"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Request or vote for new features
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              Linking.openURL("https://buymeacoffee.com/musclequest")
            }
          >
            <MaterialCommunityIcons
              name="coffee"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Buy me a coffee</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => Linking.openURL("https://musclequest.app")}
          >
            <MaterialCommunityIcons
              name="web"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>MuscleQuest.app</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              Linking.openURL("https://www.instagram.com/musclequest.app/")
            }
          >
            <MaterialCommunityIcons
              name="instagram"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Follow MuscleQuest on Instagram
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => Linking.openURL("https://joseph.bouqdib.com")}
          >
            <MaterialCommunityIcons
              name="account"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                About the developer
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              Linking.openURL("https://musclequest.app/privacy-policy")
            }
          >
            <MaterialCommunityIcons
              name="shield-lock"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Privacy policy</ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  section: {
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: Colors.dark.text,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
    marginLeft: 8,
  },
  itemText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  currentSetting: {
    fontSize: 14,
    color: Colors.dark.subText,
  },
  icon: {
    marginRight: 8,
  },
  divider: {
    marginVertical: 8,
  },
  switch: {
    marginLeft: "auto",
  },
  progressBar: {
    marginVertical: 16,
  },
  progressBarText: {},
  backupButton: {
    marginRight: 4,
  },
  dayChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.subText,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipSelected: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  dayChipText: {
    fontSize: 12,
    color: Colors.dark.subText,
  },
  dayChipTextSelected: {
    color: Colors.dark.background,
    fontWeight: "bold",
  },
  reminderHint: {
    fontSize: 12,
    color: Colors.dark.highlight,
    marginTop: 6,
  },
});
