import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { Checkbox } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import { capitalizeWords } from "@/utils/utility";
import { Exercise } from "@/utils/database";

const fallbackImage = require("@/assets/images/placeholder.webp");

interface ExerciseItemProps {
  item: Exercise;
  selected: boolean;
  onSelect: (id: number) => void;
  onPress: (item: Exercise) => void;
}

const ExerciseItem = ({
  item,
  selected,
  onSelect,
  onPress,
}: ExerciseItemProps) => {
  const base64Image = `data:image/webp;base64,${btoa(String.fromCharCode(...new Uint8Array(item.image)))}`;

  return (
    <TouchableOpacity onPress={() => onPress(item)}>
      <View key={item.exercise_id} style={styles.exerciseItem}>
        {item.image ? (
          <Image
            style={styles.exerciseImage}
            source={{
              uri: base64Image,
            }}
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
        <Checkbox
          status={selected ? "checked" : "unchecked"}
          uncheckedColor={Colors.dark.subText}
          onPress={() => onSelect(item.exercise_id)}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B4252",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  exerciseImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  exerciseInfo: {
    marginLeft: 12,
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
});

export default React.memo(ExerciseItem);
