import {
  DEFAULT_STATS_LAYOUT,
  defaultStatsLayout,
  moveWidget,
  normalizeStatsLayout,
  resolveRangeDays,
  setWidgetConfig,
  setWidgetVisible,
  widgetConfig,
} from "../statsLayout";

const ids = (layout: { widgets: { id: string }[] }) =>
  layout.widgets.map((w) => w.id);

describe("normalizeStatsLayout", () => {
  it.each([undefined, null, "", "not json", "{}", '{"widgets": 3}', 42])(
    "falls back to the default layout for %p",
    (raw) => {
      expect(normalizeStatsLayout(raw)).toEqual(DEFAULT_STATS_LAYOUT);
    },
  );

  it("returns a copy, so editing it never changes the defaults", () => {
    const layout = normalizeStatsLayout(undefined);
    (layout.widgets[0].config as { pills: string[] }).pills.push("x");
    expect(DEFAULT_STATS_LAYOUT.widgets[0].config).toEqual({
      pills: ["perWeek", "bestGain", "mostTrained", "streak"],
    });
  });

  it("keeps the stored order and visibility", () => {
    const stored = defaultStatsLayout();
    const reordered = setWidgetVisible(
      moveWidget(stored, 0, stored.widgets.length - 1),
      "heatmap",
      false,
    );
    const result = normalizeStatsLayout(JSON.stringify(reordered));
    expect(ids(result)).toEqual(ids(reordered));
    expect(result.widgets.find((w) => w.id === "heatmap")!.visible).toBe(false);
  });

  it("drops unknown and duplicate widgets", () => {
    const result = normalizeStatsLayout({
      v: 1,
      widgets: [
        { id: "summary", visible: false, config: {} },
        { id: "bodyMap", visible: true, config: {} },
        { id: "summary", visible: true, config: {} },
      ],
    });
    expect(ids(result).filter((id) => id === "summary")).toHaveLength(1);
    expect(ids(result)).not.toContain("bodyMap");
    expect(result.widgets.find((w) => w.id === "summary")!.visible).toBe(false);
  });

  it("adds widgets a stored layout does not know after their default neighbour", () => {
    // A layout saved before recentPRs and heatmap existed, with history moved
    // to the end.
    const result = normalizeStatsLayout({
      v: 1,
      widgets: [
        { id: "insights", visible: true, config: {} },
        { id: "summary", visible: true, config: {} },
        { id: "trendA", visible: true, config: {} },
        { id: "history", visible: true, config: {} },
      ],
    });
    expect(ids(result).slice(0, 7)).toEqual([
      "insights",
      "summary",
      "trendA",
      "trendB",
      "split",
      "muscleSets",
      "tracked",
    ]);
    const history = ids(result).indexOf("history");
    expect(ids(result).slice(history, history + 3)).toEqual([
      "history",
      "recentPRs",
      "heatmap",
    ]);
    expect(result.widgets).toHaveLength(DEFAULT_STATS_LAYOUT.widgets.length);
  });

  it("keeps valid config values and resets invalid ones", () => {
    const result = normalizeStatsLayout({
      v: 1,
      widgets: [
        { id: "trendA", visible: true, config: { metric: "reps", range: "1" } },
        {
          id: "summary",
          visible: "yes",
          config: { tiles: ["sets", "sets"] },
        },
        { id: "insights", visible: true, config: { pills: [] } },
        {
          id: "measurements",
          visible: true,
          config: { metricKeys: ["weight", 3] },
        },
      ],
    });
    expect(widgetConfig(result, "trendA")).toEqual({
      metric: "reps",
      range: "global",
    });
    // Duplicates and empty lists are invalid; visible falls back too.
    const summary = result.widgets.find((w) => w.id === "summary")!;
    expect(summary.visible).toBe(true);
    expect(widgetConfig(result, "summary").tiles).toHaveLength(4);
    expect(widgetConfig(result, "insights").pills).toHaveLength(4);
    expect(widgetConfig(result, "measurements").metricKeys).toEqual([]);
  });

  it("resets a target band whose minimum is not below its maximum", () => {
    const result = normalizeStatsLayout({
      v: 1,
      widgets: [
        {
          id: "muscleSets",
          visible: true,
          config: { targetMin: 20, targetMax: 12, showTarget: false },
        },
      ],
    });
    expect(widgetConfig(result, "muscleSets")).toMatchObject({
      targetMin: 10,
      targetMax: 20,
      showTarget: false,
    });
  });
});

describe("layout edits", () => {
  it("moves a widget", () => {
    const layout = defaultStatsLayout();
    const moved = moveWidget(layout, 2, 0);
    expect(ids(moved)[0]).toBe(ids(layout)[2]);
    expect(moved.widgets).toHaveLength(layout.widgets.length);
  });

  it("patches a widget's config and validates it", () => {
    const layout = setWidgetConfig(defaultStatsLayout(), "trendB", {
      metric: "duration",
    });
    expect(widgetConfig(layout, "trendB")).toEqual({
      metric: "duration",
      range: "global",
    });
    const invalid = setWidgetConfig(layout, "trendB", {
      metric: "calories" as never,
    });
    expect(widgetConfig(invalid, "trendB").metric).toBe("volume");
  });
});

describe("resolveRangeDays", () => {
  it("uses the screen's range unless the widget pins its own", () => {
    expect(resolveRangeDays("global", "90")).toBe("90");
    expect(resolveRangeDays(undefined, "90")).toBe("90");
    expect(resolveRangeDays("365", "90")).toBe("365");
    expect(resolveRangeDays("0", "30")).toBe("0");
  });
});
