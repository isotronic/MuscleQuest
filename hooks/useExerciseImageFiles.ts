import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  writeExerciseImageFiles,
  type ExerciseImageFilesResult,
} from "@/utils/db/exerciseImageFiles";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

// Shared across mounts so a remount of the layout joins the run in progress
// instead of starting a second one over the same rows.
let inFlight: Promise<ExerciseImageFilesResult> | null = null;

// Moves exercise thumbnails from SQLite into files once the app is up, then
// refreshes cached queries so lists switch from the stored bytes to the files.
export const useExerciseImageFiles = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    inFlight ??= writeExerciseImageFiles().finally(() => {
      inFlight = null;
    });
    inFlight
      .then(({ written }) => {
        if (written > 0 && !cancelled) queryClient.invalidateQueries();
      })
      .catch((error) => notifyBugsnag(error));
    return () => {
      cancelled = true;
    };
  }, [queryClient]);
};
