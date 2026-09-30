import { create } from "zustand";

interface StaleWorkoutPromptStore {
  visible: boolean;
  show: () => void;
  hide: () => void;
}

/** Drives StaleWorkoutPrompt, which is mounted once in the app layout. */
export const useStaleWorkoutPromptStore = create<StaleWorkoutPromptStore>(
  (set) => ({
    visible: false,
    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
  }),
);
