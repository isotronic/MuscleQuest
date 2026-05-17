import { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  View,
} from "react-native";
import { Button, Divider } from "react-native-paper";
import DropDownPicker from "react-native-dropdown-picker";
import { ThemedText } from "@/components/ThemedText";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Exercise, fetchAllRecords, openDatabase } from "@/utils/database";
import { capitalizeWords } from "@/utils/utility";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/ThemedView";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkoutStore } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export default function AddCustomExerciseScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const { setNewExerciseId } = useWorkoutStore();
  const { exercise_id } = useLocalSearchParams();
  const isEditing = !!exercise_id;

  // Single state controls which dropdown is open; opening one closes all others
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Tracks whether the user has made any changes since the screen mounted
  const isDirtyRef = useRef(false);
  const markDirty = () => {
    isDirtyRef.current = true;
  };

  const makeSetOpen =
    (key: string) => (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? v(openDropdown === key) : v;
      setOpenDropdown(next ? key : null);
    };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<null | string>(null);

  const [bodyPart, setBodyPart] = useState<string>("");
  const [targetMuscle, setTargetMuscle] = useState<string>("");
  const [equipment, setEquipment] = useState<string>("");
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [trackingType, setTrackingType] = useState<string>("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [bodyPartOptions, setBodyPartOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [muscleOptions, setMuscleOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [equipmentOptions, setEquipmentOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [trackingTypeOptions, setTrackingTypeOptions] = useState([
    { label: "Weight/Reps", value: "weight" },
    { label: "Assistance/Reps", value: "assisted" },
    { label: "Reps", value: "reps" },
    { label: "Time", value: "time" },
    { label: "Distance", value: "distance" },
  ]);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit Exercise" : "Create Exercise",
    });
  }, [isEditing, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      Alert.alert(
        "Discard changes?",
        "You'll lose what you've entered so far.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bodyParts = (await fetchAllRecords(
          "userData.db",
          "body_parts",
        )) as { body_part: string }[];
        const muscles = (await fetchAllRecords("userData.db", "muscles")) as {
          muscle: string;
        }[];
        const equipmentList = (await fetchAllRecords(
          "userData.db",
          "equipment_list",
        )) as { equipment: string }[];

        setBodyPartOptions(
          bodyParts.map((b) => ({
            label: capitalizeWords(b.body_part),
            value: b.body_part,
          })),
        );
        setMuscleOptions(
          muscles.map((m) => ({
            label: capitalizeWords(m.muscle),
            value: m.muscle,
          })),
        );
        setEquipmentOptions(
          equipmentList.map((e) => ({
            label: capitalizeWords(e.equipment),
            value: e.equipment,
          })),
        );
      } catch (error: any) {
        Alert.alert("Error", "Failed to fetch data. Please try again.", [
          { text: "OK" },
        ]);
        console.error("Error fetching data:", error);
        Bugsnag.notify(error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    const fetchExerciseData = async () => {
      try {
        const db = await openDatabase("userData.db");
        const existingData = (await db.getFirstAsync(
          `SELECT * FROM exercises WHERE exercise_id = ?`,
          [Number(exercise_id)],
        )) as Exercise;

        if (existingData) {
          setName(existingData.name);
          try {
            setDescription(JSON.parse(existingData.description)[0]);
          } catch {
            setDescription("");
          }
          setImage(existingData.local_animated_uri);
          setBodyPart(existingData.body_part);
          setTargetMuscle(existingData.target_muscle);
          setEquipment(existingData.equipment);
          try {
            setSecondaryMuscles(
              Array.isArray(existingData.secondary_muscles)
                ? existingData.secondary_muscles
                : JSON.parse(existingData.secondary_muscles) || [],
            );
          } catch {
            setSecondaryMuscles([]);
          }
          setTrackingType(existingData.tracking_type ?? "");
        }
      } catch (error: any) {
        console.error("Error fetching exercise data for editing:", error);
        Bugsnag.notify(error);
        Alert.alert("Error", "Failed to load exercise details.", [
          { text: "OK" },
        ]);
      }
    };

    fetchExerciseData();
  }, [exercise_id, isEditing]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      markDirty();
    }
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required.";
    if (!bodyPart) newErrors.bodyPart = "Body part is required.";
    if (!targetMuscle) newErrors.targetMuscle = "Target muscle is required.";
    if (!equipment) newErrors.equipment = "Equipment is required.";
    if (!trackingType && !isEditing)
      newErrors.trackingType = "Tracking type is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    let newImageUri = "";

    if (image) {
      const fileName = image.split("/").pop();
      newImageUri = `${FileSystem.documentDirectory}${fileName}`;
      if (image !== newImageUri) {
        try {
          await FileSystem.moveAsync({ from: image, to: newImageUri });
        } catch (error: any) {
          console.error("Error saving image to filesystem:", error);
          Bugsnag.notify(error);
          Alert.alert(
            "Image Save Error",
            "Failed to save the image. Please try again.",
            [{ text: "OK" }],
          );
        }
      }
    }

    try {
      const db = await openDatabase("userData.db");

      if (isEditing) {
        await db.runAsync(
          `UPDATE exercises SET name = ?, description = ?, local_animated_uri = ?, body_part = ?, target_muscle = ?, equipment = ?, secondary_muscles = ? WHERE exercise_id = ?`,
          [
            name,
            JSON.stringify([description]),
            newImageUri,
            bodyPart,
            targetMuscle,
            equipment,
            JSON.stringify(secondaryMuscles),
            Number(exercise_id),
          ],
        );
      } else {
        await db.runAsync(
          `INSERT INTO exercises (app_exercise_id, name, description, local_animated_uri, body_part, target_muscle, equipment, secondary_muscles, tracking_type) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            JSON.stringify([description]),
            newImageUri,
            bodyPart,
            targetMuscle,
            equipment,
            JSON.stringify(secondaryMuscles),
            trackingType,
          ],
        );

        const result = (await db.getFirstAsync(
          `SELECT exercise_id FROM exercises ORDER BY exercise_id DESC LIMIT 1`,
        )) as { exercise_id: number };
        setNewExerciseId(result?.exercise_id);
      }

      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      if (exercise_id) {
        queryClient.invalidateQueries({
          queryKey: ["exercise-info", Number(exercise_id)],
        });
      }
      isDirtyRef.current = false;
      router.back();
    } catch (error: any) {
      Alert.alert(
        "Error",
        "Failed to save custom exercise. Please try again.",
        [{ text: "OK" }],
      );
      console.error("Error saving data:", error);
      Bugsnag.notify(error);
    }
  };

  // Shared props spread onto every DropDownPicker
  const commonDropdownProps = {
    listMode: "SCROLLVIEW" as const,
    placeholderStyle: styles.dropdownPlaceholder,
    textStyle: { color: Colors.dark.text, fontSize: 18 } as const,
    dropDownContainerStyle: styles.dropdownContainer,
    arrowIconStyle: { tintColor: Colors.dark.text } as const,
    tickIconStyle: { tintColor: Colors.dark.text } as const,
    listItemLabelStyle: { color: Colors.dark.text } as const,
    selectedItemLabelStyle: { color: Colors.dark.text } as const,
  };

  // Extra props for searchable dropdowns
  const searchProps = {
    searchable: true,
    searchPlaceholder: "Search...",
    searchTextInputStyle: {
      color: Colors.dark.text,
      borderColor: Colors.dark.subText,
      borderRadius: 8,
      fontSize: 16,
      paddingHorizontal: 8,
    } as const,
    searchContainerStyle: {
      borderBottomColor: Colors.dark.subText,
      paddingVertical: 4,
    } as const,
  };

  return (
    <ThemedView>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Basics ─────────────────────────────────────── */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionHeader}>Basics</ThemedText>

            {image ? (
              <Image
                source={{ uri: image }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            ) : null}
            <Button
              mode="outlined"
              onPress={pickImage}
              style={{ marginBottom: 16 }}
            >
              {image ? "Change Image" : "Add Image"}
            </Button>

            <ThemedText style={styles.fieldLabel}>Name *</ThemedText>
            <TextInput
              placeholder="Enter exercise name"
              value={name}
              onChangeText={(v: string) => {
                setName(v);
                markDirty();
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              selectTextOnFocus={true}
              placeholderTextColor={Colors.dark.subText}
              style={[styles.input, errors.name ? styles.inputError : null]}
            />
            {errors.name ? (
              <ThemedText style={styles.errorText}>{errors.name}</ThemedText>
            ) : null}

            <ThemedText style={styles.fieldLabel}>Description</ThemedText>
            <TextInput
              placeholder="Enter description"
              value={description}
              onChangeText={(v: string) => {
                setDescription(v);
                markDirty();
              }}
              multiline
              numberOfLines={2}
              placeholderTextColor={Colors.dark.subText}
              style={[styles.input, styles.multilineInput]}
            />
          </View>

          <Divider style={styles.divider} />

          {/* ── Muscles ────────────────────────────────────── */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionHeader}>Muscles</ThemedText>

            <View style={{ zIndex: 4000 }}>
              <ThemedText style={styles.fieldLabel}>Body Part *</ThemedText>
              <DropDownPicker
                {...commonDropdownProps}
                zIndex={4000}
                zIndexInverse={1000}
                open={openDropdown === "bodyPart"}
                value={bodyPart}
                items={bodyPartOptions}
                setOpen={makeSetOpen("bodyPart")}
                setValue={setBodyPart}
                setItems={setBodyPartOptions}
                placeholder="Select body part"
                style={[
                  styles.dropdown,
                  errors.bodyPart ? styles.dropdownError : null,
                ]}
                onSelectItem={() => {
                  markDirty();
                  setErrors((p) => ({ ...p, bodyPart: "" }));
                }}
              />
              {errors.bodyPart ? (
                <ThemedText style={styles.errorText}>
                  {errors.bodyPart}
                </ThemedText>
              ) : null}
            </View>

            <View style={{ zIndex: 3000 }}>
              <ThemedText style={styles.fieldLabel}>Target Muscle *</ThemedText>
              <DropDownPicker
                {...commonDropdownProps}
                {...searchProps}
                zIndex={3000}
                zIndexInverse={2000}
                open={openDropdown === "targetMuscle"}
                value={targetMuscle}
                items={muscleOptions}
                setOpen={makeSetOpen("targetMuscle")}
                setValue={setTargetMuscle}
                setItems={setMuscleOptions}
                placeholder="Select target muscle"
                style={[
                  styles.dropdown,
                  errors.targetMuscle ? styles.dropdownError : null,
                ]}
                onSelectItem={() => {
                  markDirty();
                  setErrors((p) => ({ ...p, targetMuscle: "" }));
                }}
              />
              {errors.targetMuscle ? (
                <ThemedText style={styles.errorText}>
                  {errors.targetMuscle}
                </ThemedText>
              ) : null}
            </View>

            <View style={{ zIndex: 2000 }}>
              <ThemedText style={styles.fieldLabel}>
                Secondary Muscles
              </ThemedText>
              <DropDownPicker
                {...commonDropdownProps}
                {...searchProps}
                zIndex={2000}
                zIndexInverse={3000}
                open={openDropdown === "secondaryMuscles"}
                value={secondaryMuscles}
                items={muscleOptions}
                setOpen={makeSetOpen("secondaryMuscles")}
                setValue={setSecondaryMuscles}
                setItems={setMuscleOptions}
                multiple={true}
                min={0}
                max={5}
                mode="BADGE"
                badgeDotColors={[Colors.dark.tint]}
                badgeColors={Colors.dark.cardBackground}
                badgeTextStyle={{ color: Colors.dark.text, fontSize: 13 }}
                placeholder="Select secondary muscles"
                style={styles.dropdown}
                listItemLabelStyle={{ color: Colors.dark.text, fontSize: 18 }}
                onSelectItem={markDirty}
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* ── Equipment & Tracking ────────────────────────── */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionHeader}>
              Equipment & Tracking
            </ThemedText>

            <View
              style={{ zIndex: openDropdown === "equipment" ? 5000 : 1500 }}
            >
              <ThemedText style={styles.fieldLabel}>Equipment *</ThemedText>
              <DropDownPicker
                {...commonDropdownProps}
                {...searchProps}
                zIndex={openDropdown === "equipment" ? 5000 : 1500}
                zIndexInverse={2500}
                open={openDropdown === "equipment"}
                value={equipment}
                items={equipmentOptions}
                setOpen={makeSetOpen("equipment")}
                setValue={setEquipment}
                setItems={setEquipmentOptions}
                placeholder="Select equipment"
                dropDownContainerStyle={{
                  ...styles.dropdownContainer,
                  minHeight: 200,
                }}
                style={[
                  styles.dropdown,
                  errors.equipment ? styles.dropdownError : null,
                ]}
                onSelectItem={() => {
                  markDirty();
                  setErrors((p) => ({ ...p, equipment: "" }));
                }}
              />
              {errors.equipment ? (
                <ThemedText style={styles.errorText}>
                  {errors.equipment}
                </ThemedText>
              ) : null}
            </View>

            <View
              style={{
                zIndex: openDropdown === "trackingType" ? 5000 : 1000,
              }}
            >
              <ThemedText style={styles.fieldLabel}>Tracking Type *</ThemedText>
              <DropDownPicker
                {...commonDropdownProps}
                zIndex={openDropdown === "trackingType" ? 5000 : 1000}
                zIndexInverse={4000}
                open={openDropdown === "trackingType"}
                value={trackingType}
                items={trackingTypeOptions}
                setOpen={makeSetOpen("trackingType")}
                setValue={setTrackingType}
                setItems={setTrackingTypeOptions}
                placeholder="Select tracking type"
                disabled={isEditing}
                style={[
                  styles.dropdown,
                  errors.trackingType ? styles.dropdownError : null,
                  isEditing ? styles.dropdownDisabled : null,
                ]}
                onSelectItem={() => {
                  markDirty();
                  setErrors((p) => ({ ...p, trackingType: "" }));
                }}
              />
              {isEditing ? (
                <ThemedText style={styles.helperText}>
                  Tracking type cannot be changed after creation.
                </ThemedText>
              ) : errors.trackingType ? (
                <ThemedText style={styles.errorText}>
                  {errors.trackingType}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <Button
            mode="contained"
            labelStyle={styles.buttonLabel}
            onPress={handleSubmit}
            style={{ marginTop: 8 }}
          >
            {isEditing ? "Save" : "Save and select"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: Colors.dark.text,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: Colors.dark.subText,
    opacity: 0.4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: 6,
  },
  input: {
    padding: 10,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    marginBottom: 8,
  },
  multilineInput: {
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: Colors.dark.highlight,
  },
  imagePreview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  dropdown: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.subText,
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.text,
  },
  dropdownPlaceholder: {
    color: Colors.dark.subText,
    fontSize: 18,
  },
  dropdownError: {
    borderColor: Colors.dark.highlight,
  },
  dropdownDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: Colors.dark.highlight,
    fontSize: 12,
    marginBottom: 8,
    marginTop: -2,
  },
  helperText: {
    fontSize: 12,
    color: Colors.dark.subText,
    marginBottom: 8,
    marginTop: -2,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
