import { View, StyleSheet, FlatList, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/Colors";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { UserExercise } from "@/store/store";
import FastImage from "react-native-fast-image";
import { byteArrayToBase64 } from "@/utils/utility";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function WorkoutDetailsScreen() {
  const { workoutIndex, planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));

  const workout = plan?.plan_data[Number(workoutIndex)];

  const renderExerciseItem = ({ item }: { item: UserExercise }) => {
    let base64Image: string | null = null;
    if (item.image) {
      const base64String = byteArrayToBase64(item.image);
      base64Image = `data:image/webp;base64,${base64String}`;
    }

    const minReps = Math.min(...item.sets.map((set) => set.repsMin));
    const maxReps = Math.max(...item.sets.map((set) => set.repsMax));

    return (
      <View style={styles.exerciseItem}>
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
          <ThemedText style={styles.exerciseSets}>
            {item?.sets?.length
              ? `${item.sets.length} Sets`
              : "No Sets Available"}
          </ThemedText>
          <ThemedText style={styles.exerciseReps}>
            {item?.sets?.length
              ? `Reps: ${minReps} - ${maxReps}`
              : "No Reps Available"}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <ThemedText>Loading...</ThemedText>;
  }

  if (error) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={workout?.exercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item: any, index: number) => index.toString()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.dark.background,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4C566A",
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  exerciseImage: {
    width: 70,
    height: 70,
    marginRight: 16,
    borderRadius: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    color: "#ECEFF4",
  },
  exerciseSets: {
    fontSize: 14,
    color: "#D8DEE9",
  },
  exerciseReps: {
    fontSize: 14,
    color: "#D8DEE9",
  },
});
