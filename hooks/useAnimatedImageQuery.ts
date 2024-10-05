import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";

const fetchAnimatedImageUrl = async (
  exerciseId: number,
  animatedUrlPath: string,
  localPath?: string,
  maxRetries = 3,
): Promise<string> => {
  if (localPath && localPath !== "") {
    return localPath;
  } else {
    let attempt = 0;
    let lastError;
    const localUri = `${FileSystem.documentDirectory}exercise_${exerciseId}.webp`;

    while (attempt < maxRetries) {
      try {
        const downloadUrl = await storage()
          .ref(animatedUrlPath)
          .getDownloadURL();

        const downloadResumable = FileSystem.createDownloadResumable(
          downloadUrl,
          localUri,
        );

        const downloadResult = await downloadResumable.downloadAsync();

        if (downloadResult && downloadResult.uri) {
          try {
            await insertAnimatedImageUri(exerciseId, localUri);
            return localUri;
          } catch (error) {
            console.error("Error inserting animated image URI:", error);
            throw error;
          }
        } else {
          throw new Error("Failed to download image.");
        }
      } catch (error) {
        attempt++;
        console.error(
          `Attempt ${attempt} - Error fetching or saving image:`,
          error,
        );
        lastError = error;

        if (attempt < maxRetries) {
          const delayTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delayTime));
        } else {
          throw lastError;
        }
      }
    }
    throw new Error("Unexpected error in fetchAnimatedImageUrl.");
  }
};

export const useAnimatedImageQuery = (
  exerciseId: number,
  animatedUrlPath: string,
  localPath?: string,
) => {
  return useQuery<string, Error>({
    queryKey: ["animatedImage", animatedUrlPath],
    queryFn: () =>
      fetchAnimatedImageUrl(exerciseId, animatedUrlPath, localPath),
    enabled: !!animatedUrlPath,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
  } as UseQueryOptions<string, Error>);
};
