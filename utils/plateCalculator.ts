/**
 * Plate maths for the in-workout plate calculator.
 *
 * Everything here works in *display* units. Weights are stored in kg and
 * converted for display elsewhere in the app, but a plate set is physical:
 * a gym stocked with 20 kg plates is not stocked with 44.09 lb ones. So the
 * caller passes the inventory for the unit currently on screen and gets an
 * answer in that same unit.
 *
 * No React, no database: pure functions so the awkward cases (limited pair
 * counts, unreachable targets, fractional lb plates) are cheap to test.
 */

export interface PlateStock {
  /** Weight of a single plate, in display units. */
  weight: number;
  /** How many *pairs* of this plate are available. */
  pairs: number;
}

export interface PlateLoad {
  weight: number;
  /** Plates of this size to put on *each* side of the bar. */
  count: number;
}

export type PlateResultStatus = "exact" | "closest" | "below-bar";

export interface PlateResult {
  status: PlateResultStatus;
  /** Plates for one side of the bar, heaviest first. */
  plates: PlateLoad[];
  /** Total weight actually loaded, bar included. */
  achievedWeight: number;
  /** achievedWeight - targetWeight. Negative means short of the target. */
  difference: number;
  barWeight: number;
}

export interface PlateCalculationInput {
  targetWeight: number;
  barWeight: number;
  plates: PlateStock[];
}

export const DEFAULT_PLATE_INVENTORY_KG: PlateStock[] = [
  { weight: 25, pairs: 2 },
  { weight: 20, pairs: 2 },
  { weight: 15, pairs: 1 },
  { weight: 10, pairs: 2 },
  { weight: 5, pairs: 2 },
  { weight: 2.5, pairs: 2 },
  { weight: 1.25, pairs: 2 },
];

export const DEFAULT_PLATE_INVENTORY_LBS: PlateStock[] = [
  { weight: 45, pairs: 2 },
  { weight: 35, pairs: 1 },
  { weight: 25, pairs: 2 },
  { weight: 10, pairs: 2 },
  { weight: 5, pairs: 2 },
  { weight: 2.5, pairs: 2 },
];

export const BAR_PRESETS_KG = [25, 20, 15, 10, 7.5];
export const BAR_PRESETS_LBS = [45, 35, 25];

export const DEFAULT_BAR_WEIGHT_KG = 20;
export const DEFAULT_BAR_WEIGHT_LBS = 45;

/**
 * Guard on the search below. Real inventories reach a few hundred distinct
 * sums; anything past this is a pathological setting and falls back to greedy.
 */
const MAX_REACHABLE_SUMS = 20000;

// Plate sizes go to 1.25 kg / 2.5 lb, so hundredths are ample precision and
// keep the search on integers, away from 0.1 + 0.2 style drift.
const toInt = (value: number) => Math.round(value * 100);
const fromInt = (value: number) => value / 100;

const sortHeaviestFirst = (plates: PlateStock[]) =>
  [...plates].sort((a, b) => b.weight - a.weight);

interface Combination {
  /** Pairs used of each usable size, positionally. */
  counts: number[];
  /** Total pairs used, for the fewest-plates tie-break. */
  plateCount: number;
}

const toPlateLoads = (
  combination: Combination,
  sizes: PlateStock[],
): PlateLoad[] =>
  sizes
    .map((size, index) => ({
      weight: size.weight,
      count: combination.counts[index],
    }))
    .filter((load) => load.count > 0);

/** Heaviest-first fill. Fast, but can strand itself, so it is only the fallback. */
const greedy = (targetAddedInt: number, sizes: PlateStock[]): Combination => {
  const counts = sizes.map(() => 0);
  let plateCount = 0;
  let remaining = targetAddedInt;

  sizes.forEach((size, index) => {
    const contribution = toInt(size.weight) * 2;
    const usable = Math.min(size.pairs, Math.floor(remaining / contribution));
    if (usable > 0) {
      counts[index] = usable;
      plateCount += usable;
      remaining -= usable * contribution;
    }
  });

  return { counts, plateCount };
};

/**
 * Every total reachable from the inventory, mapped to the cheapest way to
 * reach it. A bounded knapsack rather than a greedy walk: with 25 kg x1 and
 * 20 kg x2 on the bar, greedy grabs the 25 and can no longer make 100 kg,
 * while 20 + 20 per side hits it exactly.
 */
