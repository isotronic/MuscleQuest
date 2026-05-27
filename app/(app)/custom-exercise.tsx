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
import { Button, Divider, Switch } from "react-native-paper";
import { Dropdown, MultiSelect } from "react-native-element-dropdown";
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
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { radii } from "@/theme";

export default function AddCustomExerciseScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const { setNewExerciseId } = useWorkoutStore();
  const { exercise_id } = useLocalSearchParams();
  const isEditing = !!exercise_id;

  const isDirtyRef = useRef(false);
  const markDirty = () => {
    isDirtyRef.current = true;
  };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<null | string>(null);

  const [bodyPart, setBodyPart] = useState<string>("");
  const [targetMuscle, setTargetMuscle] = useState<string>("");
  const [equipment, setEquipment] = useState<string>("");
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [trackingType, setTrackingType] = useState<string>("");
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [doubleWeight, setDoubleWeight] = useState(false);

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
  const trackingTypeOptions = [
    { label: t`Weight/Reps`, value: "weight" },
    { label: t`Assistance/Reps`, value: "assisted" },
    { label: t`Reps`, value: "reps" },
    { label: t`Time`, value: "time" },
    { label: t`Distance`, value: "distance" },
  ];

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? t`Edit Exercise` : t`Create Exercise`,
    });
  }, [isEditing, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      Alert.alert(
        t`Discard changes?`,
        t`You'll lose what you've entered so far.`,
        [
          { text: t`Keep editing`, style: "cancel" },
          {
            text: t`Discard`,
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
        Alert.alert(t`Error`, t`Failed to fetch data. Please try again.`, [
          { text: t`OK` },
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
          setIsUnilateral(existingData.is_unilateral === 1);
          setDoubleWeight(existingData.double_weight === 1);
        }
      } catch (error: any) {
        console.error("Error fetching exercise data for editing:", error);
        Bugsnag.notify(error);
        Alert.alert(t`Error`, t`Failed to load exercise details.`, [
          { text: t`OK` },
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
    if (!name.trim()) newErrors.name = t`Name is required.`;
    if (!bodyPart) newErrors.bodyPart = t`Body part is required.`;
    if (!targetMuscle) newErrors.targetMuscle = t`Target muscle is required.`;
    if (!equipment) newErrors.equipment = t`Equipment is required.`;
    if (!trackingType && !isEditing)
      newErrors.trackingType = t`Tracking type is required.`;

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
            t`Image Save Error`,
            t`Failed to save the image. Please try again.`,
            [{ text: t`OK` }],
          );
        }
      }
    }

    try {
      const db = await openDatabase("userData.db");

      if (isEditing) {
        await db.runAsync(
          `UPDATE exercises SET name = ?, description = ?, local_animated_uri = ?, body_part = ?, target_muscle = ?, equipment = ?, secondary_muscles = ?, is_unilateral = ?, double_weight = ? WHERE exercise_id = ?`,
          [
            name,
            JSON.stringify([description]),
            newImageUri,
            bodyPart,
            targetMuscle,
            equipment,
            JSON.stringify(secondaryMuscles),
            isUnilateral ? 1 : 0,
            doubleWeight ? 1 : 0,
            Number(exercise_id),
          ],
        );
      } else {
        await db.runAsync(
          `INSERT INTO exercises (app_exercise_id, name, description, local_animated_uri, body_part, target_muscle, equipment, secondary_muscles, tracking_type, is_unilateral, double_weight) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            JSON.stringify([description]),
            newImageUri,
            bodyPart,
            targetMuscle,
            equipment,
            JSON.stringify(secondaryMuscles),
            trackingType,
            isUnilateral ? 1 : 0,
            doubleWeight ? 1 : 0,
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
        t`Error`,
        t`Failed to save custom exercise. Please try again.`,
        [{ text: t`OK` }],
      );
      console.error("Error saving data:", error);
      Bugsnag.notify(error);
    }
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
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Basics ─────────────────────────────────────── */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionHeader}>
              <Trans>Basics</Trans>
            </ThemedText>

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
              {image ? <Trans>Change Image</Trans> : <Trans>Add Image</Trans>}
            </Button>

            <ThemedText style={styles.fieldLabel}>
              <Trans>Name *</Trans>
            </ThemedText>
            <TextInput
              placeholder={t`Enter exercise name`}
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

            <ThemedText style={styles.fieldLabel}>
              <Trans>Description</Trans>
            </ThemedText>
            <TextInput
              placeholder={t`Enter description`}
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
            <ThemedText style={styles.sectionHeader}>
              <Trans>Muscles</Trans>
            </ThemedText>

            <ThemedText style={styles.fieldLabel}>
              <Trans>Body Part *</Trans>
            </ThemedText>
            <Dropdown
              data={bodyPartOptions}
              labelField="label"
              valueField="value"
              value={bodyPart}
              onChange={(item) => {
                setBodyPart(item.value);
                markDirty();
                setErrors((p) => ({ ...p, bodyPart: "" }));
              }}
              placeholder={t`Select body part`}
              style={[
                styles.dropdown,
                errors.bodyPart ? styles.dropdownError : null,
              ]}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              itemTextStyle={styles.dropdownItemText}
              activeColor={Colors.dark.cardBackground}
              iconColor={Colors.dark.text}
              maxHeight={220}
            />
            {errors.bodyPart ? (
              <ThemedText style={styles.errorText}>
                {errors.bodyPart}
              </ThemedText>
            ) : null}

            <ThemedText style={styles.fieldLabel}>
              <Trans>Target Muscle *</Trans>
            </ThemedText>
            <Dropdown
              data={muscleOptions}
              labelField="label"
              valueField="value"
              value={targetMuscle}
              onChange={(item) => {
                setTargetMuscle(item.value);
                markDirty();
                setErrors((p) => ({ ...p, targetMuscle: "" }));
              }}
              search
              searchPlaceholder={t`Search...`}
              inputSearchStyle={styles.dropdownSearchInput}
              placeholder={t`Select target muscle`}
              style={[
                styles.dropdown,
                errors.targetMuscle ? styles.dropdownError : null,
              ]}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              itemTextStyle={styles.dropdownItemText}
              activeColor={Colors.dark.cardBackground}
              iconColor={Colors.dark.text}
              maxHeight={220}
            />
            {errors.targetMuscle ? (
              <ThemedText style={styles.errorText}>
                {errors.targetMuscle}
              </ThemedText>
            ) : null}

            <ThemedText style={styles.fieldLabel}>
              <Trans>Secondary Muscles</Trans>
            </ThemedText>
            <MultiSelect
              data={muscleOptions}
              labelField="label"
              valueField="value"
              value={secondaryMuscles}
              onChange={(items) => {
                setSecondaryMuscles(items);
                markDirty();
              }}
              search
              searchPlaceholder={t`Search...`}
              inputSearchStyle={styles.dropdownSearchInput}
              placeholder={t`Select secondary muscles`}
              style={styles.dropdown}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              itemTextStyle={styles.dropdownItemText}
              activeColor={Colors.dark.cardBackground}
              selectedStyle={styles.dropdownSelectedChip}
              iconColor={Colors.dark.text}
              maxHeight={220}
            />
          </View>

          <Divider style={styles.divider} />

          {/* ── Equipment & Tracking ────────────────────────── */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionHeader}>
              <Trans>Equipment & Tracking</Trans>
            </ThemedText>

            <ThemedText style={styles.fieldLabel}>
              <Trans>Equipment *</Trans>
            </ThemedText>
            <Dropdown
              data={equipmentOptions}
              labelField="label"
              valueField="value"
              value={equipment}
              onChange={(item) => {
                setEquipment(item.value);
                markDirty();
                setErrors((p) => ({ ...p, equipment: "" }));
              }}
              search
              searchPlaceholder={t`Search...`}
              inputSearchStyle={styles.dropdownSearchInput}
              placeholder={t`Select equipment`}
              style={[
                styles.dropdown,
                errors.equipment ? styles.dropdownError : null,
              ]}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              itemTextStyle={styles.dropdownItemText}
              activeColor={Colors.dark.cardBackground}
              iconColor={Colors.dark.text}
              maxHeight={220}
            />
            {errors.equipment ? (
              <ThemedText style={styles.errorText}>
                {errors.equipment}
              </ThemedText>
            ) : null}

            <ThemedText style={styles.fieldLabel}>
              <Trans>Tracking Type *</Trans>
            </ThemedText>
            <Dropdown
              data={trackingTypeOptions}
              labelField="label"
              valueField="value"
              value={trackingType}
              onChange={(item) => {
                setTrackingType(item.value);
                markDirty();
                setErrors((p) => ({ ...p, trackingType: "" }));
              }}
              placeholder={t`Select tracking type`}
              disable={isEditing}
              style={[
                styles.dropdown,
                errors.trackingType ? styles.dropdownError : null,
                isEditing ? styles.dropdownDisabled : null,
              ]}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelectedText}
              itemTextStyle={styles.dropdownItemText}
              activeColor={Colors.dark.cardBackground}
              iconColor={Colors.dark.text}
              maxHeight={220}
            />
            {isEditing ? (
              <ThemedText style={styles.helperText}>
                <Trans>Tracking type cannot be changed after creation.</Trans>
              </ThemedText>
            ) : errors.trackingType ? (
              <ThemedText style={styles.errorText}>
                {errors.trackingType}
              </ThemedText>
            ) : null}
          </View>

          <Divider style={styles.divider} />

          {/* ── Stats Options ──────────────────────────────── */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionHeader}>
              <Trans>Stats Options</Trans>
            </ThemedText>

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <ThemedText style={styles.fieldLabel}>
                  <Trans>Single-arm / single-leg</Trans>
                </ThemedText>
                <ThemedText style={styles.helperText}>
                  <Trans>
                    Count reps ×2 for volume when the setting is enabled
                  </Trans>
                </ThemedText>
              </View>
              <Switch
                value={isUnilateral}
                onValueChange={(v: boolean) => {
                  setIsUnilateral(v);
                  markDirty();
                }}
                color={Colors.dark.tint}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <ThemedText style={styles.fieldLabel}>
                  <Trans>Paired implements</Trans>
                </ThemedText>
                <ThemedText style={styles.helperText}>
                  <Trans>
                    Double the weight for volume when the setting is enabled
                  </Trans>
                </ThemedText>
              </View>
              <Switch
                value={doubleWeight}
                onValueChange={(v: boolean) => {
                  setDoubleWeight(v);
                  markDirty();
                }}
                color={Colors.dark.tint}
              />
            </View>
          </View>

          <Button
            mode="contained"
            labelStyle={styles.buttonLabel}
            onPress={handleSubmit}
            style={{ marginTop: 8 }}
          >
            {isEditing ? <Trans>Save</Trans> : <Trans>Save and select</Trans>}
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
    borderRadius: radii.md,
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
    borderRadius: radii.lg,
    marginBottom: 12,
  },
  dropdown: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 8,
  },
  dropdownList: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.subText,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  dropdownPlaceholder: {
    color: Colors.dark.subText,
    fontSize: 18,
  },
  dropdownSelectedText: {
    color: Colors.dark.text,
    fontSize: 18,
  },
  dropdownItemText: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  dropdownSearchInput: {
    color: Colors.dark.text,
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.subText,
    borderRadius: radii.md,
    fontSize: 16,
  },
  dropdownSelectedChip: {
    borderColor: Colors.dark.tint,
    borderRadius: radii.md,
    backgroundColor: Colors.dark.cardBackground,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 12,
  },
});
