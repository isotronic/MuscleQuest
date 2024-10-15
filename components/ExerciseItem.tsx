import React from "react";
import { TouchableOpacity, View, StyleSheet, Image } from "react-native";
import { Checkbox } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import FastImage from "react-native-fast-image";
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
        <Checkbox
          status={selected ? "checked" : "unchecked"}
          uncheckedColor={Colors.dark.subText}
          onPress={() => onSelect(item.exercise_id)}
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

const styles = StyleSheet.create({
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
});

export default React.memo(ExerciseItem);
