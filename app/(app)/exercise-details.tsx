import { View, StyleSheet, ScrollView } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import { ThemedView } from "@/components/ThemedView";
import { useExerciseDetailsQuery } from "@/hooks/useExerciseDetailsQuery";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function ExerciseDetailsScreen() {
  const { exercise_id } = useLocalSearchParams();

  const {
    data: exerciseData,
    error: exerciseError,
    isLoading: exerciseLoading,
  } = useExerciseDetailsQuery(Number(exercise_id));

  const {
    data: animatedUrl,
    error: animatedImageError,
    isLoading: animatedImageLoading,
  } = useAnimatedImageQuery(
    Number(exercise_id),
    exerciseData?.animated_url ?? "",
    exerciseData?.local_animated_uri,
  );

  let secondaryMuscles: string[] = [];
  if (exerciseData?.secondary_muscles) {
    try {
      secondaryMuscles =
        typeof exerciseData.secondary_muscles === "string"
          ? JSON.parse(exerciseData.secondary_muscles)
          : exerciseData.secondary_muscles;
    } catch (error) {
      console.error("Error parsing secondary_muscles:", error);
      secondaryMuscles = [];
    }
  }

  let description: string[] = [];
  if (exerciseData?.description) {
    try {
      description =
        typeof exerciseData.description === "string"
          ? JSON.parse(exerciseData.description)
          : exerciseData.description;
    } catch (error) {
      console.error("Error parsing description:", error);
      description = [];
    }
  }

  if (exerciseLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (exerciseError || !exerciseData) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.errorText}>
          Error loading exercise details
        </ThemedText>
      </View>
    );
  }

  return (
    <ThemedView style={{ backgroundColor: Colors.dark.screenBackground }}>
      <ScrollView contentContainerStyle={styles.container}>
        {animatedImageLoading ? (
          <View style={styles.loadingText}>
            <ActivityIndicator size="large" />
          </View>
        ) : animatedImageError ? (
          <ThemedText style={styles.loadingText}>Failed to load GIF</ThemedText>
        ) : animatedUrl ? (
          <Image
            style={styles.gifImage}
            source={{
              uri: animatedUrl,
            }}
          />
        ) : exerciseData.local_animated_uri ? (
          <Image
            style={styles.image}
            source={{
              uri: exerciseData.local_animated_uri,
            }}
          />
        ) : (
          <Image style={styles.image} source={fallbackImage} />
        )}
        <ThemedText style={styles.title}>{exerciseData.name}</ThemedText>
        <ThemedText style={styles.infoText}>
          Target Muscle: {exerciseData.target_muscle}
        </ThemedText>
        <ThemedText style={styles.infoText}>
          Secondary Muscles: {secondaryMuscles.join(", ")}
        </ThemedText>
        <ThemedText style={styles.infoText}>
          Body Part: {exerciseData.body_part}
        </ThemedText>
        <ThemedText style={styles.infoText}>
          Equipment: {exerciseData.equipment}
        </ThemedText>
        <ThemedText style={styles.descriptionTitle}>Description:</ThemedText>
        {exerciseData &&
          description.map((item: string, index: number) => (
            <View key={index} style={styles.bulletItem}>
              <ThemedText style={styles.bulletPoint}>•</ThemedText>
              <ThemedText style={styles.bulletText}>{item}</ThemedText>
            </View>
          ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.screenBackground,
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  infoText: {
    fontSize: 16,
    marginBottom: 10,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  descriptionList: {
    paddingBottom: 20,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  bulletPoint: {
    marginRight: 10,
    fontSize: 18,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 16,
    flex: 1,
  },
  gifImage: {
    width: 300,
    height: 300,
    marginBottom: 20,
    alignSelf: "center",
  },
  image: {
    width: "100%",
    height: 300,
    alignSelf: "center",
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    textAlign: "center",
    marginVertical: 32,
    color: "#888",
  },
  errorText: {
    fontSize: 18,
    textAlign: "center",
    marginVertical: 32,
    color: "#FF6F61",
  },
});
