import {
  calculatePlates,
  DEFAULT_PLATE_INVENTORY_KG,
  DEFAULT_PLATE_INVENTORY_LBS,
  BAR_PRESETS_KG,
  BAR_PRESETS_LBS,
  parsePlateInventory,
  serialisePlateInventory,
  type PlateStock,
} from "../plateCalculator";

const stock = (entries: [number, number][]): PlateStock[] =>
  entries.map(([weight, pairs]) => ({ weight, pairs }));

describe("calculatePlates", () => {
  describe("exact loads", () => {
    it("loads an empty bar when the target equals the bar weight", () => {
      const result = calculatePlates({
        targetWeight: 20,
        barWeight: 20,
        plates: DEFAULT_PLATE_INVENTORY_KG,
      });

      expect(result.status).toBe("exact");
      expect(result.plates).toEqual([]);
      expect(result.achievedWeight).toBe(20);
      expect(result.difference).toBe(0);
    });

    it("finds an exact single-pair load", () => {
      const result = calculatePlates({
        targetWeight: 60,
        barWeight: 20,
        plates: DEFAULT_PLATE_INVENTORY_KG,
      });

      expect(result.status).toBe("exact");
      expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
      expect(result.achievedWeight).toBe(60);
    });

    it("finds an exact multi-plate load, heaviest first", () => {
      const result = calculatePlates({
        targetWeight: 102.5,
        barWeight: 20,
        plates: DEFAULT_PLATE_INVENTORY_KG,
      });

      expect(result.status).toBe("exact");
      expect(result.plates).toEqual([
        { weight: 20, count: 2 },
        { weight: 1.25, count: 1 },
      ]);
      expect(result.achievedWeight).toBe(102.5);
    });

    it("handles fractional lbs plates without float drift", () => {
      const result = calculatePlates({
        targetWeight: 140,
        barWeight: 45,
        plates: DEFAULT_PLATE_INVENTORY_LBS,
      });

      expect(result.status).toBe("exact");
      expect(result.achievedWeight).toBe(140);
      expect(
        result.plates.reduce((sum, p) => sum + p.weight * p.count * 2, 45),
      ).toBe(140);
    });
  });

  describe("limited pair counts", () => {
    it("never uses more pairs than are available", () => {
      const result = calculatePlates({
        targetWeight: 100,
        barWeight: 20,
        plates: stock([[20, 1]]),
      });

      expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
      expect(result.achievedWeight).toBe(60);
      expect(result.status).toBe("closest");
    });

    it("avoids the greedy trap where the heaviest plate strands the search", () => {
      // Greedy takes the single 25 and cannot reach 40 per side.
      // 20 + 20 is exact and must be preferred.
      const result = calculatePlates({
        targetWeight: 100,
        barWeight: 20,
        plates: stock([
          [25, 1],
          [20, 2],
        ]),
      });

      expect(result.status).toBe("exact");
      expect(result.plates).toEqual([{ weight: 20, count: 2 }]);
      expect(result.achievedWeight).toBe(100);
    });

    it("ignores plate sizes with no pairs available", () => {
      const result = calculatePlates({
        targetWeight: 70,
        barWeight: 20,
        plates: stock([
          [25, 0],
          [10, 2],
        ]),
      });

      expect(result.plates).toEqual([{ weight: 10, count: 2 }]);
      expect(result.achievedWeight).toBe(60);
    });
  });

  describe("inexact loads", () => {
    it("reports the closest achievable weight and the shortfall", () => {
      const result = calculatePlates({
        targetWeight: 101,
        barWeight: 20,
        plates: DEFAULT_PLATE_INVENTORY_KG,
      });

      expect(result.status).toBe("closest");
      expect(result.achievedWeight).toBe(100);
      expect(result.difference).toBe(-1);
    });

    it("prefers the lower load when two are equally close", () => {
      // Per side the reachable sums are 0 and 5; target per side is 2.5.
      const result = calculatePlates({
        targetWeight: 25,
        barWeight: 20,
        plates: stock([[5, 1]]),
      });

      expect(result.achievedWeight).toBe(20);
      expect(result.difference).toBe(-5);
    });

    it("goes over the target when that is strictly closer", () => {
      // Reachable totals are 20 and 60; 60 overshoots by 1, 20 undershoots by 39.
      const result = calculatePlates({
        targetWeight: 59,
        barWeight: 20,
        plates: stock([[20, 1]]),
      });

      expect(result.status).toBe("closest");
      expect(result.achievedWeight).toBe(60);
      expect(result.difference).toBe(1);
    });

    it("uses the fewest plates among equally close loads", () => {
      const result = calculatePlates({
        targetWeight: 60,
        barWeight: 20,
        plates: stock([
          [20, 2],
          [10, 2],
        ]),
      });

      expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
    });
  });

  describe("targets the bar cannot reach", () => {
    it("flags a target below the bar weight", () => {
      const result = calculatePlates({
        targetWeight: 15,
        barWeight: 20,
        plates: DEFAULT_PLATE_INVENTORY_KG,
      });

      expect(result.status).toBe("below-bar");
      expect(result.plates).toEqual([]);
      expect(result.achievedWeight).toBe(20);
      expect(result.difference).toBe(5);
    });

    it("treats a target equal to the bar as exact, not below-bar", () => {
      expect(
        calculatePlates({
          targetWeight: 20,
          barWeight: 20,
          plates: DEFAULT_PLATE_INVENTORY_KG,
        }).status,
      ).toBe("exact");
    });

    it("returns an empty inventory as the bare bar", () => {
      const result = calculatePlates({
        targetWeight: 100,
        barWeight: 20,
        plates: [],
      });

      expect(result.status).toBe("closest");
      expect(result.plates).toEqual([]);
      expect(result.achievedWeight).toBe(20);
    });
  });

  it("keeps the bar weight on the result", () => {
    expect(
      calculatePlates({
        targetWeight: 100,
        barWeight: 15,
        plates: DEFAULT_PLATE_INVENTORY_KG,
      }).barWeight,
    ).toBe(15);
  });
});

