import { Button, RadioButton, Menu } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  TouchableWithoutFeedback,
  Modal,
} from "react-native";
import { useState } from "react";

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
  onSave: () => void;
  onChangeValue: (
    value: string | number | { minutes: number; seconds: number },
  ) => void;
  settingType: "number" | "radio" | "dropdown" | "restTime" | null;
  options?: string[]; // For radio buttons and dropdowns
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
                  <ThemedText style={styles.inputLabel}>Enter Value</ThemedText>
                  <TextInput
                    value={inputValue.toString()}
                    onChangeText={(text: string) => onChangeValue(text)}
                    keyboardType="numeric"
                    style={styles.input}
                  />
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
                <View style={styles.timeInputContainer}>
                  <View style={styles.labeledInput}>
                    <ThemedText style={styles.inputLabel}>Minutes</ThemedText>
                    <TextInput
                      value={(
                        inputValue as { minutes: number; seconds: number }
                      ).minutes.toString()}
                      onChangeText={(text: string) =>
                        onChangeValue({
                          ...(inputValue as {
                            minutes: number;
                            seconds: number;
                          }),
                          minutes: parseInt(text, 10) || 0,
                        })
                      }
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.labeledInput}>
                    <ThemedText style={styles.inputLabel}>Seconds</ThemedText>
                    <TextInput
                      value={(
                        inputValue as { minutes: number; seconds: number }
                      ).seconds.toString()}
                      onChangeText={(text: string) =>
                        onChangeValue({
                          ...(inputValue as {
                            minutes: number;
                            seconds: number;
                          }),
                          seconds: parseInt(text, 10) || 0,
                        })
                      }
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                </View>
              )}

              {/* Save & Cancel Buttons */}
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
                  onPress={onSave}
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
  timeInputContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  labeledInput: {
    width: "48%",
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 4,
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
  input: {
    padding: 10,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    marginBottom: 16,
    textAlign: "center",
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
