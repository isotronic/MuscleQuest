import { create } from "zustand";

/**
 * Entries the user deleted whose hard delete waits for the Undo snackbar to
 * close. Queries leave these ids out so the entry disappears at once; if the
 * app is killed before the delete runs, the entry simply survives.
 * Not persisted.
 */
interface PendingDeleteStore {
  measurementEntryIds: number[];
  hideMeasurement: (id: number) => void;
  unhideMeasurement: (id: number) => void;
}

export const usePendingDeleteStore = create<PendingDeleteStore>((set) => ({
  measurementEntryIds: [],
  hideMeasurement: (id) =>
    set((s) => ({ measurementEntryIds: [...s.measurementEntryIds, id] })),
  unhideMeasurement: (id) =>
    set((s) => ({
      measurementEntryIds: s.measurementEntryIds.filter((x) => x !== id),
    })),
}));
