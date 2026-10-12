import { setupChanges, type SetupValues } from "../setupChanges";

const initial: SetupValues = {
  units: "metric",
  weightIncrement: "1",
  weeklyGoal: "3",
  weekStartsOn: 1,
  bodyWeight: "",
};

describe("setupChanges", () => {
  it("writes nothing when confirmed unchanged", () => {
    expect(setupChanges(initial, { ...initial })).toEqual({ settings: [] });
  });

  it("writes all three units when the system changes", () => {
    const write = setupChanges(initial, {
      ...initial,
      units: "imperial",
      weightIncrement: "5",
    });
    expect(write.settings).toEqual([
      { key: "weightUnit", value: "lbs" },
      { key: "distanceUnit", value: "ft" },
      { key: "sizeUnit", value: "in" },
      { key: "weightIncrement", value: "5" },
    ]);
  });

  it("passes a week start change and goal through", () => {
    const write = setupChanges(initial, {
      ...initial,
      weeklyGoal: "4",
      weekStartsOn: 0,
    });
    expect(write.settings).toEqual([{ key: "weeklyGoal", value: "4" }]);
    expect(write.weekStartsOn).toBe(0);
  });

  it("converts an entered body weight to kg in the chosen unit", () => {
    const write = setupChanges(initial, {
      ...initial,
      units: "imperial",
      bodyWeight: "180",
    });
    expect(write.bodyWeightKg).toBeCloseTo(81.647, 3);
  });

  it("leaves body weight alone when skipped or not a weight", () => {
    expect(setupChanges(initial, initial).bodyWeightKg).toBeUndefined();
    expect(
      setupChanges(initial, { ...initial, bodyWeight: "0" }).bodyWeightKg,
    ).toBeUndefined();
  });
});
