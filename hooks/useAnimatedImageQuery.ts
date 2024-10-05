import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";

const fetchAnimatedImageUrl = async (
  exerciseId: number,
  animatedUrlPath: string,
  localPath?: string,
): Promise<string> => {
  if (localPath && localPath !== "") {
    return localPath;
  } else {
    try {
      const downloadUrl = await storage().ref(animatedUrlPath).getDownloadURL();
      const localUri = `${FileSystem.documentDirectory}exercise_${exerciseId}.webp`;
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
      );
      await downloadResumable.downloadAsync();

      try {
        await insertAnimatedImageUri(exerciseId, localUri);
        return localUri;
      } catch (error) {
        console.error("Error inserting animated image URI:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error fetching or saving image:", error);
      throw error;
    }
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
