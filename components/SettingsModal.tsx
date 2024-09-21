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
  inputValue: string | number;
  onCancel: () => void;
  onSave: () => void;
  onChangeValue: (value: string | number) => void;
  settingType: "number" | "radio" | "dropdown" | null;
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

          {/* Render input based on the type */}
          {settingType === "number" && (
            <TextInput
              mode="contained"
              value={inputValue.toString()}
              onChangeText={(text: string) => onChangeValue(text)}
              keyboardType="numeric"
              style={styles.input}
            />
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
  input: {
    width: "100%",
    marginBottom: 16,
  },
  saveButton: {
    width: "100%",
    marginBottom: 8,
  },
  cancelButton: {
    width: "100%",
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
