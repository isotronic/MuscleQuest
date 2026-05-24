import React, { useContext, useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
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

const REMINDER_DAY_LABELS = [
  msg`Mo`,
  msg`Tu`,
  msg`We`,
  msg`Th`,
  msg`Fr`,
  msg`Sa`,
  msg`Su`,
];
const REMINDER_DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

export default function SettingsScreen() {
  const { _ } = useLingui();
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
    timerCountdownSound: settings?.timerCountdownSound,
    timerGoalSound: settings?.timerGoalSound,
    alwaysUseGlobalHistory: settings?.alwaysUseGlobalHistory,
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
        timerCountdownSound: settings?.timerCountdownSound,
        timerGoalSound: settings?.timerGoalSound,
        alwaysUseGlobalHistory: settings?.alwaysUseGlobalHistory,
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

  const toggleAlwaysUseGlobalHistory = (value: boolean) => {
    setToggleValues({
      ...toggleValues,
      alwaysUseGlobalHistory: value.toString(),
    });
    updateSetting({ key: "alwaysUseGlobalHistory", value: value.toString() });
  };

  const toggleVibration = (value: boolean) => {
    setToggleValues({ ...toggleValues, restTimerVibration: value.toString() });
    updateSetting({ key: "restTimerVibration", value: value.toString() });
  };

  const toggleSound = (value: boolean) => {
    setToggleValues({ ...toggleValues, restTimerSound: value.toString() });
    updateSetting({ key: "restTimerSound", value: value.toString() });
  };

  const toggleCountdownSound = (value: boolean) => {
    setToggleValues({ ...toggleValues, timerCountdownSound: value.toString() });
    updateSetting({ key: "timerCountdownSound", value: value.toString() });
  };

  const toggleGoalSound = (value: boolean) => {
    setToggleValues({ ...toggleValues, timerGoalSound: value.toString() });
    updateSetting({ key: "timerGoalSound", value: value.toString() });
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
          t`Permission Required`,
          t`To enable rest timer notifications, grant notification permissions in your device settings.`,
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
          t`Permission Required`,
          t`To enable workout reminders, grant notification permissions in your device settings.`,
          [
            { text: t`Open Settings`, onPress: () => Linking.openSettings() },
            { text: t`Cancel`, style: "cancel" },
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
      t`Restore Backup`,
      t`Are you sure you want to restore the backup?`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Restore`,
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
          <ThemedText style={styles.sectionHeader}>
            <Trans>Personal</Trans>
          </ThemedText>
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
                    <Trans>Sign in with Google</Trans>
                  </ThemedText>
                  <ThemedText style={styles.currentSetting}>
                    <Trans>Log in to secure your data</Trans>
                  </ThemedText>
                </View>
                <Button mode="outlined" compact onPress={signInWithGoogle}>
                  <Trans>Sign in</Trans>
                </Button>
              </>
            ) : (
              <View style={styles.textContainer}>
                <ThemedText style={styles.itemText}>
                  <Trans>Signed in as {user.displayName || user.email}</Trans>
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
              <ThemedText style={styles.itemText}>
                <Trans>Weekly goal</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>{settings?.weeklyGoal} days per week</Trans>
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
              <ThemedText style={styles.itemText}>
                <Trans>Body weight</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>
                  {settings?.bodyWeight} {settings?.weightUnit} (used for
                  assisted exercises)
                </Trans>
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
                <Trans>Backup and restore</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {!user
                  ? t`You need to sign in to use this feature`
                  : isLoadingBackupDate
                    ? t`Checking for backups...`
                    : lastBackupDate
                      ? t`Last backup: ${lastBackupDate.toLocaleDateString()}`
                      : t`No backups found`}
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
                  <Trans>Backup</Trans>
                </Button>
                <Button mode="outlined" compact onPress={confirmRestoreBackup}>
                  <Trans>Restore</Trans>
                </Button>
              </>
            )}
          </View>
          {(isBackupLoading || isRestoreLoading) && (
            <View style={styles.progressContainer}>
              <ThemedText style={styles.progressText}>
                {isBackupLoading
                  ? t`Uploading. Please wait...`
                  : t`Restoring. Please wait...`}
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
            <Trans>Units of measurement</Trans>
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
              <ThemedText style={styles.itemText}>
                <Trans>Weight unit</Trans>
              </ThemedText>
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
              <ThemedText style={styles.itemText}>
                <Trans>Distance unit</Trans>
              </ThemedText>
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
          <ThemedText style={styles.sectionHeader}>
            <Trans>Workout</Trans>
          </ThemedText>
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
              <ThemedText style={styles.itemText}>
                <Trans>Weight increment</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>
                  {settings?.weightIncrement} {settings?.weightUnit}
                </Trans>
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
                <Trans>Rest timer increment</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>{settings?.restTimerIncrement} seconds</Trans>
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
                <Trans>Exercise timer countdown</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>{settings?.timerCountdown || "5"} seconds</Trans>
              </ThemedText>
            </View>
          </TouchableOpacity>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="volume-high"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                <Trans>Play countdown beeps (Exercise Timer)</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.timerCountdownSound === "true"
                  ? t`Enabled`
                  : t`Disabled`}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.timerCountdownSound === "true"}
              onValueChange={toggleCountdownSound}
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
                <Trans>Play goal achieved sound (Exercise Timer)</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.timerGoalSound === "true"
                  ? t`Enabled`
                  : t`Disabled`}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.timerGoalSound === "true"}
              onValueChange={toggleGoalSound}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="vibrate"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                <Trans>Vibrate after rest</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.restTimerVibration === "true"
                  ? t`Enabled`
                  : t`Disabled`}
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
                <Trans>Play sound after rest</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.restTimerSound === "true" ? t`Enabled` : t`Disabled`}
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
                <Trans>Send notification in background after rest</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.restTimerNotification === "true"
                  ? t`Enabled`
                  : t`Disabled`}
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
                <Trans>Keep screen on during workout</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.keepScreenOn === "true"
                  ? t`Enabled`
                  : t`Disabled`}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.keepScreenOn === "true"}
              onValueChange={toggleKeepScreenOn}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="history"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                <Trans>Always use most recent exercise history</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.alwaysUseGlobalHistory === "true"
                  ? t`Using most recent from any workout`
                  : t`Using history from same workout`}
              </ThemedText>
            </View>
            <Switch
              value={toggleValues.alwaysUseGlobalHistory === "true"}
              onValueChange={toggleAlwaysUseGlobalHistory}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>
            <Trans>Stats</Trans>
          </ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="fire-off"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                <Trans>Exclude warmup sets from stats</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.excludeWarmupSets === "true"
                  ? t`Enabled`
                  : t`Disabled`}
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
                <Trans>I log one side only for single-arm/leg exercises</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.countUnilateralDouble === "true"
                  ? t`Counting reps ×2 for these exercises`
                  : t`Disabled`}
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
                <Trans>I enter weight per dumbbell/cable, not total</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {toggleValues.doubleWeightForPaired === "true"
                  ? t`Doubling weight for volume calculations`
                  : t`Disabled`}
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
          <ThemedText style={styles.sectionHeader}>
            <Trans>Reminders</Trans>
          </ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="bell"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                <Trans>Workout reminders</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {workoutReminderEnabled ? t`Enabled` : t`Disabled`}
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
                  <ThemedText style={styles.itemText}>
                    <Trans>Reminder days</Trans>
                  </ThemedText>
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
                            {_(label)}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {workoutReminderDays.length === 0 && (
                    <ThemedText style={styles.reminderHint}>
                      <Trans>Select at least one day</Trans>
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
                  <ThemedText style={styles.itemText}>
                    <Trans>Reminder time</Trans>
                  </ThemedText>
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
          <ThemedText style={styles.sectionHeader}>
            <Trans>Exercise</Trans>
          </ThemedText>
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
              <ThemedText style={styles.itemText}>
                <Trans>Default sets</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>{settings?.defaultSets} sets</Trans>
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
              <ThemedText style={styles.itemText}>
                <Trans>Default rest time</Trans>
              </ThemedText>
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
                <Trans>Download all exercise animations</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                <Trans>Size: ~100MB</Trans>
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
                  ? t`Downloading. Please wait...`
                  : t`Deleting. Please wait...`}
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
          <ThemedText style={styles.sectionHeader}>
            <Trans>Appearance</Trans>
          </ThemedText>
          <View style={styles.item}>
            <MaterialCommunityIcons
              name="view-dashboard"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                <Trans>Show onboarding on home screen</Trans>
              </ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.showOnboarding === "true" ? t`Enabled` : t`Disabled`}
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
                <Trans>Button size during workout</Trans>
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
          <ThemedText style={styles.sectionHeader}>
            <Trans>About</Trans>
          </ThemedText>
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
                <Trans>Request or vote for new features</Trans>
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
              <ThemedText style={styles.itemText}>
                <Trans>Buy me a coffee</Trans>
              </ThemedText>
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
              <ThemedText style={styles.itemText}>
                <Trans>MuscleQuest.app</Trans>
              </ThemedText>
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
                <Trans>Follow MuscleQuest on Instagram</Trans>
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
                <Trans>About the developer</Trans>
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
              <ThemedText style={styles.itemText}>
                <Trans>Privacy policy</Trans>
              </ThemedText>
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
