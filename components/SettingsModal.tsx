import React, { useState, useEffect, useCallback } from "react";
import { Button, RadioButton, PaperProvider } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableWithoutFeedback,
  Modal,
  Text,
} from "react-native";
import { paperTheme } from "@/utils/paperTheme";
import { formatTimeInput } from "@/utils/utility";
import { TimeInput } from "./TimeInput";
import { Dropdown } from "react-native-element-dropdown";
import SliderLib, { SliderProps } from "@react-native-community/slider";
const Slider = SliderLib as unknown as React.ComponentType<SliderProps>;

// Utility function to format setting keys
const formatSettingKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const DropdownSeparator = () => <View style={dropdownSeparatorStyle} />;
const dropdownSeparatorStyle = {
  height: 1,
  backgroundColor: Colors.dark.subText,
};

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

  // Handle time input change - only format with colon
  const handleTimeInputChange = (value: string) => {
    // Only allow numbers
    const sanitizedInput = value.replace(/[^0-9]/g, "");
    const formattedValue = formatTimeInput(sanitizedInput);
    setTimeInput(formattedValue);

    // Split the formatted value into minutes and seconds
    const [minutes, seconds] = formattedValue
      .split(":")
      .map((num) => parseInt(num || "0"));

    // Update the parent component with the new minutes/seconds object
    onChangeValue({
      minutes: minutes || 0,
      seconds: seconds || 0,
    });
  };

  const handleSaveRestTime = () => {
    const [minutes, seconds] = timeInput
      .split(":")
      .map((num) => parseInt(num || "0"));
    onSave({
      minutes: minutes || 0,
      seconds: seconds || 0,
    });
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
    (item: { label: string; value: string }) => (
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
            color={Colors.dark.text}
          />
        )}
      </View>
    ),
    [inputValue],
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <PaperProvider theme={paperTheme}>
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
                        color={Colors.dark.text}
                        onPress={() =>
                          onChangeValue(Math.max(Number(inputValue) - 1, 0))
                        } // Decrement, ensure no negative values
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
                        color={Colors.dark.text}
                        onPress={() => onChangeValue(Number(inputValue) + 1)} // Increment value
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
                        <RadioButton
                          value={option}
                          color={Colors.dark.tint}
                          uncheckedColor={Colors.dark.icon}
                        />
                        <ThemedText>{option}</ThemedText>
                      </View>
                    ))}
                  </RadioButton.Group>
                )}

                {settingType === "dropdown" && options && (
                  <View style={styles.dropdownWrapper}>
                    <Dropdown
                      data={options.map((o) => ({ label: o, value: o }))}
                      labelField="label"
                      valueField="value"
                      value={inputValue as string}
                      onChange={(item) => onChangeValue(item.value)}
                      style={styles.dropdown}
                      containerStyle={styles.dropdownListContainer}
                      placeholderStyle={styles.dropdownText}
                      selectedTextStyle={styles.dropdownText}
                      flatListProps={{
                        ItemSeparatorComponent: DropdownSeparator,
                      }}
                      renderItem={renderDropdownItem}
                    />
                  </View>
                )}

                {settingType === "slider" && (
                  <View style={styles.sliderWrapper}>
                    <ThemedText style={styles.sliderValue}>
                      {Number(inputValue)}
                    </ThemedText>
                    <Slider
                      style={styles.slider}
                      minimumValue={sliderMin}
                      maximumValue={sliderMax}
                      step={sliderStep}
                      value={Number(inputValue)}
                      onValueChange={(val: number) => onChangeValue(val)}
                      minimumTrackTintColor={Colors.dark.tint}
                      maximumTrackTintColor={Colors.dark.icon}
                      thumbTintColor={Colors.dark.tint}
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
      </PaperProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalContent: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 20,
    borderRadius: 8,
    width: "90%",
    alignItems: "center",
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: Colors.dark.text,
  },
  labeledInput: {
    width: "100%",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 4,
    textAlign: "center",
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
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
    flex: 1, // Ensure the input takes up the remaining space between the buttons
    padding: 10,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    textAlign: "center",
    fontSize: 18,
    marginHorizontal: 8, // Spacing between input and icons
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
  dropdown: {
    backgroundColor: Colors.dark.cardBackground,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 12,
  },
  dropdownListContainer: {
    backgroundColor: Colors.dark.cardBackground,
    borderColor: Colors.dark.cardBackground,
    borderRadius: 8,
    padding: 4,
    elevation: 4,
  },
  dropdownText: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.dark.cardBackground,
  },
  dropdownItemText: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  sliderWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  sliderValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.dark.tint,
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
    color: Colors.dark.subText,
  },
});
