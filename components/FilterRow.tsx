import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, StyleSheet, Alert, Text } from "react-native";
import { t } from "@lingui/core/macro";
import { capitalizeWords } from "@/utils/utility";
import { fetchAllRecords, fetchMusclesByFilters } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme";
import { AppSelect, type SelectOption } from "@/components/ui/AppSelect";
import type { AppThemeColors } from "@/theme/types";

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [bodyPartOptions, setBodyPartOptions] = useState<SelectOption[]>([]);
  const [allMuscleOptions, setAllMuscleOptions] = useState<SelectOption[]>([]);
  const [muscleOptions, setMuscleOptions] = useState<SelectOption[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<SelectOption[]>([]);
  const hasCalledReadyRef = useRef(false);

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

        setBodyPartOptions([
          { label: t`All body parts`, value: "all" },
          ...bodyParts.map((b) => ({
            label: capitalizeWords(b.body_part),
            value: b.body_part,
          })),
        ]);
        const allMuscles = [
          { label: t`All target muscles`, value: "all" },
          ...muscles.map((m) => ({
            label: capitalizeWords(m.muscle),
            value: m.muscle,
          })),
        ];
        setAllMuscleOptions(allMuscles);
        setMuscleOptions(allMuscles);
        setEquipmentOptions([
          { label: t`All equipment`, value: "all" },
          ...equipmentList.map((e) => ({
            label: capitalizeWords(e.equipment),
            value: e.equipment,
          })),
        ]);

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

  const renderListItem = (item: SelectOption, selected?: boolean) => (
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
          color={colors.contentPrimary}
          style={styles.checkmark}
        />
      )}
    </View>
  );

  const ItemSeparator = () => <View style={styles.itemSeparator} />;

  return (
    <View style={styles.row}>
      <View style={styles.dropdownContainer}>
        <AppSelect
          data={equipmentOptions}
          placeholder={t`All equipment`}
          value={selectedEquipment}
          onChange={setSelectedEquipment}
          renderItem={renderListItem}
          flatListProps={{
            nestedScrollEnabled: true,
            ItemSeparatorComponent: ItemSeparator,
          }}
        />
      </View>
      <View style={styles.dropdownContainer}>
        <AppSelect
          data={bodyPartOptions}
          placeholder={t`All body parts`}
          value={selectedBodyPart}
          onChange={setSelectedBodyPart}
          renderItem={renderListItem}
          flatListProps={{
            nestedScrollEnabled: true,
            ItemSeparatorComponent: ItemSeparator,
          }}
        />
      </View>
      <View style={styles.dropdownContainerNoMargin}>
        <AppSelect
          data={muscleOptions}
          placeholder={t`All target muscles`}
          value={selectedTargetMuscle}
          onChange={setSelectedTargetMuscle}
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

export default React.memo(FilterRow);

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 8,
      backgroundColor: colors.surface,
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
    customItemContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    selectedItemContainer: {
      backgroundColor: colors.card,
    },
    customItemText: {
      color: colors.contentPrimary,
      fontSize: 14,
    },
    checkmark: {
      marginLeft: 10,
    },
    itemSeparator: {
      height: 1,
      backgroundColor: colors.contentSecondary,
    },
  });
}
