import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  writeExerciseImageFiles,
  type ExerciseImageFilesResult,
} from "@/utils/db/exerciseImageFiles";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

// The run starts with synchronous file system calls on the JS thread. Waiting
// keeps them out of the first screen's render after boot.
export const EXERCISE_IMAGE_FILES_DELAY_MS = 3000;

// Shared across mounts so a remount of the layout joins the run in progress
// instead of starting a second one over the same rows.
let inFlight: Promise<ExerciseImageFilesResult> | null = null;

// Moves exercise thumbnails from SQLite into files once the app is up, then
// refreshes cached queries so lists switch from the stored bytes to the files.
export const useExerciseImageFiles = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      inFlight ??= writeExerciseImageFiles().finally(() => {
        inFlight = null;
      });
      inFlight
        .then(({ written }) => {
          if (written > 0 && !cancelled) queryClient.invalidateQueries();
        })
        .catch((error) => notifyBugsnag(error));
    }, EXERCISE_IMAGE_FILES_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [queryClient]);
};
