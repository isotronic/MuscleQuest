import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Text } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { Colors } from "@/constants/Colors";
import { capitalizeWords } from "@/utils/utility";
import { fetchAllRecords } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface FilterRowProps {
  selectedEquipment: string | null;
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string | null>>;
  selectedBodyPart: string | null;
  setSelectedBodyPart: React.Dispatch<React.SetStateAction<string | null>>;
  selectedTargetMuscle: string | null;
  setSelectedTargetMuscle: React.Dispatch<React.SetStateAction<string | null>>;
}

function FilterRow({
  selectedEquipment,
  setSelectedEquipment,
  selectedBodyPart,
  setSelectedBodyPart,
  selectedTargetMuscle,
  setSelectedTargetMuscle,
}: FilterRowProps) {
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [bodyPartOpen, setBodyPartOpen] = useState(false);
  const [targetMuscleOpen, setTargetMuscleOpen] = useState(false);

  const [bodyPartOptions, setBodyPartOptions] = useState<
    { label: string; value: string; key: string }[]
  >([]);
  const [muscleOptions, setMuscleOptions] = useState<
    { label: string; value: string; key: string }[]
  >([]);
  const [equipmentOptions, setEquipmentOptions] = useState<
    { label: string; value: string; key: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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

        const bodyPartOptions = [
          { label: "All body parts", value: "all", key: "all_body_parts" },
          ...bodyParts.map((bodyPart) => ({
            label: capitalizeWords(bodyPart.body_part),
            value: bodyPart.body_part,
            key: `body_part_${bodyPart.body_part}`,
          })),
        ];
        const muscleOptions = [
          { label: "All target muscles", value: "all", key: "all_muscles" },
          ...muscles.map((muscle) => ({
            label: capitalizeWords(muscle.muscle),
            value: muscle.muscle,
            key: `muscle_${muscle.muscle}`,
          })),
        ];
        const equipmentOptions = [
          { label: "All equipment", value: "all", key: "all_equipment" },
          ...equipmentList.map((equipment) => ({
            label: capitalizeWords(equipment.equipment),
            value: equipment.equipment,
            key: `equipment_${equipment.equipment}`,
          })),
        ];

        setBodyPartOptions(bodyPartOptions);
        setMuscleOptions(muscleOptions);
        setEquipmentOptions(equipmentOptions);
      } catch (error: any) {
        Alert.alert("Error", "Failed to fetch data. Please try again.", [
          { text: "OK" },
        ]);
        console.error("Error fetching data:", error);
        Bugsnag.notify(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const dropdownPlaceholders = useMemo(
    () => ({
      equipment: loading ? "Loading..." : "All equipment",
      bodyPart: loading ? "Loading..." : "All body parts",
      targetMuscle: loading ? "Loading..." : "All target muscles",
    }),
    [loading],
  );

  const renderListItem = (itemProps: any) => {
    const { item, isSelected, onPress, label } = itemProps;

    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        style={[
          styles.customItemContainer,
          isSelected && styles.selectedItemContainer,
        ]}
      >
        <Text style={styles.customItemText}>{label}</Text>
        {isSelected && item.value !== "all" && (
          <MaterialCommunityIcons
            name="check"
            size={18}
            color={Colors.dark.text}
            style={styles.checkmark}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.dropdownContainer}>
        <DropDownPicker
          open={equipmentOpen}
          value={selectedEquipment}
          items={equipmentOptions}
          setOpen={setEquipmentOpen}
          setValue={setSelectedEquipment}
          placeholder={dropdownPlaceholders.equipment}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownListContainer}
          textStyle={styles.text}
          disabled={loading}
          arrowIconStyle={{ tintColor: Colors.dark.text }}
          renderListItem={renderListItem}
        />
      </View>
      <View style={styles.dropdownContainer}>
        <DropDownPicker
          open={bodyPartOpen}
          value={selectedBodyPart}
          items={bodyPartOptions}
          setOpen={setBodyPartOpen}
          setValue={setSelectedBodyPart}
          placeholder={dropdownPlaceholders.bodyPart}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownListContainer}
          textStyle={styles.text}
          disabled={loading}
          arrowIconStyle={{ tintColor: Colors.dark.text }}
          renderListItem={renderListItem}
        />
      </View>
      <View style={styles.dropdownContainerNoMargin}>
        <DropDownPicker
          open={targetMuscleOpen}
          value={selectedTargetMuscle}
          items={muscleOptions}
          setOpen={setTargetMuscleOpen}
          setValue={setSelectedTargetMuscle}
          placeholder={dropdownPlaceholders.targetMuscle}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownListContainer}
          textStyle={styles.text}
          disabled={loading}
          arrowIconStyle={{ tintColor: Colors.dark.text }}
          renderListItem={renderListItem}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  dropdownContainer: {
    flex: 1,
    marginRight: 4,
  },
  dropdownContainerNoMargin: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.text,
    width: "100%",
    height: 50,
  },
  dropdownListContainer: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.text,
  },
  listItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.text,
  },
  placeholder: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  text: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  customItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.text,
  },
  customItemText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  checkmark: {
    marginLeft: 10,
  },
});

export default React.memo(FilterRow);
