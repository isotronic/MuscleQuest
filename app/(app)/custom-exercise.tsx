import { useState, useEffect } from "react";
import {
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Button } from "react-native-paper";
import DropDownPicker from "react-native-dropdown-picker";
import { ThemedText } from "@/components/ThemedText";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Exercise, fetchAllRecords, openDatabase } from "@/utils/database";
import { capitalizeWords } from "@/utils/utility";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/ThemedView";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkoutStore } from "@/store/workoutStore";

export default function AddCustomExerciseScreen() {
  const queryClient = useQueryClient();
  const { setNewExerciseId } = useWorkoutStore();
  const { exercise_id } = useLocalSearchParams(); // Retrieve exercise_id param for edit mode
  const isEditing = !!exercise_id;

  // States to control the open/close of each dropdown
  const [bodyPartOpen, setBodyPartOpen] = useState(false);
  const [targetMuscleOpen, setTargetMuscleOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [secondaryMusclesOpen, setSecondaryMusclesOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<null | string>(null);

  const [bodyPart, setBodyPart] = useState<string>("");
  const [targetMuscle, setTargetMuscle] = useState<string>("");
  const [equipment, setEquipment] = useState<string>("");
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);

  const [bodyPartOptions, setBodyPartOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [muscleOptions, setMuscleOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [equipmentOptions, setEquipmentOptions] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bodyParts = (await fetchAllRecords(
          "userData.db",
          "body_parts",
        )) as {
          body_part: string;
        }[];
        const muscles = (await fetchAllRecords("userData.db", "muscles")) as {
          muscle: string;
        }[];
        const equipmentList = (await fetchAllRecords(
          "userData.db",
          "equipment_list",
        )) as { equipment: string }[];

        const newBodyPartOptions = bodyParts.map((bodyPart) => ({
          label: capitalizeWords(bodyPart.body_part),
          value: bodyPart.body_part,
        }));

        const newMuscleOptions = muscles.map((muscle) => ({
          label: capitalizeWords(muscle.muscle),
          value: muscle.muscle,
        }));

        const newEquipmentOptions = equipmentList.map((equipment) => ({
          label: capitalizeWords(equipment.equipment),
          value: equipment.equipment,
        }));

        setBodyPartOptions(newBodyPartOptions);
        setMuscleOptions(newMuscleOptions);
        setEquipmentOptions(newEquipmentOptions);
      } catch (error) {
        Alert.alert("Error", "Failed to fetch data. Please try again.");
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (isEditing) {
      const fetchExerciseData = async () => {
        try {
          const db = await openDatabase("userData.db");
          const existingData = (await db.getFirstAsync(
            `SELECT * FROM exercises WHERE exercise_id = ?`,
            [Number(exercise_id)],
          )) as Exercise;

          if (existingData) {
            setName(existingData.name);
            setDescription(JSON.parse(existingData.description)[0]);
            setImage(existingData.local_animated_uri);
            setBodyPart(existingData.body_part);
            setTargetMuscle(existingData.target_muscle);
            setEquipment(existingData.equipment);
            setSecondaryMuscles(
              Array.isArray(existingData.secondary_muscles)
                ? existingData.secondary_muscles
                : JSON.parse(existingData.secondary_muscles) || [],
            );
          }
        } catch (error) {
          console.error("Error fetching exercise data for editing:", error);
          Alert.alert("Error", "Failed to load exercise details.");
        }
      };

      fetchExerciseData();
    }
  }, [exercise_id, isEditing]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!name || !bodyPart || !targetMuscle || !equipment) {
      Alert.alert("Please fill all required fields.");
      return;
    }

    let newImageUri = "";

    if (image) {
      const fileName = image.split("/").pop();
      newImageUri = `${FileSystem.documentDirectory}${fileName}`;

      try {
        await FileSystem.moveAsync({
          from: image,
          to: newImageUri,
        });
      } catch (error) {
        console.error("Error saving image to filesystem:", error);
        Alert.alert(
          "Image Save Error",
          "Failed to save the image. Please try again.",
          [{ text: "OK" }],
        );
      }
    }

    try {
      const db = await openDatabase("userData.db");

      if (isEditing) {
        // Update existing exercise
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
          `INSERT INTO exercises (app_exercise_id, name, description, local_animated_uri, body_part, target_muscle, equipment, secondary_muscles) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            JSON.stringify([description]),
            newImageUri,
            bodyPart,
            targetMuscle,
            equipment,
            JSON.stringify(secondaryMuscles),
          ],
        );

        const result = (await db.getFirstAsync(
          `SELECT exercise_id FROM exercises ORDER BY exercise_id DESC LIMIT 1`,
        )) as { exercise_id: number };
        const newExerciseId = result?.exercise_id;
        setNewExerciseId(newExerciseId);
      }

      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({
        queryKey: ["exercise-details", Number(exercise_id)],
      });
      router.back();
    } catch (error) {
      Alert.alert("Error", "Failed to save custom exercise. Please try again.");
      console.error("Error saving data:", error);
    }
  };

  return (
    <ThemedView>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          nestedScrollEnabled={true}
        >
          {/* Image Picker */}
          <Button
            mode="outlined"
            onPress={pickImage}
            style={{ marginBottom: 16 }}
          >
            {image ? "Change Image" : "Add Image"}
          </Button>

          {/* Name Input */}
          <ThemedText>Name*</ThemedText>
          <TextInput
            placeholder="Enter exercise name"
            value={name}
            onChangeText={setName}
            selectTextOnFocus={true}
            placeholderTextColor={Colors.dark.subText}
            style={styles.input}
          />

          {/* Description Text Area */}
          <ThemedText>Description</ThemedText>
          <TextInput
            placeholder="Enter description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
            placeholderTextColor={Colors.dark.subText}
            style={[styles.input, styles.multilineInput]}
          />

          {/* Body Part Dropdown */}
          <DropDownPicker
            zIndex={4000}
            zIndexInverse={1000}
            listMode="SCROLLVIEW"
            open={bodyPartOpen}
            value={bodyPart}
            items={bodyPartOptions}
            setOpen={setBodyPartOpen}
            setValue={setBodyPart}
            setItems={setBodyPartOptions}
            placeholder="Select body part*"
            placeholderStyle={styles.dropdownPlaceholder}
            style={styles.dropdown}
            textStyle={{
              color: Colors.dark.text,
              fontSize: 18,
            }}
            dropDownContainerStyle={styles.dropdownContainer}
            arrowIconStyle={{ tintColor: Colors.dark.text }}
            tickIconStyle={{ tintColor: Colors.dark.text }}
            listItemLabelStyle={{
              color: Colors.dark.text,
            }}
            selectedItemLabelStyle={{
              color: Colors.dark.text,
            }}
          />

          {/* Target Muscle Dropdown */}
          <DropDownPicker
            zIndex={3000}
            zIndexInverse={2000}
            listMode="SCROLLVIEW"
            open={targetMuscleOpen}
            value={targetMuscle}
            items={muscleOptions}
            setOpen={setTargetMuscleOpen}
            setValue={setTargetMuscle}
            setItems={setMuscleOptions}
            placeholder="Select target muscle*"
            placeholderStyle={styles.dropdownPlaceholder}
            style={styles.dropdown}
            textStyle={{
              color: Colors.dark.text,
              fontSize: 18,
            }}
            dropDownContainerStyle={styles.dropdownContainer}
            arrowIconStyle={{ tintColor: Colors.dark.text }}
            tickIconStyle={{ tintColor: Colors.dark.text }}
            listItemLabelStyle={{
              color: Colors.dark.text,
            }}
            selectedItemLabelStyle={{
              color: Colors.dark.text,
            }}
          />

          {/* Equipment Dropdown */}
          <DropDownPicker
            zIndex={2000}
            zIndexInverse={5000}
            listMode="SCROLLVIEW"
            dropDownDirection="TOP"
            open={equipmentOpen}
            value={equipment}
            items={equipmentOptions}
            setOpen={setEquipmentOpen}
            setValue={setEquipment}
            setItems={setEquipmentOptions}
            placeholder="Select equipment*"
            placeholderStyle={styles.dropdownPlaceholder}
            style={styles.dropdown}
            textStyle={{
              color: Colors.dark.text,
              fontSize: 18,
            }}
            dropDownContainerStyle={styles.dropdownContainer}
            arrowIconStyle={{ tintColor: Colors.dark.text }}
            tickIconStyle={{ tintColor: Colors.dark.text }}
            listItemLabelStyle={{
              color: Colors.dark.text,
            }}
            selectedItemLabelStyle={{
              color: Colors.dark.text,
            }}
          />

          {/* Secondary Muscles Multi-Select Dropdown */}
          <DropDownPicker
            zIndex={1000}
            zIndexInverse={4000}
            listMode="SCROLLVIEW"
            dropDownDirection="TOP"
            open={secondaryMusclesOpen}
            value={secondaryMuscles}
            items={muscleOptions}
            setOpen={setSecondaryMusclesOpen}
            setValue={setSecondaryMuscles}
            setItems={setMuscleOptions}
            multiple={true}
            min={0}
            max={5}
            placeholder="Select secondary muscles"
            placeholderStyle={styles.dropdownPlaceholder}
            style={styles.dropdown}
            textStyle={{
              color: Colors.dark.text,
              fontSize: 18,
            }}
            dropDownContainerStyle={styles.dropdownContainer}
            arrowIconStyle={{ tintColor: Colors.dark.text }}
            tickIconStyle={{ tintColor: Colors.dark.text }}
            listItemLabelStyle={{
              color: Colors.dark.text,
              fontSize: 18,
            }}
            selectedItemLabelStyle={{
              color: Colors.dark.text,
            }}
          />

          {/* Submit Button */}
          <Button
            mode="contained"
            labelStyle={styles.buttonLabel}
            onPress={handleSubmit}
          >
            {isEditing ? "Save" : "Save and select"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 10,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    marginBottom: 16,
  },
  multilineInput: {
    textAlignVertical: "top",
  },
  dropdown: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.subText,
    marginBottom: 16,
  },
  dropdownContainer: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.text,
  },
  dropdownPlaceholder: {
    color: Colors.dark.subText,
    fontSize: 18,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
