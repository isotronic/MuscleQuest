import { buildMuscleSetsRows } from "../widgets/MuscleSetsWidget";
import { describePR } from "../widgets/RecentPRsWidget";
import { buildTile } from "../widgets/SummaryWidget";
import { computeStats } from "@/utils/workoutStats";
import type { RecentPR } from "@/utils/db/workoutStats";
import { KG_PER_LB } from "@/utils/units";

jest.mock("@lingui/core/macro", () => ({
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray, ...v: unknown[]) => ({
    id: String.raw({ raw: s }, ...v),
  }),
}));
jest.mock("@lingui/react/macro", () => ({ Trans: () => null }));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (d: any) => d.id }),
}));
jest.mock("react-native-gifted-charts", () => ({}));
jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));
jest.mock("react-native-sortables", () => ({ __esModule: true, default: {} }));

describe("buildMuscleSetsRows", () => {
  it("averages per week, sorts and places each group against the target", () => {
    const rows = buildMuscleSetsRows(
      { quads: 24, pectorals: 60, biceps: 32, calves: 0 },
      4,
      { min: 10, max: 14 },
    );
    expect(rows).toEqual([
      { key: "pectorals", perWeek: 15, zone: "above" },
      { key: "biceps", perWeek: 8 * 1, zone: "below" },
      { key: "quads", perWeek: 6, zone: "below" },
    ]);
    expect(
      buildMuscleSetsRows({ lats: 45 }, 4, { min: 10, max: 20 })[0],
    ).toEqual({ key: "lats", perWeek: 11.3, zone: "within" });
  });

  it("has no zones without a target", () => {
    expect(buildMuscleSetsRows({ lats: 10 }, 1, null)[0].zone).toBeNull();
  });
});

const pr = (overrides: Partial<RecentPR>): RecentPR => ({
  exercise_id: 1,
  name: "Bench Press",
  tracking_type: "weight",
  completed_workout_id: 1,
  local_date: "2026-03-02",
  weight: 100,
  reps: 5,
  time: null,
  distance: null,
  value: 100 * (1 + 5 / 30),
  previous: 110,
  ...overrides,
});

describe("describePR", () => {
  it("shows a weight set with its estimated 1RM gain in the user's unit", () => {
    expect(describePR(pr({}), "kg", "m")).toEqual({
      set: "100.0 kg × 5",
      gain: "Est. 1RM 116.7 kg (+6.7)",
    });
    const lbs = describePR(
      pr({
        weight: 100 * KG_PER_LB,
        value: 120 * KG_PER_LB,
        previous: 110 * KG_PER_LB,
      }),
      "lbs",
      "m",
    );
    expect(lbs.set).toBe("100.0 lbs × 5");
    expect(lbs.gain).toBe("Est. 1RM 120.0 lbs (+10.0)");
  });

  it("shows reps, time and distance records", () => {
    expect(
      describePR(
        pr({ tracking_type: "reps", value: 15, previous: 12 }),
        "kg",
        "m",
      ),
    ).toEqual({ set: "15 reps", gain: "+3" });
    expect(
      describePR(
        pr({ tracking_type: "time", value: 95, previous: 80 }),
        "kg",
        "m",
      ),
    ).toEqual({ set: "1:35", gain: "+15s" });
    expect(
      describePR(
        pr({ tracking_type: "distance", value: 1000, previous: 800 }),
        "kg",
        "ft",
      ).set,
    ).toBe("3280.84 ft");
  });
});

describe("buildTile", () => {
  const stats = (sets: number, reps: number, days: string[]) =>
    computeStats(
      days.map((local_date) => ({
        local_date,
        set_count: sets,
        rep_count: reps,
        volume_kg: 1000,
        duration: 3600,
      })),
      "kg",
    );

  it("compares a tile with the previous period", () => {
    const now = stats(10, 80, ["2026-03-02", "2026-03-02", "2026-03-04"]);
    const before = stats(12, 90, ["2026-02-02"]);
    expect(buildTile("trainingDays", now, before, "kg")).toMatchObject({
      label: "Training Days",
      value: "2",
      delta: 1,
    });
    expect(buildTile("reps", now, before, "kg")).toMatchObject({
      value: "240",
      delta: 150,
    });
    expect(buildTile("avgSets", now, before, "kg")).toMatchObject({
      value: "10",
      delta: -2,
    });
    expect(buildTile("totalTime", now, before, "kg")).toMatchObject({
      delta: 120,
      deltaText: "2h",
    });
  });

  it("has no delta without a previous period", () => {
    const now = stats(10, 80, ["2026-03-02"]);
    expect(buildTile("sets", now, null, "kg").delta).toBeNull();
  });
});
