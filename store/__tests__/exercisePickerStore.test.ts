import { act } from "@testing-library/react-native";
import { useExercisePickerStore } from "../exercisePickerStore";
import type { Exercise } from "@/utils/database";

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  exercise_id: 1,
  name: "Bench Press",
  image: [],
  local_animated_uri: "",
  animated_url: "",
  equipment: "barbell",
  body_part: "chest",
  target_muscle: "pectorals",
  secondary_muscles: [],
  description: "",
  tracking_type: "weight",
  ...overrides,
});

describe("useExercisePickerStore", () => {
  beforeEach(() => {
    useExercisePickerStore.setState({ pickedExercise: null });
  });

  it("initial state: pickedExercise is null", () => {
    expect(useExercisePickerStore.getState().pickedExercise).toBeNull();
  });

  it("setPickedExercise stores the exercise", () => {
    const exercise = makeExercise();
    act(() => {
      useExercisePickerStore.getState().setPickedExercise(exercise);
    });
    expect(useExercisePickerStore.getState().pickedExercise).toEqual(exercise);
  });

  it("clearPickedExercise resets to null", () => {
    act(() => {
      useExercisePickerStore.getState().setPickedExercise(makeExercise());
      useExercisePickerStore.getState().clearPickedExercise();
    });
    expect(useExercisePickerStore.getState().pickedExercise).toBeNull();
  });
});
