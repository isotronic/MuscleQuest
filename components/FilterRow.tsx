import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Alert, Text } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { t } from "@lingui/core/macro";
import { Colors } from "@/constants/Colors";
import { capitalizeWords } from "@/utils/utility";
import { fetchAllRecords, fetchMusclesByFilters } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { radii } from "@/theme";

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
  onReady?: () => void;
}

function FilterRow({
  selectedEquipment,
  setSelectedEquipment,
  selectedBodyPart,
  setSelectedBodyPart,
  selectedTargetMuscle,
  setSelectedTargetMuscle,
  onReady,
}: FilterRowProps) {
  const [bodyPartOptions, setBodyPartOptions] = useState<OptionItem[]>([]);
  const [allMuscleOptions, setAllMuscleOptions] = useState<OptionItem[]>([]);
  const [muscleOptions, setMuscleOptions] = useState<OptionItem[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<OptionItem[]>([]);
  const hasCalledReadyRef = useRef(false);

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

        const bodyPartOptions = [
          { label: t`All body parts`, value: "all" },
          ...bodyParts.map((bodyPart) => ({
            label: capitalizeWords(bodyPart.body_part),
            value: bodyPart.body_part,
          })),
        ];
        const muscleOptions = [
          { label: t`All target muscles`, value: "all" },
          ...muscles.map((muscle) => ({
            label: capitalizeWords(muscle.muscle),
            value: muscle.muscle,
          })),
        ];
        const equipmentOptions = [
          { label: t`All equipment`, value: "all" },
          ...equipmentList.map((equipment) => ({
            label: capitalizeWords(equipment.equipment),
            value: equipment.equipment,
          })),
        ];

        setBodyPartOptions(bodyPartOptions);
        setAllMuscleOptions(muscleOptions);
        setMuscleOptions(muscleOptions);
        setEquipmentOptions(equipmentOptions);

        if (onReady && !hasCalledReadyRef.current) {
          hasCalledReadyRef.current = true;
          // Delay onReady to ensure Dropdown components have rendered with their values
          setTimeout(() => {
            onReady();
          }, 10);
        }
      } catch (error: any) {
        Alert.alert(t`Error`, t`Failed to fetch data. Please try again.`, [
          { text: t`OK` },
        ]);
        console.error("Error fetching data:", error);
        Bugsnag.notify(error);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const noBodyPart = !selectedBodyPart || selectedBodyPart === "all";
    const noEquipment = !selectedEquipment || selectedEquipment === "all";
    if (noBodyPart && noEquipment) {
      setMuscleOptions(allMuscleOptions);
      return;
    }
    let cancelled = false;
    const updateMuscles = async () => {
      try {
        const results = await fetchMusclesByFilters(
          selectedBodyPart,
          selectedEquipment,
        );
        if (cancelled) return;
        const filtered = [
          { label: t`All target muscles`, value: "all" },
          ...results.map((r) => ({
            label: capitalizeWords(r.target_muscle),
            value: r.target_muscle,
          })),
        ];
        setMuscleOptions(filtered);
        if (
          selectedTargetMuscle &&
          selectedTargetMuscle !== "all" &&
          !results.some((r) => r.target_muscle === selectedTargetMuscle)
        ) {
          setSelectedTargetMuscle("all");
        }
      } catch (error: any) {
        if (cancelled) return;
        setMuscleOptions(allMuscleOptions);
        setSelectedTargetMuscle(null);
        Alert.alert(t`Error`, t`Failed to fetch data. Please try again.`, [
          { text: t`OK` },
        ]);
        console.error("Error fetching muscles by body part:", error);
        Bugsnag.notify(error);
      }
    };
    updateMuscles();
    return () => {
      cancelled = true;
    };
  }, [
    selectedBodyPart,
    selectedEquipment,
    allMuscleOptions,
    selectedTargetMuscle,
    setSelectedTargetMuscle,
  ]);

  const dropdownPlaceholders = {
    equipment: t`All equipment`,
    bodyPart: t`All body parts`,
    targetMuscle: t`All target muscles`,
  };

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

  const ItemSeparator = () => <View style={styles.itemSeparator} />;

  return (
    <View style={styles.row}>
      <View style={styles.dropdownContainer}>
        <Dropdown
          autoScroll={false}
          data={equipmentOptions}
          labelField="label"
          valueField="value"
          placeholder={dropdownPlaceholders.equipment}
          placeholderStyle={styles.placeholder}
          style={styles.dropdown}
          containerStyle={styles.dropdownListContainer}
          selectedTextStyle={styles.selectedText}
          value={selectedEquipment}
          onChange={(item) => setSelectedEquipment(item.value)}
          renderItem={renderListItem}
          flatListProps={{
            nestedScrollEnabled: true,
            ItemSeparatorComponent: ItemSeparator,
          }}
        />
      </View>
      <View style={styles.dropdownContainer}>
        <Dropdown
          autoScroll={false}
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
          flatListProps={{
            nestedScrollEnabled: true,
            ItemSeparatorComponent: ItemSeparator,
          }}
        />
      </View>
      <View style={styles.dropdownContainerNoMargin}>
        <Dropdown
          autoScroll={false}
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
          flatListProps={{
            nestedScrollEnabled: true,
            ItemSeparatorComponent: ItemSeparator,
          }}
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
    paddingHorizontal: 16,
    elevation: 10,
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
    borderRadius: radii.md,
    height: 50,
    paddingHorizontal: 8,
  },
  dropdownListContainer: {
    backgroundColor: Colors.dark.cardBackground,
    borderColor: Colors.dark.cardBackground,
    borderRadius: radii.md,
    padding: 4,
    elevation: 4,
  },
  placeholder: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  text: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  selectedText: {
    backgroundColor: Colors.dark.screenBackground,
    color: Colors.dark.text,
    fontSize: 14,
  },
  customItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  selectedItemContainer: {
    backgroundColor: Colors.dark.cardBackground,
  },
  customItemText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  checkmark: {
    marginLeft: 10,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: Colors.dark.subText,
  },
});

export default React.memo(FilterRow);
