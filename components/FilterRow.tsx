import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Alert, Text } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { Colors } from "@/constants/Colors";
import { capitalizeWords } from "@/utils/utility";
import { fetchAllRecords } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface OptionItem {
  label: string;
  value: string;
}

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
  const [bodyPartOptions, setBodyPartOptions] = useState<OptionItem[]>([]);
  const [muscleOptions, setMuscleOptions] = useState<OptionItem[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<OptionItem[]>([]);
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
          { label: "All body parts", value: "all" },
          ...bodyParts.map((bodyPart) => ({
            label: capitalizeWords(bodyPart.body_part),
            value: bodyPart.body_part,
          })),
        ];
        const muscleOptions = [
          { label: "All target muscles", value: "all" },
          ...muscles.map((muscle) => ({
            label: capitalizeWords(muscle.muscle),
            value: muscle.muscle,
          })),
        ];
        const equipmentOptions = [
          { label: "All equipment", value: "all" },
          ...equipmentList.map((equipment) => ({
            label: capitalizeWords(equipment.equipment),
            value: equipment.equipment,
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

  const renderListItem = (item: OptionItem, selected?: boolean) => {
    return (
      <View
        style={[
          styles.customItemContainer,
          selected && styles.selectedItemContainer,
        ]}
      >
        <Text style={styles.customItemText}>{item.label}</Text>
        {selected && item.value !== "all" && (
          <MaterialCommunityIcons
            name="check"
            size={18}
            color={Colors.dark.text}
            style={styles.checkmark}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.dropdownContainer}>
        <Dropdown<OptionItem>
          data={equipmentOptions}
          labelField="label"
          valueField="value"
          placeholder={dropdownPlaceholders.equipment}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          containerStyle={styles.dropdownListContainer}
          selectedTextStyle={styles.text}
          value={selectedEquipment}
          onChange={(item) => setSelectedEquipment(item.value)}
          renderItem={renderListItem}
          flatListProps={{ nestedScrollEnabled: true }}
        />
      </View>
      <View style={styles.dropdownContainer}>
        <Dropdown<OptionItem>
          data={bodyPartOptions}
          labelField="label"
          valueField="value"
          placeholder={dropdownPlaceholders.bodyPart}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          containerStyle={styles.dropdownListContainer}
          selectedTextStyle={styles.text}
          value={selectedBodyPart}
          onChange={(item) => setSelectedBodyPart(item.value)}
          renderItem={renderListItem}
          flatListProps={{ nestedScrollEnabled: true }}
        />
      </View>
      <View style={styles.dropdownContainerNoMargin}>
        <Dropdown<OptionItem>
          data={muscleOptions}
          labelField="label"
          valueField="value"
          placeholder={dropdownPlaceholders.targetMuscle}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          containerStyle={styles.dropdownListContainer}
          selectedTextStyle={styles.text}
          value={selectedTargetMuscle}
          onChange={(item) => setSelectedTargetMuscle(item.value)}
          renderItem={renderListItem}
          flatListProps={{ nestedScrollEnabled: true }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    backgroundColor: Colors.dark.screenBackground,
    marginHorizontal: -16,
    paddingHorizontal: 16,
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
    borderWidth: 1,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 8,
  },
  dropdownListContainer: {
    backgroundColor: Colors.dark.screenBackground,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
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
  selectedItemContainer: {
    backgroundColor: Colors.dark.subText,
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
