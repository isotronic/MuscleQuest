import React, { useState, useEffect } from "react";
import { Button, RadioButton, Menu, PaperProvider } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableWithoutFeedback,
  Modal,
  TouchableOpacity,
} from "react-native";
import { paperTheme } from "@/utils/paperTheme";
import {
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
} from "@/utils/utility";

// Utility function to format setting keys
const formatSettingKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

interface SettingsModalProps {
  visible: boolean;
  settingKey: string | null;
  inputValue: string | number | { minutes: number; seconds: number };
  onCancel: () => void;
  onSave: (
    value: string | number | { minutes: number; seconds: number },
  ) => void;
  onChangeValue: (
    value: string | number | { minutes: number; seconds: number },
  ) => void;
  settingType: "number" | "radio" | "dropdown" | "restTime" | null;
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
}) => {
  const [menuVisible, setMenuVisible] = useState(false);

  // State to hold the formatted rest time (minutes:seconds)
  const [restTime, setRestTime] = useState<string>(
    formatFromTotalSeconds(
      (inputValue as { minutes: number; seconds: number }).minutes * 60 +
        (inputValue as { minutes: number; seconds: number }).seconds,
    ),
  );

  // Update the state when inputValue changes (e.g., when the modal is reopened)
  useEffect(() => {
    if (settingType === "restTime") {
      const totalSeconds =
        (inputValue as { minutes: number; seconds: number }).minutes * 60 +
        (inputValue as { minutes: number; seconds: number }).seconds;

      setRestTime(formatFromTotalSeconds(totalSeconds));
    }
  }, [inputValue, settingType]);

  // Handle rest time input change and format the time as "minutes:seconds"
  const handleRestTimeChange = (value: string) => {
    setRestTime(formatTimeInput(value));

    const totalSeconds = convertToTotalSeconds(formatTimeInput(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    onChangeValue({ minutes, seconds });
  };

  // Handle Save button - convert formatted restTime back to minutes and seconds
  const handleSaveRestTime = () => {
    const totalSeconds = convertToTotalSeconds(restTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    onSave({ minutes, seconds });
  };

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
                  <View style={styles.menu}>
                    <TouchableOpacity
                      onPress={() => setMenuVisible(true)}
                      style={styles.dropdown}
                    >
                      <ThemedText>{inputValue}</ThemedText>
                    </TouchableOpacity>
                    <Menu
                      visible={menuVisible}
                      onDismiss={() => setMenuVisible(false)}
                      anchor={<ThemedText>Select Value</ThemedText>}
                    >
                      {options.map((option) => (
                        <Menu.Item
                          key={option}
                          onPress={() => {
                            onChangeValue(option);
                            setMenuVisible(false);
                          }}
                          title={option}
                        />
                      ))}
                    </Menu>
                  </View>
                )}

                {settingType === "restTime" && (
                  <View style={styles.labeledInput}>
                    <ThemedText style={styles.inputLabel}>
                      Minutes:Seconds
                    </ThemedText>
                    <TextInput
                      value={restTime}
                      onChangeText={handleRestTimeChange}
                      keyboardType="numeric"
                      style={styles.input}
                      selectTextOnFocus={true}
                      onSubmitEditing={handleSaveRestTime}
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
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={
                      settingType === "restTime" ? handleSaveRestTime : onSave
                    }
                    labelStyle={styles.buttonLabel}
                    style={styles.saveButton}
                  >
                    Save
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
    backgroundColor: "rgba(0,0,0,0.5)",
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
  dropdown: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
  },
  menu: {
    marginBottom: 16,
  },
});
