import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, RadioButton } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableWithoutFeedback,
  Modal,
  Text,
} from "react-native";
import { formatTimeInput } from "@/utils/utility";
import { TimeInput } from "./TimeInput";
import { useAppTheme, radii } from "@/theme";
import { AppSelect, type SelectOption } from "@/components/ui/AppSelect";
import { AppSlider } from "@/components/ui/AppSlider";
import type { AppThemeColors } from "@/theme/types";

const formatSettingKey = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

type SettingsInputValue =
  | string
  | number
  | { minutes: number; seconds: number }
  | { hours: number; minutes: number };

interface SettingsModalProps {
  visible: boolean;
  settingKey: string | null;
  inputValue: SettingsInputValue;
  onCancel: () => void;
  onSave: (value: SettingsInputValue) => void;
  onChangeValue: (value: SettingsInputValue) => void;
  settingType:
    | "number"
    | "radio"
    | "dropdown"
    | "restTime"
    | "reminderTime"
    | "slider"
    | null;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  options?: string[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  settingKey,
  inputValue,
  onCancel,
  onSave,
  onChangeValue,
  settingType,
  options,
  sliderMin = 1,
  sliderMax = 7,
  sliderStep = 1,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [timeInput, setTimeInput] = useState("");
  const [reminderTimeInput, setReminderTimeInput] = useState("");

  useEffect(() => {
    if (
      settingType === "restTime" &&
      typeof inputValue === "object" &&
      "seconds" in inputValue
    ) {
      const minutes = inputValue.minutes.toString().padStart(1, "0");
      const seconds = inputValue.seconds.toString().padStart(2, "0");
      setTimeInput(`${minutes}:${seconds}`);
    }
    if (
      settingType === "reminderTime" &&
      typeof inputValue === "object" &&
      "hours" in inputValue
    ) {
      const hours = inputValue.hours.toString().padStart(2, "0");
      const minutes = inputValue.minutes.toString().padStart(2, "0");
      setReminderTimeInput(`${hours}:${minutes}`);
    }
  }, [inputValue, settingType]);

  const handleTimeInputChange = (value: string) => {
    const sanitizedInput = value.replace(/[^0-9]/g, "");
    const formattedValue = formatTimeInput(sanitizedInput);
    setTimeInput(formattedValue);
    const [minutes, seconds] = formattedValue
      .split(":")
      .map((num) => parseInt(num || "0"));
    onChangeValue({ minutes: minutes || 0, seconds: seconds || 0 });
  };

  const handleSaveRestTime = () => {
    const [minutes, seconds] = timeInput
      .split(":")
      .map((num) => parseInt(num || "0"));
    onSave({ minutes: minutes || 0, seconds: seconds || 0 });
  };

  const handleReminderTimeInputChange = (value: string) => {
    const sanitizedInput = value.replace(/[^0-9]/g, "");
    const formattedValue = formatTimeInput(sanitizedInput);
    const [hoursStr, minutesStr] = formattedValue.split(":");
    const hours = Math.min(parseInt(hoursStr || "0"), 23);
    const minutes = Math.min(parseInt(minutesStr || "0"), 59);
    const normalizedValue = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    setReminderTimeInput(normalizedValue);
    onChangeValue({ hours: hours || 0, minutes: minutes || 0 });
  };

  const handleSaveReminderTime = () => {
    const [hoursStr, minutesStr] = reminderTimeInput.split(":");
    const hours = Math.min(parseInt(hoursStr || "0"), 23);
    const minutes = Math.min(parseInt(minutesStr || "0"), 59);
    onSave({ hours: hours || 0, minutes: minutes || 0 });
  };

  const renderDropdownItem = useCallback(
    (item: SelectOption) => (
      <View
        style={[
          styles.dropdownItem,
          item.value === inputValue && styles.dropdownItemSelected,
        ]}
      >
        <Text style={styles.dropdownItemText}>{item.label}</Text>
        {item.value === inputValue && (
          <MaterialCommunityIcons
            name="check"
            size={18}
            color={colors.contentPrimary}
          />
        )}
      </View>
    ),
    [inputValue, styles, colors.contentPrimary],
  );

  const DropdownSeparator = useCallback(
    () => <View style={styles.dropdownSeparator} />,
    [styles],
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalHeader}>
                {settingKey ? formatSettingKey(settingKey) : ""}
              </ThemedText>

              {settingType === "number" && (
                <View style={styles.labeledInput}>
                  <View style={styles.inputRow}>
                    <MaterialCommunityIcons
                      name="minus"
                      size={32}
                      color={colors.contentPrimary}
                      onPress={() =>
                        onChangeValue(Math.max(Number(inputValue) - 1, 0))
                      }
                    />
                    <TextInput
                      value={inputValue.toString()}
                      onChangeText={(text: string) => onChangeValue(text)}
                      keyboardType="numeric"
                      style={styles.numberInput}
                      selectTextOnFocus={true}
                      onSubmitEditing={onSave}
                    />
                    <MaterialCommunityIcons
                      name="plus"
                      size={32}
                      color={colors.contentPrimary}
                      onPress={() => onChangeValue(Number(inputValue) + 1)}
                    />
                  </View>
                </View>
              )}

              {settingType === "radio" && options && (
                <RadioButton.Group
                  onValueChange={(newValue) => onChangeValue(newValue)}
                  value={inputValue as string}
                >
                  {options.map((option) => (
                    <View key={option} style={styles.radioItem}>
                      <RadioButton value={option} />
                      <ThemedText>{option}</ThemedText>
                    </View>
                  ))}
                </RadioButton.Group>
              )}

              {settingType === "dropdown" && options && (
                <View style={styles.dropdownWrapper}>
                  <AppSelect
                    data={options.map((o) => ({ label: o, value: o }))}
                    value={inputValue as string}
                    onChange={(v) => onChangeValue(v)}
                    renderItem={renderDropdownItem}
                    flatListProps={{
                      ItemSeparatorComponent: DropdownSeparator,
                    }}
                  />
                </View>
              )}

              {settingType === "slider" && (
                <View style={styles.sliderWrapper}>
                  <ThemedText style={styles.sliderValue}>
                    {Number(inputValue)}
                  </ThemedText>
                  <AppSlider
                    style={styles.slider}
                    value={Number(inputValue)}
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    onChange={(val) => onChangeValue(val)}
                  />
                  <View style={styles.sliderLabels}>
                    <ThemedText style={styles.sliderLabelText}>
                      {sliderMin}
                    </ThemedText>
                    <ThemedText style={styles.sliderLabelText}>
                      {sliderMax}
                    </ThemedText>
                  </View>
                </View>
              )}

              {settingType === "restTime" && (
                <View style={styles.labeledInput}>
                  <ThemedText style={styles.inputLabel}>
                    <Trans>Time (Min:Sec)</Trans>
                  </ThemedText>
                  <TimeInput
                    value={timeInput}
                    onChange={handleTimeInputChange}
                    style={styles.input}
                  />
                </View>
              )}

              {settingType === "reminderTime" && (
                <View style={styles.labeledInput}>
                  <ThemedText style={styles.inputLabel}>
                    <Trans>Time (Hour:Min)</Trans>
                  </ThemedText>
                  <TimeInput
                    value={reminderTimeInput}
                    onChange={handleReminderTimeInputChange}
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={onCancel}
                  labelStyle={styles.buttonLabel}
                  style={styles.cancelButton}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  mode="contained"
                  onPress={
                    settingType === "restTime"
                      ? handleSaveRestTime
                      : settingType === "reminderTime"
                        ? handleSaveReminderTime
                        : onSave
                  }
                  labelStyle={styles.buttonLabel}
                  style={styles.saveButton}
                >
                  <Trans>Save</Trans>
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.modalBackdrop,
    },
    modalContent: {
      backgroundColor: colors.card,
      padding: 20,
      borderRadius: radii.md,
      width: "90%",
      alignItems: "center",
    },
    modalHeader: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 16,
    },
    labeledInput: {
      width: "100%",
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      marginBottom: 4,
      textAlign: "center",
    },
    input: {
      flex: 1,
      padding: 10,
      borderColor: colors.contentPrimary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      textAlign: "center",
      fontSize: 18,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    numberInput: {
      flex: 1,
      padding: 10,
      borderColor: colors.contentPrimary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      textAlign: "center",
      fontSize: 18,
      marginHorizontal: 8,
    },
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
    },
    buttonLabel: {
      fontSize: 16,
    },
    saveButton: {
      width: "48%",
    },
    cancelButton: {
      width: "48%",
    },
    radioItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    dropdownWrapper: {
      width: "100%",
      marginBottom: 16,
    },
    dropdownItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    dropdownItemSelected: {
      backgroundColor: colors.cardSecondary,
    },
    dropdownItemText: {
      color: colors.contentPrimary,
      fontSize: 16,
    },
    dropdownSeparator: {
      height: 1,
      backgroundColor: colors.contentSecondary,
    },
    sliderWrapper: {
      width: "100%",
      alignItems: "center",
      marginBottom: 16,
    },
    sliderValue: {
      fontSize: 32,
      fontWeight: "bold",
      color: colors.accent,
      marginBottom: 8,
    },
    slider: {
      width: "100%",
      height: 40,
    },
    sliderLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      paddingHorizontal: 4,
    },
    sliderLabelText: {
      fontSize: 12,
      color: colors.contentSecondary,
    },
  });
}
