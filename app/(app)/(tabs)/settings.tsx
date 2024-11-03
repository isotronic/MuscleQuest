import { useContext, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import {
  ActivityIndicator,
  Divider,
  Switch,
  ProgressBar,
  Button,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { SettingsModal } from "@/components/SettingsModal";
import { clearDatabaseAndReinitialize } from "@/utils/clearUserData";
import { useImageManagement } from "@/hooks/useImageManagement";
import { useQueryClient } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import { AuthContext } from "@/context/AuthProvider";
import { signInWithGoogle } from "@/utils/auth";

export default function SettingsScreen() {
  const user = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { data: settings, isLoading, isError, error } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();

  const { isDownloading, isDeleting, progress, toggleDownloadImages } =
    useImageManagement(updateSetting);

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
    // restTimerSound: settings?.restTimerSound,
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
        // restTimerSound: settings?.restTimerSound,
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
      try {
        const db = await openDatabase("userData.db");
        await db.runAsync(
          `INSERT INTO body_measurements (date, body_weight) VALUES (datetime('now'), ?)`,
          [inputValue as number],
        );
      } catch (error) {
        console.error(
          "Error saving body weight into body_measurements:",
          error,
        );
      }
      updateSetting({
        key: currentSettingKey as string,
        value: inputValue as string,
      });
    } else {
      updateSetting({
        key: currentSettingKey as string,
        value: inputValue.toString(),
      });
    }

    setOverlayVisible(false);
  };

  const cancelOverlay = () => {
    setOverlayVisible(false);
  };

  const toggleKeepScreenOn = (value: boolean) => {
    setToggleValues({ ...toggleValues, keepScreenOn: value.toString() });
    updateSetting({ key: "keepScreenOn", value: value.toString() });
  };

  const toggleVibration = (value: boolean) => {
    setToggleValues({ ...toggleValues, restTimerVibration: value.toString() });
    updateSetting({ key: "restTimerVibration", value: value.toString() });
  };

  // const toggleSound = (value: boolean) => {
  //   updateSetting({ key: "restTimerSound", value: value.toString() });
  // };

  const handleClearDatabase = async () => {
    try {
      await clearDatabaseAndReinitialize();
    } catch (error) {
      console.error("Error clearing database:", error);
      Alert.alert("Error", "Failed to clear database. Please try again.");
    }
  };

  const confirmClearDatabase = () => {
    Alert.alert(
      "Clear App Data",
      "Are you sure you want to clear all app data? This action cannot be undone. The app will reload after clearing.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", onPress: handleClearDatabase },
      ],
    );
  };

  const resetLoginShownSetting = async () => {
    try {
      const db = await openDatabase("userData.db");
      await db.runAsync("DELETE FROM settings WHERE key = ?", ["loginShown"]);
      console.log("loginShown setting has been reset.");
    } catch (error) {
      console.error("Error resetting loginShown setting:", error);
    }
  };

  useEffect(() => {
    if (isError) {
      console.error("Error fetching settings:", error);
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
    return <ThemedText>Error: {String(error)}</ThemedText>;
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
                <Button mode="outlined" onPress={signInWithGoogle}>
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
          {/* <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Backup and restore pressed")}
          >
            <MaterialCommunityIcons
              name="backup-restore"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Backup and restore
              </ThemedText>
            </View>
          </TouchableOpacity> */}
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
          {/* <View style={styles.item}>
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
          </View> */}
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
                Download all exercise images
              </ThemedText>
            </View>
            <Switch
              value={settings?.downloadImages === "true"}
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

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Manage Data</ThemedText>
          <TouchableOpacity style={styles.item} onPress={confirmClearDatabase}>
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
            onPress={resetLoginShownSetting}
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
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>About</ThemedText>
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
          {/* <TouchableOpacity
            style={styles.item}
            onPress={() =>
              console.log("Follow MuscleQuest on Instagram pressed")
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
          </TouchableOpacity> */}
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
});
