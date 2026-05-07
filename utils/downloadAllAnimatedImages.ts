import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system/legacy";
import {
  ExerciseWithoutLocalAnimatedUriRow,
  insertAnimatedImageUris,
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
): Promise<string> => {
  const { exercise_id, animated_url } = exercise;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const downloadUrl = await storage().ref(animated_url).getDownloadURL();
      const localUri = `${FileSystem.documentDirectory}exercise_${exercise_id}.webp`;
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
      );
      await downloadResumable.downloadAsync();
      return localUri;
    } catch (error: any) {
      attempt++;
      console.error(
        `Attempt ${attempt} - Error downloading image for exercise ${exercise_id}:`,
        error,
      );

      if (attempt >= maxRetries) {
        Bugsnag.notify(error);
        throw new Error(
          `Failed to download image for exercise ${exercise_id} after ${maxRetries} attempts`,
        );
      }

      const delayTime = Math.pow(2, attempt) * 1000;
      await delay(delayTime);
    }
  }

  throw new Error(`Failed to download image for exercise ${exercise_id}`);
};

export const downloadAllAnimatedImages = async (
  onProgress?: (progress: number) => void,
  maxRetries = 3,
): Promise<DownloadAllImagesResult> => {
  try {
    const exercises = await fetchExercisesWithoutLocalAnimatedUri();

    const totalExercises = exercises.length;
    if (totalExercises === 0) {
      return { success: true, failedDownloads: [] };
    }

    let completed = 0;
    const concurrencyLimit = 25;
    const failedDownloads: number[] = [];
    const successfulUris: {
      exercise_id: number;
      local_animated_uri: string;
    }[] = [];

    let currentIndex = 0;
    let activeCount = 0;

    await new Promise<void>((resolve, reject) => {
      const startNext = () => {
        while (
          activeCount < concurrencyLimit &&
          currentIndex < totalExercises
        ) {
          const exercise = exercises[currentIndex++];
          activeCount++;

          downloadExerciseImage(exercise, maxRetries)
            .then((localUri) => {
              successfulUris.push({
                exercise_id: exercise.exercise_id,
                local_animated_uri: localUri,
              });
            })
            .catch((error) => {
              console.error(error);
              failedDownloads.push(exercise.exercise_id);
            })
            .finally(() => {
              activeCount--;
              completed++;
              if (onProgress) {
                onProgress(completed / totalExercises);
              }

              if (completed === totalExercises) {
                resolve();
              } else {
                startNext();
              }
            });
        }
      };

      startNext();
    });

    // Flush all successful URIs to the DB in a single transaction
    await insertAnimatedImageUris(successfulUris);

    return { success: failedDownloads.length === 0, failedDownloads };
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error downloading all images:", error);
    throw error;
  }
};
