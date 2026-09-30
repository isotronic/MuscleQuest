import { Directory, File, Paths } from "expo-file-system";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { openDatabase } from "./connection";

const IMAGE_DIR_NAME = "exercise-images";
const BATCH_SIZE = 50;

export interface ExerciseImageFilesResult {
  written: number;
  failed: number;
}

const fileNameFor = (exerciseId: number) => `${exerciseId}.webp`;

// Writes every thumbnail still held as a BLOB to a file and records its uri in
// exercises.image_uri. Runs after every boot, off the startup path. It only
// touches rows whose file is missing or whose uri points somewhere else, so an
// interrupted run resumes, a finished one costs a directory listing, and a
// restored backup (uris but no files) or freshly seeded library heals itself.
// A failed write leaves image_uri NULL, which keeps readers on the BLOB.
export const writeExerciseImageFiles =
  async (): Promise<ExerciseImageFilesResult> => {
    const directory = new Directory(Paths.document, IMAGE_DIR_NAME);
    if (!directory.exists) {
      directory.create({ intermediates: true, idempotent: true });
    }
    const onDisk = new Set(directory.list().map((entry) => entry.name));

    const result: ExerciseImageFilesResult = { written: 0, failed: 0 };
    let firstError: unknown;

    const db = await openDatabase("userData.db");
    try {
      const rows = await db.getAllAsync<{
        exercise_id: number;
        image_uri: string | null;
      }>(
        `SELECT exercise_id, image_uri FROM exercises WHERE image IS NOT NULL`,
      );

      const pending = rows.filter(({ exercise_id, image_uri }) => {
        const file = new File(directory, fileNameFor(exercise_id));
        return image_uri !== file.uri || !onDisk.has(file.name);
      });

      for (let start = 0; start < pending.length; start += BATCH_SIZE) {
        const batch = pending.slice(start, start + BATCH_SIZE);
        const images = await db.getAllAsync<{
          exercise_id: number;
          image: Uint8Array;
        }>(
          `SELECT exercise_id, image FROM exercises WHERE exercise_id IN (${batch.map(() => "?").join(", ")})`,
          batch.map((row) => row.exercise_id),
        );

        const updates: { exercise_id: number; image_uri: string | null }[] = [];
        for (const { exercise_id, image } of images) {
          const file = new File(directory, fileNameFor(exercise_id));
          try {
            file.write(image);
            updates.push({ exercise_id, image_uri: file.uri });
            result.written++;
          } catch (error) {
            firstError ??= error;
            updates.push({ exercise_id, image_uri: null });
            result.failed++;
          }
        }

        await db.withExclusiveTransactionAsync(async (txn) => {
          for (const { exercise_id, image_uri } of updates) {
            await txn.runAsync(
              `UPDATE exercises SET image_uri = ? WHERE exercise_id = ?`,
              [image_uri, exercise_id],
            );
          }
        });

        // File writes are synchronous; let the UI breathe between batches.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      await db.closeAsync();
    }

    if (firstError) {
      console.error(
        `Failed to write ${result.failed} exercise image files:`,
        firstError,
      );
      notifyBugsnag(firstError);
    }
    return result;
  };

// Run on the first boot after a restore, before the job above. The restored
// database can record exactly the uris of files already on this device while
// meaning other exercises by them (exercise ids differ between installs), and
// the job would then trust those files. Clearing the uris makes it rewrite
// every file from the restored bytes. Custom photos (no image bytes) keep
// theirs.
export const forgetExerciseImageFiles = async (): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync(
      `UPDATE exercises SET image_uri = NULL WHERE image IS NOT NULL`,
    );
  } finally {
    await db.closeAsync();
  }
};
