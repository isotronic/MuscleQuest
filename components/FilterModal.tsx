import { Colors } from "@/constants/Colors";
import { Exercise } from "@/utils/database";
import { paperTheme } from "@/utils/paperTheme";
import { capitalizeWords } from "@/utils/utility";
import { useState } from "react";
import { Modal, View, StyleSheet } from "react-native";
import { PaperProvider, Menu, Button } from "react-native-paper";

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedEquipment: string | null;
  setSelectedEquipment: (value: string | null) => void;
  selectedBodyPart: string | null;
  setSelectedBodyPart: (value: string | null) => void;
  selectedTargetMuscle: string | null;
  setSelectedTargetMuscle: (value: string | null) => void;
  exercises: Exercise[] | undefined;
}

export default function FilterModal({
  visible,
  onClose,
  selectedEquipment,
  setSelectedEquipment,
  selectedBodyPart,
  setSelectedBodyPart,
  selectedTargetMuscle,
  setSelectedTargetMuscle,
  exercises,
}: FilterModalProps) {
  const [equipmentMenuVisible, setEquipmentMenuVisible] = useState(false);
  const [bodyPartMenuVisible, setBodyPartMenuVisible] = useState(false);
  const [targetMuscleMenuVisible, setTargetMuscleMenuVisible] = useState(false);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <PaperProvider theme={paperTheme}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Menu
              visible={equipmentMenuVisible}
              onDismiss={() => setEquipmentMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setEquipmentMenuVisible(true)}
                  style={styles.modalButton}
                >
                  {selectedEquipment
                    ? capitalizeWords(selectedEquipment)
                    : "Select Equipment"}
                </Button>
              }
            >
              <Menu.Item
                onPress={() => {
                  setSelectedEquipment(null);
                  setEquipmentMenuVisible(false);
                }}
                title="All Equipment"
              />
              {Array.from(new Set(exercises?.map((ex) => ex.equipment))).map(
                (equipment) => (
                  <Menu.Item
                    key={equipment}
                    onPress={() => {
                      setSelectedEquipment(equipment);
                      setEquipmentMenuVisible(false);
                    }}
                    title={capitalizeWords(equipment)}
                  />
                ),
              )}
            </Menu>

            <Menu
              visible={bodyPartMenuVisible}
              onDismiss={() => setBodyPartMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setBodyPartMenuVisible(true)}
                  style={styles.modalButton}
                >
                  {selectedBodyPart
                    ? capitalizeWords(selectedBodyPart)
                    : "Select Body Part"}
                </Button>
              }
            >
              <Menu.Item
                onPress={() => {
                  setSelectedBodyPart(null);
                  setBodyPartMenuVisible(false);
                }}
                title="All Body Parts"
              />
              {Array.from(new Set(exercises?.map((ex) => ex.body_part))).map(
                (bodyPart) => (
                  <Menu.Item
                    key={bodyPart}
                    onPress={() => {
                      setSelectedBodyPart(bodyPart);
                      setBodyPartMenuVisible(false);
                    }}
                    title={capitalizeWords(bodyPart)}
                  />
                ),
              )}
            </Menu>

            <Menu
              visible={targetMuscleMenuVisible}
              onDismiss={() => setTargetMuscleMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setTargetMuscleMenuVisible(true)}
                  style={styles.modalButton}
                >
                  {selectedTargetMuscle
                    ? capitalizeWords(selectedTargetMuscle)
                    : "Select Target Muscle"}
                </Button>
              }
            >
              <Menu.Item
                onPress={() => {
                  setSelectedTargetMuscle(null);
                  setTargetMuscleMenuVisible(false);
                }}
                title="All Target Muscles"
              />
              {Array.from(
                new Set(exercises?.map((ex) => ex.target_muscle)),
              ).map((muscle) => (
                <Menu.Item
                  key={muscle}
                  onPress={() => {
                    setSelectedTargetMuscle(muscle);
                    setTargetMuscleMenuVisible(false);
                  }}
                  title={capitalizeWords(muscle)}
                />
              ))}
            </Menu>

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={() => {
                  setSelectedEquipment(null);
                  setSelectedBodyPart(null);
                  setSelectedTargetMuscle(null);
                  onClose();
                }}
                style={styles.clearButton}
              >
                Clear Filters
              </Button>

              <Button
                mode="contained"
                onPress={onClose}
                style={styles.applyButton}
              >
                Apply Filters
              </Button>
            </View>
          </View>
        </View>
      </PaperProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 10,
    width: "90%",
    alignItems: "center",
  },
  modalButton: {
    width: "100%",
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
  },
  clearButton: {
    flex: 1,
    marginRight: 8,
  },
  applyButton: {
    flex: 1,
    marginLeft: 8,
  },
});
