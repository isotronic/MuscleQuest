import {
  Portal,
  Modal,
  Button,
  RadioButton,
  TextInput,
  Menu,
} from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { StyleSheet, View, TouchableOpacity } from "react-native";
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
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <ThemedText style={styles.modalHeader}>
            {settingKey ? formatSettingKey(settingKey) : ""}
          </ThemedText>

          {settingType === "number" && (
            <View style={styles.labeledInput}>
              <ThemedText style={styles.inputLabel}>Enter Value</ThemedText>
              <TextInput
                mode="contained"
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
                  <RadioButton value={option} color={Colors.dark.tint} />
                  <ThemedText>{option}</ThemedText>
                </View>
              ))}
            </RadioButton.Group>
          )}

          {settingType === "dropdown" && options && (
            <View>
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
                  mode="outlined"
                  value={(
                    inputValue as { minutes: number; seconds: number }
                  ).minutes.toString()}
                  onChangeText={(text: string) =>
                    onChangeValue({
                      ...(inputValue as { minutes: number; seconds: number }),
                      minutes: parseInt(text, 10) || 0,
                    })
                  }
                  keyboardType="numeric"
                  style={styles.timeInput}
                />
              </View>
              <View style={styles.labeledInput}>
                <ThemedText style={styles.inputLabel}>Seconds</ThemedText>
                <TextInput
                  mode="outlined"
                  value={(
                    inputValue as { minutes: number; seconds: number }
                  ).seconds.toString()}
                  onChangeText={(text: string) =>
                    onChangeValue({
                      ...(inputValue as { minutes: number; seconds: number }),
                      seconds: parseInt(text, 10) || 0,
                    })
                  }
                  keyboardType="numeric"
                  style={styles.timeInput}
                />
              </View>
            </View>
          )}

          {/* Save & Cancel Buttons */}
          <Button
            mode="contained"
            onPress={onSave}
            style={styles.saveButton}
            color={Colors.dark.tint}
          >
            Save
          </Button>
          <Button
            mode="outlined"
            onPress={onCancel}
            style={styles.cancelButton}
            color={Colors.dark.text}
          >
            Cancel
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
  },
  modalContent: {
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
  timeInput: {
    width: "100%",
  },
  saveButton: {
    width: "100%",
    marginBottom: 8,
  },
  cancelButton: {
    width: "100%",
  },
  input: {
    width: "100%",
    marginBottom: 16,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dropdown: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderColor: Colors.dark.tint,
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 16,
  },
});
