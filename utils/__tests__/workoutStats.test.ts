import {
  canonicalMuscle,
  computeStats,
  mergeBodyPartCounts,
  weeksInRange,
} from "@/utils/workoutStats";
import { KG_PER_LB } from "@/utils/units";

const summary = (
  volume_kg: number,
  set_count: number,
  duration: number,
  extra: { rep_count?: number; local_date?: string } = {},
) => ({
  volume_kg,
  set_count,
  duration,
  ...extra,
});

describe("computeStats", () => {
  it("totals workouts, sets, volume and time", () => {
    const stats = computeStats(
      [
        summary(1500, 12, 3600, { rep_count: 90, local_date: "2026-03-02" }),
        summary(2500, 10, 1800, { rep_count: 60, local_date: "2026-03-02" }),
        summary(500, 2, 600, { rep_count: 10, local_date: "2026-03-04" }),
      ],
      "kg",
    );

    expect(stats).toEqual({
      totalWorkouts: 3,
      totalSets: 24,
      totalReps: 160,
      trainingDays: 2,
      avgSetsPerWorkout: 8,
      totalVolumeTons: 4.5,
      totalTimeSeconds: 6000,
      avgDurationSeconds: 2000,
    });
  });

  it("reports volume in short tons for lbs", () => {
    const stats = computeStats([summary(2000 * KG_PER_LB, 1, 60)], "lbs");

    expect(stats.totalVolumeTons).toBeCloseTo(1, 6);
  });

  it("is all zeros for no workouts", () => {
    expect(computeStats([], "kg")).toEqual({
      totalWorkouts: 0,
      totalSets: 0,
      totalReps: 0,
      trainingDays: 0,
      avgSetsPerWorkout: 0,
      totalVolumeTons: 0,
      totalTimeSeconds: 0,
      avgDurationSeconds: 0,
    });
  });
});

describe("mergeBodyPartCounts", () => {
  it("folds upper and lower arms and legs together", () => {
    expect(
      mergeBodyPartCounts([
        { body_part: "upper arms", set_count: 4 },
        { body_part: "lower arms", set_count: 2 },
        { body_part: "upper legs", set_count: 5 },
        { body_part: "lower legs", set_count: 1 },
        { body_part: "chest", set_count: 7 },
      ]),
    ).toEqual({ arms: 6, legs: 6, chest: 7 });
  });

  it("drops body parts with no counted sets", () => {
    expect(mergeBodyPartCounts([{ body_part: "back", set_count: 0 }])).toEqual(
      {},
    );
  });
});

describe("canonicalMuscle", () => {
  it("files secondary muscle names under the target muscle", () => {
    expect(canonicalMuscle("Deltoids")).toBe("delts");
    expect(canonicalMuscle("latissimus dorsi")).toBe("lats");
    expect(canonicalMuscle("glutes")).toBe("glutes");
  });
});

describe("weeksInRange", () => {
  it("divides a fixed range into weeks", () => {
    expect(weeksInRange(28, null)).toBe(4);
    expect(weeksInRange(3, null)).toBe(1);
  });

  it("measures all time from the first workout", () => {
    const now = new Date(2026, 2, 28, 12);
    expect(weeksInRange(0, new Date(2026, 2, 1), now)).toBeCloseTo(28 / 7, 6);
    expect(weeksInRange(0, null, now)).toBe(1);
  });
});
