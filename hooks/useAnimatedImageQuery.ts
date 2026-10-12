import { useQuery } from "@tanstack/react-query";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import { File, Paths } from "expo-file-system";
import { insertAnimatedImageUri } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { markReported, notifyBugsnag } from "@/utils/bugsnagDedup";

// Refusals by the rules: expected for a signed-out user under rules that
// predate public exercise images.
const REFUSED_STORAGE_ERRORS = new Set([
  "storage/unauthorized",
  "storage/unauthenticated",
]);

// Errors that another attempt cannot fix.
const PERMANENT_STORAGE_ERRORS = new Set([
  ...REFUSED_STORAGE_ERRORS,
  "storage/object-not-found",
]);

const isPermanentStorageError = (error: unknown) =>
  PERMANENT_STORAGE_ERRORS.has((error as { code?: string } | null)?.code ?? "");

/** React Query's default three retries, but none for a permanent error. */
export const shouldRetryAnimatedImage = (failureCount: number, error: Error) =>
  !isPermanentStorageError(error) && failureCount < 3;

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

      if (REFUSED_STORAGE_ERRORS.has(error?.code)) {
        // Expected, so it stays out of Bugsnag and the global net.
        Bugsnag.leaveBreadcrumb("Exercise image refused", { animatedUrlPath });
        markReported(error);
        throw error;
      }
      if (isPermanentStorageError(error)) {
        notifyBugsnag(error);
        throw error;
      }

      if (attempt < maxRetries) {
        const delayTime = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      } else {
        notifyBugsnag(lastError);
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
    retry: shouldRetryAnimatedImage,
    staleTime: 1000 * 60 * 60, // 1 hour,
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};
