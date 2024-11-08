import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import {
  ExerciseWithoutLocalAnimatedUriRow,
  insertAnimatedImageUri,
} from "@/utils/database";
import { fetchExercisesWithoutLocalAnimatedUri } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

interface DownloadAllImagesResult {
  success: boolean;
  failedDownloads: number[];
}

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
): Promise<DownloadAllImagesResult> => {
  try {
    const exercises = await fetchExercisesWithoutLocalAnimatedUri();

    const totalExercises = exercises.length;
    let completed = 0;
    const concurrencyLimit = 25;
    const failedDownloads: number[] = [];

    // Index to keep track of the next exercise to process
    let currentIndex = 0;
    let activeCount = 0;

    return new Promise((resolve, reject) => {
      const startNext = () => {
        while (
          activeCount < concurrencyLimit &&
          currentIndex < totalExercises
        ) {
          const exercise = exercises[currentIndex++];
          activeCount++;

          // Start the download
          downloadExerciseImage(exercise, maxRetries)
            .then(() => {
              // Download successful
            })
            .catch((error) => {
              console.error(error);
              failedDownloads.push(exercise.exercise_id);
            })
            .finally(() => {
              activeCount--;
              completed++;
              if (onProgress) {
                const progress = completed / totalExercises;
                onProgress(progress);
              }

              if (completed === totalExercises) {
                // All downloads are complete
                resolve({
                  success: failedDownloads.length === 0,
                  failedDownloads,
                });
              } else {
                // Start the next download
                startNext();
              }
            });
        }
      };

      // Start initial downloads
      startNext();
    });
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error downloading all images:", error);
    throw error;
  }
};
