import { View, StyleSheet, FlatList } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { UserExercise } from "@/store/workoutStore";
import { Image } from "expo-image";
import { byteArrayToBase64 } from "@/utils/utility";
import { TouchableOpacity } from "react-native";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function WorkoutDetailsScreen() {
  const { workoutIndex, planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));

  const workout = plan?.workouts[Number(workoutIndex)];

  const renderExerciseItem = ({ item }: { item: UserExercise }) => {
    let base64Image: string | undefined;
    if (item.image) {
      const base64String = byteArrayToBase64(item.image);
      base64Image = `data:image/webp;base64,${base64String}`;
    }

    const minReps = Math.min(
      ...item.sets.map((set) => set.repsMin ?? Infinity),
    );
    const maxReps = Math.max(
      ...item.sets.map((set) => set.repsMax ?? -Infinity),
    );

    let repRange;
    if (minReps === Infinity && maxReps !== -Infinity) {
      repRange = `${maxReps}`; // Only show maxReps if minReps is undefined
    } else if (maxReps === -Infinity && minReps !== Infinity) {
      repRange = `${minReps}`; // Only show minReps if maxReps is undefined
    } else if (minReps !== Infinity && maxReps !== -Infinity) {
      repRange = `${minReps} - ${maxReps}`; // Show range if both are defined
    }

    const exerciseItem = { ...item, image: undefined };

    return (
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: "/(app)/exercise-details",
            params: { exercise: JSON.stringify(exerciseItem) },
          });
        }}
      >
        <View style={styles.exerciseItem}>
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
            <ThemedText style={styles.exerciseSets}>
              {item?.sets?.length
                ? `${item.sets.length} Sets`
                : "No Sets Available"}
            </ThemedText>
            {repRange && (
              <ThemedText style={styles.exerciseReps}>
                Reps: {repRange}
              </ThemedText>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <ThemedText>Loading...</ThemedText>;
  }

  if (error) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          title: workout?.name,
        }}
      />

      <FlatList
        style={styles.container}
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
  },
  workoutHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  workoutName: {
    fontSize: 24,
    color: "#ECEFF4",
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
