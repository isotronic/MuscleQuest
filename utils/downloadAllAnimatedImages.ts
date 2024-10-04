import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";
import { fetchExercisesWithoutLocalAnimatedUri } from "@/utils/database";

export const downloadAllAnimatedImages = async (
  onProgress?: (progress: number) => void,
) => {
  try {
    const exercises = await fetchExercisesWithoutLocalAnimatedUri();

    const totalExercises = exercises.length;
    let completed = 0;
    const concurrencyLimit = 5; // Adjust based on performance testing

    const downloadQueue = [...exercises];

    const downloadNext = async () => {
      if (downloadQueue.length === 0) {
        return;
      }

      const exercise = downloadQueue.shift()!;
      const { exercise_id, animated_url } = exercise;

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
        // Update progress
        completed++;
        if (onProgress) {
          const progress = completed / totalExercises;
          onProgress(progress);
        }
      } catch (error) {
        console.error(
          `Error downloading image for exercise ${exercise_id}:`,
          error,
        );
      }

      await downloadNext();
    };

    const downloadPromises = [];
    for (let i = 0; i < concurrencyLimit; i++) {
      downloadPromises.push(downloadNext());
    }

    await Promise.all(downloadPromises);

    return true;
  } catch (error) {
    console.error("Error downloading all images:", error);
    throw error;
  }
};
