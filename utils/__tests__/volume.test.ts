import { setVolume, workoutVolume, type VolumeOptions } from "@/utils/volume";

const OFF: VolumeOptions = {
  excludeWarmup: false,
  countUnilateralDouble: false,
  doubleWeightForPaired: false,
  includeBodyWeight: false,
};
const ON: VolumeOptions = { ...OFF, includeBodyWeight: true };

const exercise = (
  tracking_type: string,
  extra: Partial<{
    base_tracking_type: string | null;
    is_unilateral: number;
    double_weight: number;
  }> = {},
) => ({ tracking_type, ...extra });

const set = (
  weight: number | null,
  reps: number | null,
  is_warmup = false,
) => ({
  weight,
  reps,
  is_warmup,
});

describe("setVolume", () => {
  it("counts weight x reps for weight sets", () => {
    expect(setVolume(set(100, 5), exercise("weight"), OFF, 80)).toBe(500);
    expect(setVolume(set(100, 5), exercise("weight"), ON, 80)).toBe(500);
  });

  it("scores unknown and missing tracking types as weight", () => {
    expect(setVolume(set(10, 3), exercise(""), OFF, null)).toBe(30);
  });

  it("applies the paired and unilateral multipliers to weight sets", () => {
    const both = {
      ...OFF,
      doubleWeightForPaired: true,
      countUnilateralDouble: true,
    };
    expect(
      setVolume(
        set(20, 10),
        exercise("weight", { double_weight: 1, is_unilateral: 1 }),
        both,
        null,
      ),
    ).toBe(800);
    expect(
      setVolume(
        set(20, 10),
        exercise("weight", { double_weight: 1, is_unilateral: 1 }),
        OFF,
        null,
      ),
    ).toBe(200);
  });

  it("counts assisted sets as (body weight - assistance) x reps, setting on or off", () => {
    expect(setVolume(set(20, 8), exercise("assisted"), OFF, 80)).toBe(480);
    expect(setVolume(set(20, 8), exercise("assisted"), ON, 80)).toBe(480);
  });

  it("never doubles the assistance of a paired exercise", () => {
    const opts = { ...OFF, doubleWeightForPaired: true };
    expect(
      setVolume(
        set(20, 8),
        exercise("assisted", { double_weight: 1 }),
        opts,
        80,
      ),
    ).toBe(480);
  });

  it("doubles assisted reps for unilateral exercises when set to", () => {
    const opts = { ...OFF, countUnilateralDouble: true };
    expect(
      setVolume(
        set(20, 8),
        exercise("assisted", { is_unilateral: 1 }),
        opts,
        80,
      ),
    ).toBe(960);
  });

  it("gives more volume for less assistance", () => {
    const at40 = setVolume(set(40, 8), exercise("assisted"), OFF, 80);
    const at20 = setVolume(set(20, 8), exercise("assisted"), OFF, 80);
    expect(at20).toBeGreaterThan(at40);
  });

  it("never goes below zero when the assistance exceeds body weight", () => {
    expect(setVolume(set(90, 8), exercise("assisted"), OFF, 80)).toBe(0);
  });

  it("counts assisted sets as zero without a body weight", () => {
    expect(setVolume(set(20, 8), exercise("assisted"), OFF, null)).toBe(0);
    expect(setVolume(set(20, 8), exercise("assisted"), OFF, 0)).toBe(0);
  });

  it("counts reps sets only when body weight is included", () => {
    expect(setVolume(set(null, 10), exercise("reps"), OFF, 80)).toBe(0);
    expect(setVolume(set(null, 10), exercise("reps"), ON, 80)).toBe(800);
  });

  it("counts reps sets as zero without a body weight, never a default", () => {
    expect(setVolume(set(null, 10), exercise("reps"), ON, null)).toBe(0);
  });

  it("doubles unilateral reps for bodyweight sets when set to", () => {
    const opts = { ...ON, countUnilateralDouble: true };
    expect(
      setVolume(
        set(null, 10),
        exercise("reps", { is_unilateral: 1 }),
        opts,
        80,
      ),
    ).toBe(1600);
  });

  it("counts weighted bodyweight sets as the added weight when the setting is off", () => {
    const weighted = exercise("weight", { base_tracking_type: "reps" });
    expect(setVolume(set(10, 8), weighted, OFF, 80)).toBe(80);
  });

  it("adds body weight to weighted bodyweight sets when the setting is on", () => {
    const weighted = exercise("weight", { base_tracking_type: "reps" });
    expect(setVolume(set(10, 8), weighted, ON, 80)).toBe(720);
  });

  it("counts weighted bodyweight sets as the added weight without a body weight", () => {
    const weighted = exercise("weight", { base_tracking_type: "reps" });
    expect(setVolume(set(10, 8), weighted, ON, null)).toBe(80);
  });

  it("counts time and distance sets as zero", () => {
    expect(setVolume(set(10, 8), exercise("time"), ON, 80)).toBe(0);
    expect(setVolume(set(10, 8), exercise("distance"), ON, 80)).toBe(0);
  });

  it("counts sets with no reps as zero", () => {
    expect(setVolume(set(100, null), exercise("weight"), ON, 80)).toBe(0);
    expect(setVolume(set(null, null), exercise("reps"), ON, 80)).toBe(0);
  });

  it("leaves out warm-ups when set to", () => {
    const opts = { ...OFF, excludeWarmup: true };
    expect(setVolume(set(100, 5, true), exercise("weight"), opts, null)).toBe(
      0,
    );
    expect(setVolume(set(100, 5, true), exercise("weight"), OFF, null)).toBe(
      500,
    );
  });
});

describe("workoutVolume", () => {
  it("sums every set of every exercise", () => {
    const workout = {
      exercises: [
        { exercise_tracking_type: "weight", sets: [set(100, 5), set(100, 5)] },
        { exercise_tracking_type: "assisted", sets: [set(20, 8)] },
        { exercise_tracking_type: "reps", sets: [set(null, 10)] },
      ],
    };
    expect(workoutVolume(workout, OFF, 80)).toBe(1000 + 480);
    expect(workoutVolume(workout, ON, 80)).toBe(1000 + 480 + 800);
  });
});
