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
// import { clearActivePlanStatus } from "@/utils/clearUserData";

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

  useEffect(() => {
    const getBackupDate = async () => {
      if (user) {
        const date = await fetchLastBackupDate();
        setLastBackupDate(date);
      }
    };

    getBackupDate();
  }, [isBackupLoading, user]);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentSettingKey, setCurrentSettingKey] = useState<string | null>(
    null,
  );
  const [inputValue, setInputValue] = useState<
    string | number | { minutes: number; seconds: number }
  >("");
  const [settingType, setSettingType] = useState<
    "number" | "radio" | "dropdown" | "restTime" | null
  >(null);
  const [options, setOptions] = useState<string[] | undefined>(undefined);

  const [toggleValues, setToggleValues] = useState({
    keepScreenOn: settings?.keepScreenOn,
    restTimerVibration: settings?.restTimerVibration,
    restTimerSound: settings?.restTimerSound,
    restTimerNotification: settings?.restTimerNotification,
    showOnboarding: settings?.showOnboarding,
  });

  const defaultRestTime = settings
    ? `${Math.floor(parseInt(settings?.defaultRestTime) / 60)}:${(
        parseInt(settings?.defaultRestTime) % 60
      )
        .toString()
        .padStart(2, "0")} minutes`
    : "";

  // When weightUnit changes, refetch completed workouts
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
  }, [settings?.weightUnit, queryClient]);

  // Sync local states with fetched settings data on load
  useEffect(() => {
    if (settings) {
      setToggleValues({
        keepScreenOn: settings?.keepScreenOn,
        restTimerVibration: settings?.restTimerVibration,
        restTimerSound: settings?.restTimerSound,
        restTimerNotification: settings?.restTimerNotification,
        showOnboarding: settings?.showOnboarding,
      });
    }
  }, [settings]);

  const showOverlay = (
    key: string,
    value: string | number,
    type: "number" | "radio" | "dropdown" | "restTime",
    options?: string[],
  ) => {
    if (key === "defaultRestTime") {
      const totalSeconds = parseInt(value as string, 10);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setInputValue({ minutes, seconds });
      setSettingType("restTime");
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
              showOverlay(
                "weeklyGoal",
                settings?.weeklyGoal || "",
                "dropdown",
                ["1", "2", "3", "4", "5", "6", "7"],
              )
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
          {/* <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay(
                "distanceUnit",
                settings?.distanceUnit || "",
                "radio",
                ["Kilometers", "Miles"],
              )
            }
          >
            <MaterialCommunityIcons
              name="run"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Distance unit</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.distanceUnit}
              </ThemedText>
            </View>
          </TouchableOpacity> */}
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
});
