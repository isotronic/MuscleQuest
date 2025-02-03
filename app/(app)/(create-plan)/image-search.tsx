import React from "react";
import {
  FlatList,
  TouchableOpacity,
  StyleSheet,
  View,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";
import { PlanImages } from "@/constants/PlanImages";
import * as ImagePicker from "expo-image-picker";
import { Button } from "react-native-paper";
import Bugsnag from "@bugsnag/expo";

export default function ImageSearchScreen() {
  const { setPlanImageUrl } = useWorkoutStore();
  const navigation = useNavigation();

  const handleImageSelect = (url: string) => {
    setPlanImageUrl(`${url}?utm_source=MuscleQuest&utm_medium=referral`);
    navigation.goBack();
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        setPlanImageUrl(result.assets[0].uri);
        navigation.goBack();
      }
    } catch (error) {
      Bugsnag.notify(error as Error);
      Alert.alert("Error", "Failed to pick image. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const photoArray = Object.entries(PlanImages).map(([key, url]) => ({
    id: key,
    uri: url,
  }));

  return (
    <ThemedView>
      <FlatList
        data={photoArray}
        keyExtractor={(item: { id: string; uri: string }) => item.id}
        numColumns={2}
        renderItem={({ item }: { item: { id: string; uri: string } }) => (
          <View style={styles.imageContainer}>
            <TouchableOpacity onPress={() => handleImageSelect(item.uri)}>
              <Image source={{ uri: item.uri }} style={styles.image} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.grid}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button mode="contained" onPress={handlePickImage}>
              Choose from Device
            </Button>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    position: "relative",
    margin: 4,
    overflow: "hidden",
  },
  image: {
    width: 175,
    height: 150,
  },
  grid: {
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    marginTop: 16,
    marginBottom: 32,
    alignItems: "center",
  },
});
