import { Directory, File, Paths } from "expo-file-system";
import Bugsnag from "@bugsnag/expo";

// Journals the file swap at the end of a restore so it can be undone even if
// the app is killed partway through, or a rollback move fails.
//
// The live database files are moved aside into restore-rollback/ in the
// documents folder, which the OS never purges. The folder goes through three
// states:
//
// 1. Swapping: swap-in-progress.json lists which live files existed. It is
//    written before anything moves, so at startup it means the swap never
//    finished and the originals must be put back before any database is
//    opened.
// 2. Awaiting first boot: the swap finished. awaiting-first-boot.json replaces
//    the swap marker and the originals are kept, so a restored database that
//    fails to start can be undone from the startup recovery screen.
// 3. Confirmed: startup succeeded and the folder is deleted.

const LIVE_FILE_NAMES = ["userData.db", "userData.db-wal", "userData.db-shm"];
const MARKER_NAME = "swap-in-progress.json";
const AWAITING_MARKER_NAME = "awaiting-first-boot.json";
// Below this, the originals are not kept after the swap: the old database
// would otherwise sit on disk twice until the next boot.
const MIN_FREE_BYTES_TO_KEEP_ORIGINALS = 100 * 1024 * 1024;

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
    // Left over from a completed swap whose cleanup failed, or an earlier
    // restore awaiting its first boot: the app is running, so it booted.
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

  // Replacing the swap marker commits the swap. The awaiting marker is
  // written first: killed between the two, startup undoes the swap rather
  // than losing the originals.
  if (hasSpaceToKeepOriginals()) {
    new File(dir, AWAITING_MARKER_NAME).write(JSON.stringify(marker));
    new File(dir, MARKER_NAME).delete();
  } else {
    Bugsnag.leaveBreadcrumb("Restore: low free space, originals not kept");
    new File(dir, MARKER_NAME).delete();
    deleteQuietly(dir);
  }
};

const hasSpaceToKeepOriginals = (): boolean => {
  try {
    const free = Paths.availableDiskSpace;
    // Unknown free space keeps the originals; they already fit before the swap.
    return typeof free !== "number" || free >= MIN_FREE_BYTES_TO_KEEP_ORIGINALS;
  } catch {
    return true;
  }
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

const readMarker = (markerFile: File): SwapMarker | null => {
  try {
    const parsed = JSON.parse(markerFile.textSync());
    if (parsed && Array.isArray(parsed.originals)) {
      return {
        originals: parsed.originals.filter(
          (name: unknown): name is string => typeof name === "string",
        ),
      };
    }
  } catch {
    // Handled by the caller as unreadable.
  }
  return null;
};

// Runs at startup before any database is opened. Returns true if an
// unfinished restore swap was undone. Throws if it could not be, so startup
// fails instead of opening (and creating) an empty database. A finished swap
// awaiting its first boot is left alone, so startup tries the restored file.
export const recoverInterruptedRestore = (): boolean => {
  const dir = rollbackDirectory();
  if (!dir.exists) {
    return false;
  }
  const markerFile = new File(dir, MARKER_NAME);
  if (!markerFile.exists) {
    if (!new File(dir, AWAITING_MARKER_NAME).exists) {
      deleteQuietly(dir);
    }
    return false;
  }

  const marker = readMarker(markerFile);
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

// Whether the last restore is awaiting its first boot and can still be undone.
export const hasRestoreToUndo = (): boolean => {
  const dir = rollbackDirectory();
  return (
    dir.exists &&
    new File(dir, AWAITING_MARKER_NAME).exists &&
    !new File(dir, MARKER_NAME).exists
  );
};

// Called once startup has succeeded: the restored database works, so the
// originals are no longer needed. An interrupted swap's copies are kept.
export const confirmRestoredDatabase = () => {
  const dir = rollbackDirectory();
  if (dir.exists && !new File(dir, MARKER_NAME).exists) {
    deleteQuietly(dir);
  }
};

// Puts back the database from before the last restore, if it is still kept.
// Returns false when there is nothing to undo. Throws if a file could not be
// put back, leaving a swap marker and the remaining copies for startup to
// finish.
export const undoLastRestore = (): boolean => {
  if (!hasRestoreToUndo()) {
    return false;
  }
  const dir = rollbackDirectory();
  const awaitingFile = new File(dir, AWAITING_MARKER_NAME);
  const marker = readMarker(awaitingFile);
  if (!marker) {
    return false;
  }
  // Journaled like the swap itself: from here the folder is an interrupted
  // swap, so a kill or failed move is finished by startup recovery before
  // any database opens, never booting the original DB beside a restored WAL.
  new File(dir, MARKER_NAME).write(JSON.stringify(marker));
  awaitingFile.delete();
  undoSwap(dir, marker);
  Bugsnag.leaveBreadcrumb("Undid the last restore");
  return true;
};
