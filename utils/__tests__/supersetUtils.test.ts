import {
  validateSupersetCardinality,
  findSupersetPartnerIndex,
  classifySupersetPosition,
} from "../supersetUtils";
import type { UserExercise } from "@/store/workoutStore";

const makeEx = (id: number, supersetGroupId?: string): UserExercise =>
  ({ exercise_id: id, name: `Ex ${id}`, sets: [], supersetGroupId }) as any;

// ---------------------------------------------------------------------------
// validateSupersetCardinality
// ---------------------------------------------------------------------------

describe("validateSupersetCardinality", () => {
  it("does nothing when no exercises have a supersetGroupId", () => {
    expect(() =>
      validateSupersetCardinality([makeEx(1), makeEx(2)]),
    ).not.toThrow();
  });

  it("does not throw when each group appears exactly twice", () => {
    expect(() =>
      validateSupersetCardinality([makeEx(1, "g1"), makeEx(2, "g1")]),
    ).not.toThrow();
  });

  it("validates multiple independent groups without error", () => {
    expect(() =>
      validateSupersetCardinality([
        makeEx(1, "g1"),
        makeEx(2, "g2"),
        makeEx(3, "g1"),
        makeEx(4, "g2"),
      ]),
    ).not.toThrow();
  });

  it("throws RangeError when a group appears only once", () => {
    const exercises = [makeEx(1, "lonely"), makeEx(2)];
    expect(() => validateSupersetCardinality(exercises)).toThrow(RangeError);
    expect(() => validateSupersetCardinality(exercises)).toThrow("lonely");
  });

  it("throws RangeError when a group appears three times", () => {
    const exercises = [
      makeEx(1, "triple"),
      makeEx(2, "triple"),
      makeEx(3, "triple"),
    ];
    expect(() => validateSupersetCardinality(exercises)).toThrow(RangeError);
    expect(() => validateSupersetCardinality(exercises)).toThrow("triple");
  });

  it("throws for each offending group independently", () => {
    // g1 appears once, g2 appears twice (valid)
    const exercises = [makeEx(1, "g1"), makeEx(2, "g2"), makeEx(3, "g2")];
    expect(() => validateSupersetCardinality(exercises)).toThrow("g1");
  });
});

// ---------------------------------------------------------------------------
// findSupersetPartnerIndex
// ---------------------------------------------------------------------------

describe("findSupersetPartnerIndex", () => {
  it("returns -1 when the exercise has no supersetGroupId", () => {
    const exercises = [makeEx(1), makeEx(2)];
    expect(findSupersetPartnerIndex(exercises, 0)).toBe(-1);
  });

  it("returns the partner index for the first exercise", () => {
    const exercises = [makeEx(1, "g1"), makeEx(2, "g1")];
    expect(findSupersetPartnerIndex(exercises, 0)).toBe(1);
  });

  it("returns the partner index for the second exercise", () => {
    const exercises = [makeEx(1, "g1"), makeEx(2, "g1")];
    expect(findSupersetPartnerIndex(exercises, 1)).toBe(0);
  });

  it("finds a non-adjacent partner", () => {
    const exercises = [makeEx(1, "g1"), makeEx(2), makeEx(3, "g1")];
    expect(findSupersetPartnerIndex(exercises, 0)).toBe(2);
    expect(findSupersetPartnerIndex(exercises, 2)).toBe(0);
  });

  it("returns -1 for an out-of-bounds index", () => {
    const exercises = [makeEx(1, "g1"), makeEx(2, "g1")];
    expect(findSupersetPartnerIndex(exercises, 99)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// classifySupersetPosition
// ---------------------------------------------------------------------------

describe("classifySupersetPosition", () => {
  it("returns isInSuperset=false for a standalone exercise", () => {
    const result = classifySupersetPosition([makeEx(1), makeEx(2)], 0);
    expect(result.isInSuperset).toBe(false);
    expect(result.partnerIndex).toBe(-1);
    expect(result.isFirstInSuperset).toBe(false);
    expect(result.isSecondInSuperset).toBe(false);
  });

  it("marks the lower-index exercise as first in superset", () => {
    const exercises = [makeEx(1, "g1"), makeEx(2, "g1")];
    const result = classifySupersetPosition(exercises, 0);
    expect(result.isInSuperset).toBe(true);
    expect(result.partnerIndex).toBe(1);
    expect(result.isFirstInSuperset).toBe(true);
    expect(result.isSecondInSuperset).toBe(false);
  });

  it("marks the higher-index exercise as second in superset", () => {
    const exercises = [makeEx(1, "g1"), makeEx(2, "g1")];
    const result = classifySupersetPosition(exercises, 1);
    expect(result.isInSuperset).toBe(true);
    expect(result.partnerIndex).toBe(0);
    expect(result.isFirstInSuperset).toBe(false);
    expect(result.isSecondInSuperset).toBe(true);
  });
});
