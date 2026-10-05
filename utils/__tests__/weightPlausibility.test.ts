import {
  checkWeightPlausibility,
  heaviestWorkingWeight,
} from "../weightPlausibility";
import type { CarryOverExercise } from "../carryOverLookup";

const set = (weight: number | null, is_warmup = false) => ({
  set_id: 1,
  set_number: 1,
  weight,
  reps: 5,
  time: null,
  distance: null,
  is_warmup,
});

describe("heaviestWorkingWeight", () => {
  it("takes the heaviest working set across every session", () => {
    const history: CarryOverExercise[] = [
      { exercise_id: 7, sets: [set(60), set(62.5)] },
      { exercise_id: 7, sets: [set(65), set(100, true)] },
    ];
    expect(heaviestWorkingWeight(history)).toBe(65);
  });

  it("is null without any weighted working set", () => {
    expect(heaviestWorkingWeight(undefined)).toBeNull();
    expect(
      heaviestWorkingWeight([
        { exercise_id: 7, sets: [set(null), set(0), set(80, true)] },
      ]),
    ).toBeNull();
  });
});

describe("checkWeightPlausibility", () => {
  it("offers a tenth of the weight when a comma was dropped", () => {
    expect(
      checkWeightPlausibility({ weight: 625, reference: 65, weightUnit: "kg" }),
    ).toEqual({ implausible: true, suggestion: 62.5 });
  });

  it("does not ask about a normal increase", () => {
    expect(
      checkWeightPlausibility({ weight: 70, reference: 65, weightUnit: "kg" }),
    ).toEqual({ implausible: false });
  });

  it("asks without a suggestion when a tenth is also far off", () => {
    expect(
      checkWeightPlausibility({ weight: 200, reference: 60, weightUnit: "kg" }),
    ).toEqual({ implausible: true, suggestion: null });
  });

  it("allows exactly 1.5x the reference", () => {
    expect(
      checkWeightPlausibility({ weight: 90, reference: 60, weightUnit: "kg" })
        .implausible,
    ).toBe(false);
  });

  it("uses a fixed ceiling per unit without history", () => {
    const check = (weight: number, weightUnit: string) =>
      checkWeightPlausibility({ weight, reference: null, weightUnit })
        .implausible;
    expect(check(300, "kg")).toBe(false);
    expect(check(301, "kg")).toBe(true);
    expect(check(660, "lbs")).toBe(false);
    expect(check(661, "lbs")).toBe(true);
  });

  it("offers no suggestion without history", () => {
    expect(
      checkWeightPlausibility({
        weight: 625,
        reference: null,
        weightUnit: "kg",
      }),
    ).toEqual({ implausible: true, suggestion: null });
  });

  it("ignores empty and zero weights", () => {
    expect(
      checkWeightPlausibility({ weight: 0, reference: 65, weightUnit: "kg" })
        .implausible,
    ).toBe(false);
    expect(
      checkWeightPlausibility({ weight: NaN, reference: 65, weightUnit: "kg" })
        .implausible,
    ).toBe(false);
  });
});
