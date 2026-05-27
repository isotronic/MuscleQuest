import { useState, useEffect, useRef, useMemo } from "react";
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
import { ThemedText } from "@/components/ThemedText";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Exercise, fetchAllRecords, openDatabase } from "@/utils/database";
import { capitalizeWords } from "@/utils/utility";
import { ThemedView } from "@/components/ThemedView";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkoutStore } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAppTheme, radii } from "@/theme";
import { AppSelect, type SelectOption } from "@/components/ui/AppSelect";
import type { AppThemeColors } from "@/theme/types";

export default function AddCustomExerciseScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const [bodyPartOptions, setBodyPartOptions] = useState<SelectOption[]>([]);
  const [muscleOptions, setMuscleOptions] = useState<SelectOption[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<SelectOption[]>([]);
  const trackingTypeOptions: SelectOption[] = [
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
              placeholderTextColor={colors.contentSecondary}
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
              placeholderTextColor={colors.contentSecondary}
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
            <AppSelect
              data={bodyPartOptions}
              value={bodyPart}
              onChange={(v) => {
                setBodyPart(v);
                markDirty();
                setErrors((p) => ({ ...p, bodyPart: "" }));
              }}
              placeholder={t`Select body part`}
              style={errors.bodyPart ? styles.dropdownError : undefined}
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
            <AppSelect
              data={muscleOptions}
              value={targetMuscle}
              onChange={(v) => {
                setTargetMuscle(v);
                markDirty();
                setErrors((p) => ({ ...p, targetMuscle: "" }));
              }}
              searchable
              searchPlaceholder={t`Search...`}
              placeholder={t`Select target muscle`}
              style={errors.targetMuscle ? styles.dropdownError : undefined}
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
            <AppSelect
              multiple
              data={muscleOptions}
              value={secondaryMuscles}
              onChange={(items) => {
                setSecondaryMuscles(items);
                markDirty();
              }}
              searchable
              searchPlaceholder={t`Search...`}
              placeholder={t`Select secondary muscles`}
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
            <AppSelect
              data={equipmentOptions}
              value={equipment}
              onChange={(v) => {
                setEquipment(v);
                markDirty();
                setErrors((p) => ({ ...p, equipment: "" }));
              }}
              searchable
              searchPlaceholder={t`Search...`}
              placeholder={t`Select equipment`}
              style={errors.equipment ? styles.dropdownError : undefined}
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
            <AppSelect
              data={trackingTypeOptions}
              value={trackingType}
              onChange={(v) => {
                setTrackingType(v);
                markDirty();
                setErrors((p) => ({ ...p, trackingType: "" }));
              }}
              placeholder={t`Select tracking type`}
              disabled={isEditing}
              style={[
                errors.trackingType ? styles.dropdownError : undefined,
                isEditing ? styles.dropdownDisabled : undefined,
              ]}
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

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
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
    },
    divider: {
      marginVertical: 12,
      backgroundColor: colors.contentSecondary,
      opacity: 0.4,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 6,
    },
    input: {
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      marginBottom: 8,
    },
    multilineInput: {
      textAlignVertical: "top",
    },
    inputError: {
      borderColor: colors.danger,
    },
    imagePreview: {
      width: "100%",
      height: 160,
      borderRadius: radii.lg,
      marginBottom: 12,
    },
    dropdownError: {
      borderColor: colors.danger,
      borderWidth: 1,
    },
    dropdownDisabled: {
      opacity: 0.5,
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      marginBottom: 8,
      marginTop: -2,
    },
    helperText: {
      fontSize: 12,
      color: colors.contentSecondary,
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
}