describe("parsePlateInventory", () => {
  it("round-trips a serialised inventory", () => {
    const inventory = stock([
      [25, 2],
      [10, 4],
    ]);

    expect(
      parsePlateInventory(serialisePlateInventory(inventory), "kg"),
    ).toEqual(inventory);
  });

  it("sorts entries heaviest first", () => {
    expect(
      parsePlateInventory(
        '[{"weight":10,"pairs":2},{"weight":25,"pairs":1}]',
        "kg",
      ),
    ).toEqual(
      stock([
        [25, 1],
        [10, 2],
      ]),
    );
  });

  it("falls back to the unit default for malformed JSON", () => {
    expect(parsePlateInventory("not json", "kg")).toEqual(
      DEFAULT_PLATE_INVENTORY_KG,
    );
    expect(parsePlateInventory("not json", "lbs")).toEqual(
      DEFAULT_PLATE_INVENTORY_LBS,
    );
  });

  it("falls back to the unit default for a missing value", () => {
    expect(parsePlateInventory(undefined, "lbs")).toEqual(
      DEFAULT_PLATE_INVENTORY_LBS,
    );
  });

  it("drops entries that are not usable plates", () => {
    expect(
      parsePlateInventory(
        '[{"weight":25,"pairs":2},{"weight":0,"pairs":2},{"weight":5,"pairs":-1},{"weight":10,"pairs":1.5},{"weight":2.5,"pairs":0},{"pairs":2}]',
        "kg",
      ),
    ).toEqual(
      stock([
        [25, 2],
        [2.5, 0],
      ]),
    );
  });
});

describe("defaults", () => {
  it("orders both default inventories heaviest first", () => {
    for (const inventory of [
      DEFAULT_PLATE_INVENTORY_KG,
      DEFAULT_PLATE_INVENTORY_LBS,
    ]) {
      const weights = inventory.map((p) => p.weight);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
    }
  });

  it("offers bar presets for both units", () => {
    expect(BAR_PRESETS_KG).toEqual([25, 20, 15, 10, 7.5]);
    expect(BAR_PRESETS_LBS).toEqual([45, 35, 25]);
  });
});