const reachableSums = (
  targetAddedInt: number,
  sizes: PlateStock[],
): Map<number, Combination> | null => {
  const ceiling =
    targetAddedInt +
    sizes.reduce((max, size) => Math.max(max, toInt(size.weight) * 2), 0);

  let reachable = new Map<number, Combination>([
    [0, { counts: sizes.map(() => 0), plateCount: 0 }],
  ]);

  for (let index = 0; index < sizes.length; index++) {
    const contribution = toInt(sizes[index].weight) * 2;
    const next = new Map(reachable);

    for (const [sum, combination] of reachable) {
      for (let pairs = 1; pairs <= sizes[index].pairs; pairs++) {
        const candidateSum = sum + contribution * pairs;
        if (candidateSum > ceiling) break;

        const plateCount = combination.plateCount + pairs;
        const existing = next.get(candidateSum);
        if (existing && existing.plateCount <= plateCount) continue;

        const counts = [...combination.counts];
        counts[index] = combination.counts[index] + pairs;
        next.set(candidateSum, { counts, plateCount });
      }
    }

    if (next.size > MAX_REACHABLE_SUMS) return null;
    reachable = next;
  }

  return reachable;
};

/**
 * Works out which plates to hang on each side of the bar to hit `targetWeight`,
 * never using more pairs of a size than the inventory holds. When the target is
 * not loadable it returns the closest total instead, preferring the lighter of
 * two equally close options and then the one using fewest plates.
 */
export const calculatePlates = ({
  targetWeight,
  barWeight,
  plates,
}: PlateCalculationInput): PlateResult => {
  const targetInt = toInt(targetWeight);
  const barInt = toInt(barWeight);

  if (targetInt < barInt) {
    return {
      status: "below-bar",
      plates: [],
      achievedWeight: barWeight,
      difference: fromInt(barInt - targetInt),
      barWeight,
    };
  }

  const targetAddedInt = targetInt - barInt;
  const sizes = sortHeaviestFirst(
    plates.filter((plate) => plate.weight > 0 && plate.pairs > 0),
  );

  const reachable = reachableSums(targetAddedInt, sizes);

  let bestSum = 0;
  let bestCombination: Combination = sizes.length
    ? { counts: sizes.map(() => 0), plateCount: 0 }
    : { counts: [], plateCount: 0 };

  if (reachable) {
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [sum, combination] of reachable) {
      const distance = Math.abs(sum - targetAddedInt);
      const better =
        distance < bestDistance ||
        (distance === bestDistance && sum < bestSum) ||
        (distance === bestDistance &&
          sum === bestSum &&
          combination.plateCount < bestCombination.plateCount);

      if (better) {
        bestDistance = distance;
        bestSum = sum;
        bestCombination = combination;
      }
    }
  } else {
    bestCombination = greedy(targetAddedInt, sizes);
    bestSum = bestCombination.counts.reduce(
      (sum, pairs, index) => sum + pairs * toInt(sizes[index].weight) * 2,
      0,
    );
  }

  const achievedInt = barInt + bestSum;

  return {
    status: bestSum === targetAddedInt ? "exact" : "closest",
    plates: toPlateLoads(bestCombination, sizes),
    achievedWeight: fromInt(achievedInt),
    difference: fromInt(achievedInt - targetInt),
    barWeight,
  };
};

const defaultInventoryFor = (unit: string) =>
  unit === "lbs" ? DEFAULT_PLATE_INVENTORY_LBS : DEFAULT_PLATE_INVENTORY_KG;

export const defaultBarWeightFor = (unit: string) =>
  unit === "lbs" ? DEFAULT_BAR_WEIGHT_LBS : DEFAULT_BAR_WEIGHT_KG;

export const barPresetsFor = (unit: string) =>
  unit === "lbs" ? BAR_PRESETS_LBS : BAR_PRESETS_KG;

/**
 * Reads an inventory out of the settings table, where it lives as JSON.
 * A malformed or missing value falls back to a sensible set for the unit;
 * an intact value keeps only the entries that describe a usable plate, so
 * one bad row cannot cost the user the rest of their rack.
 */
export const parsePlateInventory = (
  value: string | undefined | null,
  unit: string,
): PlateStock[] => {
  if (!value) return defaultInventoryFor(unit);

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return defaultInventoryFor(unit);
  }

  if (!Array.isArray(parsed)) return defaultInventoryFor(unit);

  const plates = parsed.filter(
    (entry): entry is PlateStock =>
      !!entry &&
      typeof entry === "object" &&
      typeof (entry as PlateStock).weight === "number" &&
      typeof (entry as PlateStock).pairs === "number" &&
      Number.isFinite((entry as PlateStock).weight) &&
      Number.isInteger((entry as PlateStock).pairs) &&
      (entry as PlateStock).weight > 0 &&
      (entry as PlateStock).pairs >= 0,
  );

  return sortHeaviestFirst(
    plates.map(({ weight, pairs }) => ({ weight, pairs })),
  );
};

export const serialisePlateInventory = (plates: PlateStock[]) =>
  JSON.stringify(sortHeaviestFirst(plates));

/**
 * The smallest jump the rack can make: one pair of the lightest stocked
 * plate, one on each side. Null when nothing is stocked.
 */
export const smallestLoadStep = (plates: PlateStock[]): number | null => {
  const stocked = plates.filter((p) => p.pairs > 0).map((p) => p.weight);
  return stocked.length > 0 ? Math.min(...stocked) * 2 : null;
};
