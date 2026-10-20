import {
  buildExerciseSearchIndex,
  searchExercises,
} from "@/utils/exerciseSearch";
import { FITNESS_ALIAS_MAP } from "@/utils/exerciseSearchAliases";
import type { Exercise } from "@/utils/database";

const exercise = (exercise_id: number, name: string): Exercise => ({
  exercise_id,
  name,
  image: [],
  local_animated_uri: "",
  animated_url: "",
  equipment: "barbell",
  body_part: "upper legs",
  target_muscle: "glutes",
  secondary_muscles: [],
  description: "",
});

describe("FITNESS_ALIAS_MAP", () => {
  // "Barbell Lying Lifting (On Hip)" became "Barbell Hip Thrust", which has
  // no "glute" in its name; the hip thrust / glute bridge aliases cover it.
  it("finds hip thrusts when searching for glutes", () => {
    const index = buildExerciseSearchIndex(
      {
        otherExercises: [
          exercise(1, "Barbell Hip Thrust"),
          exercise(2, "Barbell Glute Bridge"),
          exercise(3, "Barbell Curl"),
        ],
      },
      FITNESS_ALIAS_MAP,
    );

    const found = searchExercises(index, "glutes", {
      equipment: null,
      bodyPart: null,
      targetMuscle: null,
    }).otherExercises.map((r) => r.exercise.name);

    expect(found).toEqual(
      expect.arrayContaining(["Barbell Hip Thrust", "Barbell Glute Bridge"]),
    );
    expect(found).not.toContain("Barbell Curl");
  });
});
