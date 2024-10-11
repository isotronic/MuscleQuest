import { useCallback, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import {
  Checkbox,
  Button,
  ActivityIndicator,
  Menu,
  PaperProvider,
  IconButton,
} from "react-native-paper";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useExercisesQuery } from "@/hooks/useExercisesQuery";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Exercise } from "@/utils/database";
import { useWorkoutStore, UserExercise } from "@/store/workoutStore";
import { Colors } from "@/constants/Colors";
import React from "react";
import FastImage from "react-native-fast-image";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { paperTheme } from "@/utils/paperTheme";

const fallbackImage = require("@/assets/images/placeholder.webp");

const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const ExerciseItem = ({
  item,
  selected,
  onSelect,
}: {
  item: UserExercise;
  selected: boolean;
  onSelect: (id: string) => void;
}) => {
  const base64Image = `data:image/webp;base64,${btoa(String.fromCharCode(...new Uint8Array(item.image)))}`;

  const handlePress = () => {
    router.push({
      pathname: "/exercise-details",
      params: { exercise: JSON.stringify(item) },
    });
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View key={item.exercise_id} style={styles.exerciseItem}>
        <Checkbox
          status={selected ? "checked" : "unchecked"}
          uncheckedColor={Colors.dark.subText}
          onPress={() => onSelect(item.exercise_id.toString())}
        />
        {item.image ? (
          <FastImage
            style={styles.exerciseImage}
            source={{
              uri: base64Image,
              priority: FastImage.priority.normal,
            }}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : (
          <Image style={styles.exerciseImage} source={fallbackImage} />
        )}
        <View style={styles.exerciseInfo}>
          <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
          <ThemedText style={styles.exerciseDetails}>
            {capitalizeWords(item.body_part)} |{" "}
            {capitalizeWords(item.equipment)}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MemoizedExerciseItem = React.memo(ExerciseItem);

export default function ExercisesScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    null,
  );
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState<
    string | null
  >(null);
  const [equipmentMenuVisible, setEquipmentMenuVisible] = useState(false);
  const [bodyPartMenuVisible, setBodyPartMenuVisible] = useState(false);
  const [targetMuscleMenuVisible, setTargetMuscleMenuVisible] = useState(false);
  const {
    data: exercises,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useExercisesQuery();
  const addExercise = useWorkoutStore((state) => state.addExercise);
  const workouts = useWorkoutStore((state) => state.workouts);
  const { index } = useLocalSearchParams();
  const currentWorkoutIndex = Number(index);
  const currentWorkout = workouts[currentWorkoutIndex];

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const defaultSetNumber = settings ? parseInt(settings?.defaultSets) : 3;
  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;

  const [selectedExercises, setSelectedExercises] = useState<string[]>(() => {
    return (
      currentWorkout?.exercises.map((exercise) =>
        exercise.exercise_id.toString(),
      ) || []
    );
  });

  const handleSelectExercise = useCallback((exerciseId: string) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );
  }, []);

  const handleAddExercise = () => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const defaultSets: UserExercise["sets"] = Array(defaultSetNumber).fill({
      repsMin: 8,
      repsMax: 12,
      restMinutes: minutes,
      restSeconds: seconds,
    });
    selectedExercises.forEach((exerciseId) => {
      const exercise = exercises?.find(
        (ex) => ex.exercise_id.toString() === exerciseId,
      );
      if (
        exercise &&
        !currentWorkout?.exercises.some(
          (e) => e.exercise_id === exercise.exercise_id,
        )
      ) {
        const exerciseToAdd: UserExercise = { ...exercise, sets: defaultSets };
        addExercise(currentWorkoutIndex, exerciseToAdd);
      }
    });
    router.back();
  };

  const filteredExercises =
    exercises?.filter((exercise) => {
      const queryWords = searchQuery.toLowerCase().split(" ");
      const matchesSearch = queryWords.every((word) =>
        exercise.name.toLowerCase().includes(word),
      );

      const matchesEquipment =
        !selectedEquipment || exercise.equipment === selectedEquipment;
      const matchesBodyPart =
        !selectedBodyPart || exercise.body_part === selectedBodyPart;
      const matchesTargetMuscle =
        !selectedTargetMuscle ||
        exercise.target_muscle === selectedTargetMuscle;

      return (
        matchesSearch &&
        matchesEquipment &&
        matchesBodyPart &&
        matchesTargetMuscle
      );
    }) || [];

  const renderExerciseItem = useCallback(
    ({ item }: { item: UserExercise }) => {
      return (
        <MemoizedExerciseItem
          item={item}
          selected={selectedExercises.includes(item.exercise_id.toString())}
          onSelect={handleSelectExercise}
        />
      );
    },
    [selectedExercises, handleSelectExercise],
  );
  if (exercisesLoading || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (exercisesError || settingsError) {
    const error = exercisesError || settingsError;
    console.log(error);
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>
          Error loading exercises: {error?.message}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              mode={selectedExercises.length > 0 ? "contained" : "outlined"}
              compact
              onPress={handleAddExercise}
              labelStyle={styles.addButtonLabel}
            >
              Add Exercises ({selectedExercises.length})
            </Button>
          ),
        }}
      />
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholderTextColor={Colors.dark.text}
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <IconButton
          icon="filter-variant"
          iconColor={Colors.dark.text}
          size={24}
          onPress={() => setFilterModalVisible(true)}
          style={styles.filterIconButton}
        />
      </View>
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
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
                    setFilterModalVisible(false);
                  }}
                  style={styles.clearButton}
                >
                  Clear Filters
                </Button>

                <Button
                  mode="contained"
                  onPress={() => setFilterModalVisible(false)}
                  style={styles.applyButton}
                >
                  Apply Filters
                </Button>
              </View>
            </View>
          </View>
        </PaperProvider>
      </Modal>
      <FlatList
        data={filteredExercises}
        keyExtractor={(item: Exercise) => item.exercise_id.toString()}
        renderItem={renderExerciseItem}
        contentContainerStyle={styles.flatListContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.screenBackground,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: Colors.dark.screenBackground,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    color: Colors.dark.text,
  },
  filterIconButton: {
    margin: 0,
  },
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
  filterButton: {
    marginBottom: 8,
  },
  flatListContent: {
    flexGrow: 1,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B4252",
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  exerciseImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 10,
  },
  exerciseInfo: {
    marginLeft: 16,
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    color: "#FFFFFF",
    flexWrap: "wrap",
    flexShrink: 1,
  },
  exerciseDetails: {
    fontSize: 14,
    color: "#D8DEE9",
  },
  loadingText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});
