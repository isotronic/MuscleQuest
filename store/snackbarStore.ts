import { create } from "zustand";

export interface SnackbarOptions {
  action?: { label: string; onPress: () => void };
  /** Milliseconds on screen; defaults to 4 s. */
  duration?: number;
  /**
   * Runs exactly once when the snackbar goes away: `true` if its action was
   * pressed, `false` for a timeout, swipe or replacement by another snackbar.
   * Undo flows commit their delete here.
   */
  onClose?: (actionTaken: boolean) => void;
}

interface SnackbarEntry extends SnackbarOptions {
  id: number;
  message: string;
}

interface SnackbarStore {
  current: SnackbarEntry | null;
  show: (message: string, options?: SnackbarOptions) => void;
  pressAction: () => void;
  dismiss: () => void;
}

let nextId = 1;

export const useSnackbarStore = create<SnackbarStore>((set, get) => {
  const close = (actionTaken: boolean) => {
    const entry = get().current;
    if (!entry) return;
    set({ current: null });
    if (actionTaken) entry.action?.onPress();
    entry.onClose?.(actionTaken);
  };

  return {
    current: null,
    show: (message, options = {}) => {
      close(false);
      set({ current: { id: nextId++, message, ...options } });
    },
    pressAction: () => close(true),
    dismiss: () => close(false),
  };
});

/** Non-blocking feedback for non-destructive outcomes. Usable outside React. */
export const showSnackbar = (message: string, options?: SnackbarOptions) =>
  useSnackbarStore.getState().show(message, options);
