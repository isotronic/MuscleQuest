import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface HomeUiStore {
  /** Whether home's "Other workouts" list is open; closed by default. */
  otherWorkoutsOpen: boolean;
  toggleOtherWorkouts: () => void;
}

export const useHomeUiStore = create<HomeUiStore>()(
  persist(
    (set) => ({
      otherWorkoutsOpen: false,
      toggleOtherWorkouts: () =>
        set((state) => ({ otherWorkoutsOpen: !state.otherWorkoutsOpen })),
    }),
    {
      name: "home-ui-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ otherWorkoutsOpen: state.otherWorkoutsOpen }),
    },
  ),
);
