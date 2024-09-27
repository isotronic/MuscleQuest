import React, { useState } from "react";
import { FlatList, Image, TouchableOpacity, StyleSheet } from "react-native";
import { TextInput, Button } from "react-native-paper";
import { createApi } from "unsplash-js";
import { useNavigation } from "expo-router";
import { Basic } from "unsplash-js/dist/methods/photos/types";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";

const unsplash = createApi({
  accessKey: process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || "",
});

export default function ImageSearchScreen() {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<React.SetStateAction<Basic[]>>([]);
  const { setPlanImageUrl } = useWorkoutStore();
  const navigation = useNavigation();

  const handleSearch = async () => {
    try {
      const response = await unsplash.search.getPhotos({
        query,
        page: 1,
        perPage: 20,
        orientation: "landscape",
      });
      setPhotos(response.response?.results || []);
    } catch (error) {
      console.error("Error fetching images from Unsplash:", error);
    }
  };

  const handleImageSelect = (url: string) => {
    console.log(url);
    setPlanImageUrl(url);
    navigation.goBack();
  };

  return (
    <ThemedView style={styles.container}>
      <TextInput
        placeholder="Search for images"
        value={query}
        onChangeText={setQuery}
        style={styles.searchInput}
      />
      <Button onPress={handleSearch}>Search</Button>
      <FlatList
        data={photos}
        keyExtractor={(item: Basic) => item.id}
        numColumns={2}
        renderItem={({ item }: { item: Basic }) => (
          <TouchableOpacity
            onPress={() => handleImageSelect(item.urls.regular)}
          >
            <Image source={{ uri: item.urls.small }} style={styles.image} />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF",
  },
  image: {
    width: 170,
    height: 150,
    margin: 5,
    borderRadius: 10,
  },
  grid: {
    justifyContent: "center",
    alignItems: "center",
  },
});
