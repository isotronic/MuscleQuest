import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startExerciseImageFiles } from "@/utils/exerciseImageFilesRun";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

// The run starts with synchronous file system calls on the JS thread. Waiting
// keeps them out of the first screen's render after boot.
export const EXERCISE_IMAGE_FILES_DELAY_MS = 3000;

// Moves exercise thumbnails from SQLite into files once the app is up, then
// refreshes cached queries so lists switch from the stored bytes to the files.
// On a new install first-launch seeding has usually started the run already;
// this joins it or finds nothing left to write.
export const useExerciseImageFiles = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      startExerciseImageFiles()
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
