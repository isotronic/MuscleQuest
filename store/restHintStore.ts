import { create } from "zustand";

/**
 * One-line hints under the rest countdown, set when a rest's notification
 * is scheduled and shown by whichever workout screen has the rest overlay.
 * Cleared when the rest ends (see useRestHint).
 */
type RestHintStore = {
  /** Notifications are blocked, so a locked phone gets no rest alert. */
  showPermissionHint: boolean;
  /** "Alarms & reminders" is off, so the alert may arrive late. */
  showExactAlarmHint: boolean;
  showRestHints: (hints: {
    showPermissionHint: boolean;
    showExactAlarmHint: boolean;
  }) => void;
  hideExactAlarmHint: () => void;
  clearRestHints: () => void;
};

export const useRestHintStore = create<RestHintStore>((set) => ({
  showPermissionHint: false,
  showExactAlarmHint: false,
  // Only turns hints on: a later rest with nothing to say keeps a hint that
  // is already showing.
  showRestHints: ({ showPermissionHint, showExactAlarmHint }) =>
    set((state) => ({
      showPermissionHint: state.showPermissionHint || showPermissionHint,
      showExactAlarmHint: state.showExactAlarmHint || showExactAlarmHint,
    })),
  hideExactAlarmHint: () => set({ showExactAlarmHint: false }),
  clearRestHints: () =>
    set({ showPermissionHint: false, showExactAlarmHint: false }),
}));
