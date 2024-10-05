import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import {
  ActivityIndicator,
  Divider,
  Switch,
  ProgressBar,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { SettingsModal } from "@/components/SettingsModal";
import { Alert } from "react-native";
import { clearDatabaseAndReinitialize } from "@/utils/clearUserData";
import { downloadAllAnimatedImages } from "@/utils/downloadAllAnimatedImages";
import { deleteAllAnimatedImages } from "@/utils/deleteAllAnimatedImaged";

export default function SettingsScreen() {
  const { data: settings, isLoading, isError, error } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const defaultRestTime = settings
    ? `${Math.floor(parseInt(settings?.defaultRestTime) / 60)}:${(
        parseInt(settings?.defaultRestTime) % 60
      )
        .toString()
        .padStart(2, "0")} minutes`
    : "";

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

  const saveSetting = () => {
    if (currentSettingKey === "defaultRestTime") {
      // Convert minutes and seconds back to total seconds
      const { minutes, seconds } = inputValue as {
        minutes: number;
        seconds: number;
      };
      const totalSeconds = minutes * 60 + seconds;

      // Save the total seconds
      updateSetting({
        key: currentSettingKey as string,
        value: totalSeconds.toString(),
      });
    } else {
      // Save other settings as before
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
    updateSetting({ key: "keepScreenOn", value: value.toString() });
  };

  const toggleDownloadImages = (value: boolean) => {
    if (value === true) {
      Alert.alert(
        "Download Images",
        "Are you sure you want to download all animated images? This may take a while.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Download",
            onPress: () => handleDownloadAllImages(),
          },
        ],
      );
    } else {
      Alert.alert(
        "Download Images",
        "Are you sure you want to delete all animated images? Single images will be automatically re-downloaded when viewed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            onPress: () => handleDeleteAllImages(),
          },
        ],
      );
    }
  };

  const handleDownloadAllImages = async () => {
    setProgress(0);
    setIsDownloading(true);
    updateSetting({ key: "downloadImages", value: "true" });

    try {
      const { success, failedDownloads } = await downloadAllAnimatedImages(
        (currentProgress) => {
          setProgress(currentProgress);
        },
      );

      if (success) {
        Alert.alert("Success", "All images downloaded successfully!");
      } else {
        Alert.alert(
          "Download Complete",
          `Some images failed to download after retries. Failed exercise IDs: ${failedDownloads.join(", ")}`,
        );
        console.error(
          "Some images failed to download after retries:",
          failedDownloads,
        );
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred while downloading images.");
      console.error("Error downloading images:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteAllImages = async () => {
    setProgress(0);
    setIsDeleting(true);
    updateSetting({ key: "downloadImages", value: "false" });
    // Confirm with the user before deleting
    try {
      const { success, failedDeletes } = await deleteAllAnimatedImages(
        (currentProgress) => {
          setProgress(currentProgress);
        },
      );

      if (success) {
        Alert.alert("Success", "All images deleted successfully!");
      } else {
        Alert.alert(
          "Delete Complete",
          `Some images failed to delete. Failed exercise IDs: ${failedDeletes.join(", ")}`,
        );
        console.error("Some images failed to delete:", failedDeletes);
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred while deleting images.");
      console.error("Error deleting images:", error);
    } finally {
      setIsDeleting(false);
    }
  };

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
          <ThemedText style={styles.sectionHeader}>
            Units of measurement
          </ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              showOverlay("weightUnit", settings?.weightUnit || "", "radio", [
                "Kilograms",
                "Pounds",
              ])
            }
          >
            <MaterialCommunityIcons
              name="scale"
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
              name="cellphone"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Keep screen on</ThemedText>
              <ThemedText style={styles.currentSetting}>
                {settings?.keepScreenOn === "true" ? "Enabled" : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={settings?.keepScreenOn === "true"}
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
              <ThemedText style={styles.itemText}>Button size</ThemedText>
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
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>About</ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("MuscleQuest.app pressed")}
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
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Follow MuscleQuest on Twitter pressed")}
          >
            <MaterialCommunityIcons
              name="twitter"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Follow MuscleQuest on Twitter
              </ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("About the developer pressed")}
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
            onPress={() => console.log("Privacy policy pressed")}
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
