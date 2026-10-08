import { buildHeatmap, heatmapStart } from "../heatmap";

const day = (local_date: string, set_count = 10, volume_kg = 1000) => ({
  local_date,
  set_count,
  volume_kg,
});

// Wednesday 2026-03-25, local noon.
const TODAY = new Date(2026, 2, 25, 12);

describe("buildHeatmap", () => {
  it("lays out Monday-first weeks up to the end of this week", () => {
    const { weeks } = buildHeatmap([], new Date(2026, 2, 10), TODAY, "sets");
    expect(weeks[0][0].key).toBe("2026-03-09");
    expect(weeks[weeks.length - 1][6].key).toBe("2026-03-29");
    expect(weeks).toHaveLength(3);
    expect(
      weeks
        .flat()
        .filter((d) => d.future)
        .map((d) => d.key),
    ).toEqual(["2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"]);
  });

  it("keeps every local day once across a daylight saving change", () => {
    const { weeks } = buildHeatmap(
      [],
      new Date(2026, 0, 1),
      new Date(2026, 11, 31, 12),
      "presence",
    );
    const keys = weeks.flat().map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("2026-03-29");
    expect(keys).toContain("2026-10-25");
    expect(keys).toContain("2026-04-05");
  });

  it("shades days in quarters of the busiest day", () => {
    const { weeks, trainingDays } = buildHeatmap(
      [
        day("2026-03-16", 20),
        day("2026-03-18", 5),
        day("2026-03-18", 5),
        day("2026-03-20", 1),
      ],
      new Date(2026, 2, 16),
      TODAY,
      "sets",
    );
    const level = (key: string) =>
      weeks.flat().find((d) => d.key === key)!.level;
    expect(level("2026-03-16")).toBe(4);
    expect(level("2026-03-18")).toBe(2);
    expect(level("2026-03-20")).toBe(1);
    expect(level("2026-03-17")).toBe(0);
    expect(trainingDays).toBe(3);
  });

  it("marks any training day as full by presence, even with nothing logged", () => {
    const { weeks } = buildHeatmap(
      [day("2026-03-17", 0, 0)],
      new Date(2026, 2, 16),
      TODAY,
      "presence",
    );
    expect(weeks.flat().find((d) => d.key === "2026-03-17")!.level).toBe(4);
  });

  it("leaves days before the range empty", () => {
    const { weeks, trainingDays } = buildHeatmap(
      [day("2026-03-09"), day("2026-03-18")],
      new Date(2026, 2, 11),
      TODAY,
      "sets",
    );
    expect(weeks.flat().find((d) => d.key === "2026-03-09")!.level).toBe(0);
    expect(trainingDays).toBe(1);
  });
});

describe("heatmapStart", () => {
  it("counts back the range from today, or starts at the first workout", () => {
    expect(heatmapStart(30, null, TODAY).getDate()).toBe(23);
    expect(heatmapStart(30, null, TODAY).getMonth()).toBe(1);
    const start = heatmapStart(0, "2025-11-03", TODAY);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2025, 10, 3,
    ]);
  });
});
