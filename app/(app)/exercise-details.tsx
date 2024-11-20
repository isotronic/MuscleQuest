import { View, StyleSheet, ScrollView } from "react-native";
import { ActivityIndicator, IconButton, Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import { ThemedView } from "@/components/ThemedView";
import { useExerciseDetailsQuery } from "@/hooks/useExerciseDetailsQuery";
import { useToggleFavoriteExerciseMutation } from "@/hooks/useToggleFavoriteExerciseMutation";
import Bugsnag from "@bugsnag/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function ExerciseDetailsScreen() {
  const { exercise_id } = useLocalSearchParams();

  const {
    data: exerciseData,
    error: exerciseError,
    isLoading: exerciseLoading,
  } = useExerciseDetailsQuery(Number(exercise_id));

  const { mutate: toggleFavorite } = useToggleFavoriteExerciseMutation();

  const { data: animatedUrl, isLoading: animatedImageLoading } =
    useAnimatedImageQuery(
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
    } catch (error: any) {
      console.error("Error parsing secondary_muscles:", error);
      Bugsnag.notify(error);
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
    } catch (error: any) {
      console.error("Error parsing description:", error);
      Bugsnag.notify(error);
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
    if (exerciseError) {
      Bugsnag.notify(exerciseError);
    }
    return (
      <View style={styles.container}>
        <ThemedText style={styles.errorText}>
          Error loading exercise details
        </ThemedText>
      </View>
    );
  }

  const handleToggleFavorite = () => {
    toggleFavorite({
      exerciseId: exerciseData.exercise_id,
      currentStatus: exerciseData.favorite || 0,
    });
  };

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon={exerciseData.favorite ? "star" : "star-outline"}
              iconColor={
                exerciseData.favorite ? Colors.dark.tint : Colors.dark.text
              }
              size={30}
              onPress={handleToggleFavorite}
              style={styles.favoriteIcon}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.imageContainer}>
          {animatedImageLoading ? (
            <ActivityIndicator size="large" />
          ) : (
            <Image
              style={styles.image}
              source={animatedUrl ? { uri: animatedUrl } : fallbackImage}
            />
          )}
        </View>

        <View style={styles.detailsContainer}>
          <ThemedText style={styles.title}>{exerciseData.name}</ThemedText>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="target"
              size={20}
              style={styles.icon}
            />
            <ThemedText style={styles.infoText}>
              Target muscle: {exerciseData.target_muscle}
            </ThemedText>
          </View>

          {secondaryMuscles.length > 0 && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="plus"
                size={20}
                style={styles.icon}
              />
              <ThemedText style={styles.infoText}>
                Secondary muscles: {secondaryMuscles.join(", ")}
              </ThemedText>
            </View>
          )}

          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={20}
              style={styles.icon}
            />
            <ThemedText style={styles.infoText}>
              Equipment: {exerciseData.equipment}
            </ThemedText>
          </View>

          {description.length > 0 && (
            <View>
              <ThemedText style={styles.sectionTitle}>Description:</ThemedText>
              <ThemedText style={styles.descriptionText}>
                {description.join("\n")}
              </ThemedText>
            </View>
          )}

          {exerciseData.app_exercise_id === null && (
            <Button
              mode="outlined"
              style={styles.editButton}
              labelStyle={styles.buttonLabel}
              onPress={() => {
                router.push({
                  pathname: "/(app)/custom-exercise",
                  params: { exercise_id: exerciseData.exercise_id.toString() },
                });
              }}
            >
              Edit Exercise
            </Button>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.screenBackground,
    padding: 16,
    paddingBottom: 50,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: 325,
    borderRadius: 12,
  },
  detailsContainer: {
    padding: 16,
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    marginHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  icon: {
    color: Colors.dark.text,
  },
  editButton: {
    marginTop: 20,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
