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

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function ExerciseDetailsScreen() {
  const { exercise_id } = useLocalSearchParams();

  const {
    data: exerciseData,
    error: exerciseError,
    isLoading: exerciseLoading,
  } = useExerciseDetailsQuery(Number(exercise_id));

  const { mutate: toggleFavorite } = useToggleFavoriteExerciseMutation();

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
        {animatedImageLoading ? (
          <View style={styles.loadingText}>
            <ActivityIndicator size="large" />
          </View>
        ) : animatedImageError ? (
          <Image style={styles.image} source={fallbackImage} />
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
          Target muscle: {exerciseData.target_muscle}
        </ThemedText>
        {secondaryMuscles.length > 0 && (
          <ThemedText style={styles.infoText}>
            Secondary muscles: {secondaryMuscles.join(", ")}
          </ThemedText>
        )}
        <ThemedText style={styles.infoText}>
          Body part: {exerciseData.body_part}
        </ThemedText>
        <ThemedText style={styles.infoText}>
          Equipment: {exerciseData.equipment}
        </ThemedText>
        <ThemedText style={styles.infoText}>
          Tracking type: {exerciseData.tracking_type || "weight"}
        </ThemedText>
        {description.length > 0 && description[0] !== "" && (
          <View>
            <ThemedText style={styles.descriptionTitle}>
              Description:
            </ThemedText>
            {exerciseData &&
              description.map((item: string, index: number) => (
                <View key={index} style={styles.bulletItem}>
                  <ThemedText style={styles.bulletText}>{item}</ThemedText>
                </View>
              ))}
          </View>
        )}
        {exerciseData && exerciseData.app_exercise_id === null && (
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
    fontSize: 16,
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
  editButton: {
    marginTop: 20,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
