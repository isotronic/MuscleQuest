import { View, StyleSheet, ScrollView } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";

export default function ExerciseDetailsScreen() {
  const { exercise } = useLocalSearchParams();

  const exerciseData = exercise
    ? JSON.parse(typeof exercise === "string" ? exercise : exercise[0])
    : null;

  if (exerciseData) {
    if (typeof exerciseData.secondary_muscles === "string") {
      try {
        exerciseData.secondary_muscles = JSON.parse(
          exerciseData.secondary_muscles,
        );
      } catch (error) {
        console.error("Error parsing secondary_muscles:", error);
      }
    }

    if (typeof exerciseData.description === "string") {
      try {
        exerciseData.description = JSON.parse(exerciseData.description);
      } catch (error) {
        console.error("Error parsing description:", error);
      }
    }
  }

  const {
    data: animatedUrl,
    error: animatedImageError,
    isLoading: animatedImageLoading,
  } = useAnimatedImageQuery(
    exerciseData?.exercise_id,
    exerciseData?.animated_url,
    exerciseData?.local_animated_uri,
  );

  if (!exerciseData) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.errorText}>Invalid exercise data</ThemedText>
      </View>
    );
  }

  return (
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
      ) : (
        <ThemedText style={styles.loadingText}>No GIF available</ThemedText>
      )}
      <ThemedText style={styles.title}>{exerciseData.name}</ThemedText>
      <ThemedText style={styles.infoText}>
        Target Muscle: {exerciseData.target_muscle}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        Secondary Muscles: {exerciseData.secondary_muscles.join(", ")}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        Body Part: {exerciseData.body_part}
      </ThemedText>
      <ThemedText style={styles.infoText}>
        Equipment: {exerciseData.equipment}
      </ThemedText>
      <ThemedText style={styles.descriptionTitle}>Description:</ThemedText>
      {exerciseData.description &&
        exerciseData.description.map((item: string, index: number) => (
          <View key={index} style={styles.bulletItem}>
            <ThemedText style={styles.bulletPoint}>•</ThemedText>
            <ThemedText style={styles.bulletText}>{item}</ThemedText>
          </View>
        ))}
    </ScrollView>
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
