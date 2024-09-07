import { useState, useCallback } from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { Divider, Switch } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

export default function SettingsScreen() {
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const [downloadImages, setDownloadImages] = useState(false);

  const toggleKeepScreenOn = useCallback(() => {
    setKeepScreenOn((prev) => !prev);
  }, []);

  const toggleDownloadImages = useCallback(() => {
    setDownloadImages((prev) => !prev);
  }, []);

  return (
    <ThemedView>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Personal</ThemedText>
          <TouchableOpacity
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
              value={downloadImages}
              onValueChange={toggleDownloadImages}
              color={Colors.dark.tint}
              style={styles.switch}
            />
          </View>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Weekly goal pressed")}
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
                5 days per week
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>
            Units of measurement
          </ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Weight unit pressed")}
          >
            <MaterialCommunityIcons
              name="scale"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Weight unit</ThemedText>
              <ThemedText style={styles.currentSetting}>Kilograms</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Distance unit pressed")}
          >
            <MaterialCommunityIcons
              name="run"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Distance unit</ThemedText>
              <ThemedText style={styles.currentSetting}>Kilometers</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Size unit pressed")}
          >
            <MaterialCommunityIcons
              name="tape-measure"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Size unit</ThemedText>
              <ThemedText style={styles.currentSetting}>Centimeters</ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Workout</ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Weight increment pressed")}
          >
            <MaterialCommunityIcons
              name="plus"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Weight increment</ThemedText>
              <ThemedText style={styles.currentSetting}>2.5 kg</ThemedText>
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
                {keepScreenOn ? "Enabled" : "Disabled"}
              </ThemedText>
            </View>
            <Switch
              value={keepScreenOn}
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
            onPress={() => console.log("Default sets pressed")}
          >
            <MaterialCommunityIcons
              name="numeric"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Default sets</ThemedText>
              <ThemedText style={styles.currentSetting}>3 sets</ThemedText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Default rest time pressed")}
          >
            <MaterialCommunityIcons
              name="clock"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>Default rest time</ThemedText>
              <ThemedText style={styles.currentSetting}>60 seconds</ThemedText>
            </View>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} />

        <View style={styles.section}>
          <ThemedText style={styles.sectionHeader}>Appearance</ThemedText>
          <TouchableOpacity
            style={styles.item}
            onPress={() => console.log("Button size pressed")}
          >
            <MaterialCommunityIcons
              name="resize"
              size={24}
              color={Colors.dark.icon}
              style={styles.icon}
            />
            <View style={styles.textContainer}>
              <ThemedText style={styles.itemText}>
                Change button size
              </ThemedText>
              <ThemedText style={styles.currentSetting}>Medium</ThemedText>
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
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: Colors.dark.text,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
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
    marginRight: 10,
  },
  divider: {
    marginVertical: 10,
  },
  switch: {
    marginLeft: "auto", // Push the switch to the right
  },
});
