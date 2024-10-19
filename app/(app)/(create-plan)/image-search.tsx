import React, { useState } from "react";
import {
  FlatList,
  TouchableOpacity,
  StyleSheet,
  View,
  Linking,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createApi } from "unsplash-js";
import { useNavigation } from "expo-router";
import { Basic } from "unsplash-js/dist/methods/photos/types";
import { ThemedView } from "@/components/ThemedView";
import { useWorkoutStore } from "@/store/workoutStore";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

const unsplash = createApi({
  accessKey: process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || "",
});

export default function ImageSearchScreen() {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<React.SetStateAction<Basic[]>>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { setPlanImageUrl } = useWorkoutStore();
  const navigation = useNavigation();

  const handleSearch = async () => {
    setPage(1); // Reset page when doing a new search
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoading(true);
    const nextPage = page + 1;
    try {
      const response = await unsplash.search.getPhotos({
        query,
        page: nextPage,
        perPage: 20,
      });
      const newPhotos = response.response?.results || [];
      setPhotos((prevPhotos: Basic[]) => [...prevPhotos, ...newPhotos]);
      setPage(nextPage);
    } catch (error) {
      console.error("Error loading more images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (url: string) => {
    setPlanImageUrl(url);
    navigation.goBack();
  };

  const openPhotographerProfile = (url: string) => {
    Linking.openURL(`${url}?utm_source=MuscleQuest&utm_medium=referral`);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search for images"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          selectTextOnFocus={true}
          onSubmitEditing={handleSearch}
          placeholderTextColor={Colors.dark.subText}
        />
        <TouchableOpacity onPress={handleSearch} style={styles.iconButton}>
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color={Colors.dark.text}
          />
        </TouchableOpacity>
      </View>
      <FlatList
        data={photos}
        keyExtractor={(item: Basic) => item.id}
        numColumns={2}
        renderItem={({ item }: { item: Basic }) => (
          <View style={styles.imageContainer}>
            <TouchableOpacity
              onPress={() => handleImageSelect(item.urls.regular)}
            >
              <Image source={{ uri: item.urls.small }} style={styles.image} />
            </TouchableOpacity>
            <View style={styles.photographerBanner}>
              <TouchableOpacity
                onPress={() => openPhotographerProfile(item.user.links.html)}
              >
                <ThemedText style={styles.photographerText}>
                  {item.user.name}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.grid}
        ListFooterComponent={
          photos.length > 0 && (
            <View style={styles.loadMoreContainer}>
              <Button onPress={handleLoadMore} disabled={loading}>
                {loading ? "Loading..." : "Load More"}
              </Button>
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  searchContainer: {
    position: "relative",
    marginBottom: 16,
  },
  searchInput: {
    padding: 10,
    borderColor: Colors.dark.text,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    fontSize: 18,
    paddingRight: 40,
  },
  iconButton: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -12 }],
  },
  imageContainer: {
    position: "relative",
    margin: 2,
    overflow: "hidden",
  },
  image: {
    width: 175,
    height: 150,
  },
  photographerBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
  },
  photographerText: {
    color: "#FFFFFF",
    fontSize: 12,
    textAlign: "center",
  },
  grid: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
