import { useQuery } from "@tanstack/react-query";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import { File, Paths } from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

export const fetchAnimatedImageUrl = async (
  exerciseId: number,
  animatedUrlPath: string,
  localPath?: string,
  maxRetries = 3,
): Promise<string> => {
  if (localPath && localPath !== "") {
    const localFile = new File(localPath);
    if (localFile.exists) {
      return localPath;
    }
    // File was deleted (reinstall, OS cache clear, etc.) — re-download below
  }

  let attempt = 0;
  let lastError;
  const destFile = new File(Paths.document, `exercise_${exerciseId}.webp`);
  const storageRef = ref(getStorage(), animatedUrlPath);

  while (attempt < maxRetries) {
    try {
      const downloadUrl = await getDownloadURL(storageRef);
      await File.downloadFileAsync(downloadUrl, destFile, {
        idempotent: true,
      });

      try {
        await insertAnimatedImageUri(exerciseId, destFile.uri);
        return destFile.uri;
      } catch (error) {
        console.error("Error inserting animated image URI:", error);
        throw error;
      }
    } catch (error: any) {
      attempt++;
      console.error(
        `Attempt ${attempt} - Error fetching or saving image:`,
        error,
      );
      lastError = error;

      if (attempt < maxRetries) {
        const delayTime = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      } else {
        Bugsnag.notify(lastError);
        throw lastError;
      }
    }
  }
  throw lastError;
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
    staleTime: 1000 * 60 * 60, // 1 hour,
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};
