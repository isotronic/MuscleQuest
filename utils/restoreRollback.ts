import { Directory, File, Paths } from "expo-file-system";
import Bugsnag from "@bugsnag/expo";

// Journals the file swap at the end of a restore so it can be undone even if
// the app is killed partway through, or a rollback move fails.
//
// The live database files are moved aside into restore-rollback/ in the
// documents folder, which the OS never purges. A marker listing which live
// files existed is written before anything moves and removed only once the
// swap completes, so at startup a marker means the swap never finished and
// the originals must be put back before any database is opened.

const LIVE_FILE_NAMES = ["userData.db", "userData.db-wal", "userData.db-shm"];
const MARKER_NAME = "swap-in-progress.json";

interface SwapMarker {
  originals: string[];
}

const liveFile = (name: string) => new File(Paths.document, "SQLite", name);
const rollbackDirectory = () =>
  new Directory(Paths.document, "restore-rollback");
const rollbackFile = (dir: Directory, name: string) =>
  new File(dir, `rollback-${name}`);

// Replaces the live database files with `staged`. On any failure the
// originals are put back and the original error is rethrown. If putting them
// back fails too, the marker and rollback copies stay for startup to retry.
export const swapInRestoredFiles = (
  staged: { stagedFile: File; name: string }[],
) => {
  const dir = rollbackDirectory();
  if (dir.exists) {
    if (new File(dir, MARKER_NAME).exists) {
      throw new Error(
        "An earlier restore could not be undone. Restart the app and try again.",
      );
    }
    // Left over from a completed swap whose cleanup failed.
    dir.delete();
  }
  dir.create({ intermediates: true });

  const marker: SwapMarker = {
    originals: LIVE_FILE_NAMES.filter((name) => liveFile(name).exists),
  };
  new File(dir, MARKER_NAME).write(JSON.stringify(marker));

  try {
    // Every live file is replaced, including a WAL/SHM with no staged
    // counterpart: a leftover local WAL would otherwise be applied to the
    // restored .db.
    for (const name of marker.originals) {
      liveFile(name).move(rollbackFile(dir, name));
    }
    for (const { stagedFile, name } of staged) {
      stagedFile.move(liveFile(name));
    }
  } catch (error) {
    try {
      undoSwap(dir, marker);
    } catch (undoError) {
      console.error("Failed to undo the restore swap:", undoError);
      Bugsnag.notify(
        undoError instanceof Error ? undoError : new Error(String(undoError)),
      );
    }
    throw error;
  }

  // Removing the marker commits the swap. The rollback copies are only
  // needed until then.
  new File(dir, MARKER_NAME).delete();
  deleteQuietly(dir);
};

// Puts the original live files back. Every file is attempted even if an
// earlier one fails; the first failure is thrown at the end, leaving the
// marker and rollback copies in place for another attempt.
const undoSwap = (dir: Directory, marker: SwapMarker) => {
  let firstError: unknown = null;

  for (const name of LIVE_FILE_NAMES) {
    try {
      const saved = rollbackFile(dir, name);
      const wasOriginal = marker.originals.includes(name);
      // An original without a rollback copy was never moved, so the live file
      // is still the original. Anything else at the live path came from the
      // backup and must go.
      if (wasOriginal && !saved.exists) {
        continue;
      }
      const current = liveFile(name);
      if (current.exists) {
        current.delete();
      }
      if (wasOriginal) {
        saved.move(liveFile(name));
      }
    } catch (error) {
      console.error(`Failed to put back ${name}:`, error);
      firstError ??= error;
    }
  }

  if (firstError) {
    throw firstError;
  }
  new File(dir, MARKER_NAME).delete();
  deleteQuietly(dir);
};

const deleteQuietly = (dir: Directory) => {
  try {
    if (dir.exists) {
      dir.delete();
    }
  } catch (error) {
    // Harmless: without a marker, startup only removes the folder.
    console.warn("Failed to remove the restore rollback folder:", error);
  }
};

// Runs at startup before any database is opened. Returns true if an
// unfinished restore swap was undone. Throws if it could not be, so startup
// fails instead of opening (and creating) an empty database.
export const recoverInterruptedRestore = (): boolean => {
  const dir = rollbackDirectory();
  if (!dir.exists) {
    return false;
  }
  const markerFile = new File(dir, MARKER_NAME);
  if (!markerFile.exists) {
    deleteQuietly(dir);
    return false;
  }

  let marker: SwapMarker | null = null;
  try {
    const parsed = JSON.parse(markerFile.textSync());
    if (parsed && Array.isArray(parsed.originals)) {
      marker = {
        originals: parsed.originals.filter(
          (name: unknown): name is string => typeof name === "string",
        ),
      };
    }
  } catch {
    // Handled below as unreadable.
  }
  if (!marker) {
    // The marker is written before any file moves, so an unreadable or
    // malformed one means the app stopped while writing it and nothing was
    // moved.
    deleteQuietly(dir);
    return false;
  }
  undoSwap(dir, marker);
  Bugsnag.notify(new Error("Undid an interrupted restore at startup"));
  return true;
};
