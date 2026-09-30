import { computeStats, mergeBodyPartCounts } from "@/utils/workoutStats";
import { KG_PER_LB } from "@/utils/units";

const summary = (volume_kg: number, set_count: number, duration: number) => ({
  volume_kg,
  set_count,
  duration,
});

describe("computeStats", () => {
  it("totals workouts, sets, volume and time", () => {
    const stats = computeStats(
      [summary(1500, 12, 3600), summary(2500, 10, 1800)],
      "kg",
    );

    expect(stats).toEqual({
      totalWorkouts: 2,
      totalSets: 22,
      totalVolumeTons: 4,
      totalTimeSeconds: 5400,
      avgDurationSeconds: 2700,
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
