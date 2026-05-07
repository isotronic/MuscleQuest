import { File } from "expo-file-system";
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
        const file = new File(local_animated_uri);
        if (file.exists) {
          file.delete();
        }
      } catch (error: any) {
        Bugsnag.notify(error);
        console.error(
          `Error deleting image for exercise ${exercise_id}:`,
          error,
        );
        failedDeletes.push(exercise_id);
      } finally {
        completed++;
        if (onProgress) {
          onProgress(completed / totalExercises);
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
