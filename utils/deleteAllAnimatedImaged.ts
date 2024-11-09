import * as FileSystem from "expo-file-system";
import {
  fetchExercisesWithLocalAnimatedUri,
  clearAllLocalAnimatedUri,
} from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

export const deleteAllAnimatedImages = async (
  onProgress?: (progress: number) => void,
) => {
  try {
    const exercises = await fetchExercisesWithLocalAnimatedUri();

    const totalExercises = exercises.length;
    let completed = 0;
    const failedDeletes: number[] = [];

    for (const exercise of exercises) {
      const { exercise_id, local_animated_uri } = exercise;

      try {
        // Delete the local file
        await FileSystem.deleteAsync(local_animated_uri, { idempotent: true });
      } catch (error: any) {
        Bugsnag.notify(error);
        console.error(
          `Error deleting image for exercise ${exercise_id}:`,
          error,
        );
        failedDeletes.push(exercise_id);
      } finally {
        // Update progress
        completed++;
        if (onProgress) {
          const progress = completed / totalExercises;
          onProgress(progress);
        }
      }
    }

    // After deleting files, update the database
    await clearAllLocalAnimatedUri();

    return { success: failedDeletes.length === 0, failedDeletes };
  } catch (error: any) {
    console.error("Error deleting all images:", error);
    Bugsnag.notify(error);
    throw error;
  }
};
