import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useLocalSearchParams } from "expo-router";
import storage from "@react-native-firebase/storage";
import FastImage from "react-native-fast-image";
import { Colors } from "@/constants/Colors";

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

  const [animatedUrl, setAnimatedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (exerciseData?.animated_url) {
      const loadAnimatedImage = async () => {
        try {
          const url = await storage()
            .ref(exerciseData.animated_url)
            .getDownloadURL();
          setAnimatedUrl(url);
        } catch (error) {
          console.error("Failed to load GIF:", error);
        }
      };
      loadAnimatedImage();
    }
  }, [exerciseData?.animated_url]);

  if (!exerciseData) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.errorText}>Invalid exercise data</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {animatedUrl ? (
        <FastImage
          style={styles.gifImage}
          source={{
            uri: animatedUrl,
            priority: FastImage.priority.normal,
          }}
          resizeMode={FastImage.resizeMode.contain}
        />
      ) : (
        <ThemedText style={styles.loadingText}>Loading GIF...</ThemedText>
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
    backgroundColor: Colors.dark.background,
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
    color: "#888",
  },
  errorText: {
    fontSize: 18,
    color: "#FF6F61",
  },
});