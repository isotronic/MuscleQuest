import {
  writeExerciseImageFiles,
  type ExerciseImageFilesResult,
} from "@/utils/db/exerciseImageFiles";

// Shared so first-launch seeding and the (app) layout's hook join one run
// instead of writing the same rows twice.
let inFlight: Promise<ExerciseImageFilesResult> | null = null;

/** Moves exercise thumbnails into files, joining a run in progress. */
export const startExerciseImageFiles =
  (): Promise<ExerciseImageFilesResult> => {
    inFlight ??= writeExerciseImageFiles().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

/** The run in progress, if any; a restore waits for it. */
export const exerciseImageFilesInFlight =
  (): Promise<ExerciseImageFilesResult> | null => inFlight;
