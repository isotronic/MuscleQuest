import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import {
  ExerciseWithoutLocalAnimatedUriRow,
  insertAnimatedImageUri,
} from "@/utils/database";
import { fetchExercisesWithoutLocalAnimatedUri } from "@/utils/database";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const downloadExerciseImage = async (
  exercise: ExerciseWithoutLocalAnimatedUriRow,
  maxRetries: number,
): Promise<void> => {
  const { exercise_id, animated_url } = exercise;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Fetch image URL from Firebase
      const downloadUrl = await storage().ref(animated_url).getDownloadURL();

      // Define local file path
      const localUri = `${FileSystem.documentDirectory}exercise_${exercise_id}.webp`;

      // Download the image and save locally
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
      );
      await downloadResumable.downloadAsync();

      // Update the database with the local URI
      await insertAnimatedImageUri(exercise_id, localUri);

      // Download successful, exit the loop
      return;
    } catch (error) {
      attempt++;
      console.error(
        `Attempt ${attempt} - Error downloading image for exercise ${exercise_id}:`,
        error,
      );

      if (attempt >= maxRetries) {
        // Throw error after max retries exceeded
        throw new Error(
          `Failed to download image for exercise ${exercise_id} after ${maxRetries} attempts`,
        );
      }

      // Exponential backoff delay
      const delayTime = Math.pow(2, attempt) * 1000; // e.g., 2s, 4s, 8s
      await delay(delayTime);
    }
  }
};

export const downloadAllAnimatedImages = async (
  onProgress?: (progress: number) => void,
  maxRetries = 3,
) => {
  try {
    const exercises = await fetchExercisesWithoutLocalAnimatedUri();

    const totalExercises = exercises.length;
    let completed = 0;
    const concurrencyLimit = 25;
    const downloadQueue = [...exercises];
    const failedDownloads: number[] = [];

    const downloadNext = async () => {
      while (downloadQueue.length > 0) {
        const exercise = downloadQueue.shift()!;
        try {
          await downloadExerciseImage(exercise, maxRetries);
        } catch (error) {
          console.error(error);
          failedDownloads.push(exercise.exercise_id);
        } finally {
          // Update progress
          completed++;
          if (onProgress) {
            const progress = completed / totalExercises;
            onProgress(progress);
          }
        }
      }
    };

    const downloadPromises = [];
    for (let i = 0; i < concurrencyLimit; i++) {
      downloadPromises.push(downloadNext());
    }

    await Promise.all(downloadPromises);

    return { success: failedDownloads.length === 0, failedDownloads };
  } catch (error) {
    console.error("Error downloading all images:", error);
    throw error;
  }
};
