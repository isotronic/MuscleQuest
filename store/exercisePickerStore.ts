import { create } from "zustand";
import type { Exercise } from "@/utils/database";

type ExercisePickerStore = {
  pickedExercise: Exercise | null;
  setPickedExercise: (exercise: Exercise) => void;
  clearPickedExercise: () => void;
};

export const useExercisePickerStore = create<ExercisePickerStore>((set) => ({
  pickedExercise: null,
  setPickedExercise: (exercise) => set({ pickedExercise: exercise }),
  clearPickedExercise: () => set({ pickedExercise: null }),
}));
