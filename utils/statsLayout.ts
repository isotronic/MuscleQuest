// The stats screen is a fixed list of widgets. Users can show or hide each
// widget, change the order and set a few options per widget. The layout is
// stored as JSON in the `statsLayout` setting, so it goes into backups with
// the rest of userData.db. Anything stored is read through
// normalizeStatsLayout, which falls back to defaults for whatever is missing or
// invalid. An old backup, a corrupt value or a newer widget never breaks the
// screen.

/** "global" follows the screen's time range; otherwise days, "0" all time. */
export const RANGE_OVERRIDES = ["global", "30", "90", "365", "0"] as const;
export type RangeOverride = (typeof RANGE_OVERRIDES)[number];

export const TREND_METRICS = [
  "workouts",
  "volume",
  "sets",
  "reps",
  "duration",
] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export const SUMMARY_TILES = [
  "workouts",
  "volume",
  "totalTime",
  "avgDuration",
  "sets",
  "reps",
  "trainingDays",
  "avgSets",
] as const;
export type SummaryTile = (typeof SUMMARY_TILES)[number];

export const INSIGHT_PILLS = [
  "perWeek",
  "bestGain",
  "mostTrained",
  "streak",
] as const;
export type InsightPillId = (typeof INSIGHT_PILLS)[number];

export const MUSCLE_GROUPINGS = ["bodyPart", "muscle"] as const;
export type MuscleGrouping = (typeof MUSCLE_GROUPINGS)[number];

export const SPLIT_MEASURES = ["sets", "volume"] as const;
export type SplitMeasure = (typeof SPLIT_MEASURES)[number];

export const HEATMAP_INTENSITIES = ["presence", "sets", "volume"] as const;
export type HeatmapIntensity = (typeof HEATMAP_INTENSITIES)[number];

export const HISTORY_LIMITS = ["all", "5", "10"] as const;
export const PR_SCOPES = ["tracked", "all"] as const;
export const PR_LIMITS = ["5", "10"] as const;

/** Weekly set targets offered for the muscle widget's target band. */
export const TARGET_SET_OPTIONS = [
  4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30,
] as const;

export interface WidgetConfigs {
  insights: { pills: InsightPillId[] };
  summary: { tiles: SummaryTile[] };
  history: { limit: (typeof HISTORY_LIMITS)[number] };
  recentPRs: {
    scope: (typeof PR_SCOPES)[number];
    limit: (typeof PR_LIMITS)[number];
    range: RangeOverride;
  };
  heatmap: { intensity: HeatmapIntensity; range: RangeOverride };
  trendA: { metric: TrendMetric; range: RangeOverride };
  trendB: { metric: TrendMetric; range: RangeOverride };
  split: {
    groupBy: MuscleGrouping;
    measure: SplitMeasure;
    range: RangeOverride;
  };
  muscleSets: {
    groupBy: MuscleGrouping;
    secondaryHalf: boolean;
    showTarget: boolean;
    targetMin: number;
    targetMax: number;
    range: RangeOverride;
  };
  tracked: { showSparkline: boolean };
  /** Metric keys to show; empty shows every metric of the latest entry. */
  measurements: { metricKeys: string[] };
}

export type WidgetId = keyof WidgetConfigs;

export type StatsWidget = {
  [K in WidgetId]: { id: K; visible: boolean; config: WidgetConfigs[K] };
}[WidgetId];

export interface StatsLayout {
  v: 1;
  widgets: StatsWidget[];
}

type FieldSpec =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "bool" }
  | { kind: "int"; values: readonly number[] }
  | { kind: "enumList"; values: readonly string[]; min: number }
  | { kind: "stringList" };

const range: FieldSpec = { kind: "enum", values: RANGE_OVERRIDES };
const trendSpec = {
  metric: { kind: "enum", values: TREND_METRICS },
  range,
} as const;

/** What each config field may hold; anything else is replaced by its default. */
export const WIDGET_FIELD_SPECS: {
  [K in WidgetId]: Record<keyof WidgetConfigs[K], FieldSpec>;
} = {
  insights: { pills: { kind: "enumList", values: INSIGHT_PILLS, min: 1 } },
  summary: { tiles: { kind: "enumList", values: SUMMARY_TILES, min: 1 } },
  history: { limit: { kind: "enum", values: HISTORY_LIMITS } },
  recentPRs: {
    scope: { kind: "enum", values: PR_SCOPES },
    limit: { kind: "enum", values: PR_LIMITS },
    range,
  },
  heatmap: {
    intensity: { kind: "enum", values: HEATMAP_INTENSITIES },
    range,
  },
  trendA: trendSpec,
  trendB: trendSpec,
  split: {
    groupBy: { kind: "enum", values: MUSCLE_GROUPINGS },
    measure: { kind: "enum", values: SPLIT_MEASURES },
    range,
  },
  muscleSets: {
    groupBy: { kind: "enum", values: MUSCLE_GROUPINGS },
    secondaryHalf: { kind: "bool" },
    showTarget: { kind: "bool" },
    targetMin: { kind: "int", values: TARGET_SET_OPTIONS },
    targetMax: { kind: "int", values: TARGET_SET_OPTIONS },
    range,
  },
  tracked: { showSparkline: { kind: "bool" } },
  measurements: { metricKeys: { kind: "stringList" } },
};

/** The layout a new user sees, and the order missing widgets are placed in. */
export const DEFAULT_STATS_LAYOUT: StatsLayout = {
  v: 1,
  widgets: [
    {
      id: "insights",
      visible: true,
      config: { pills: [...INSIGHT_PILLS] },
    },
    {
      id: "summary",
      visible: true,
      config: { tiles: ["workouts", "volume", "totalTime", "avgDuration"] },
    },
    { id: "history", visible: true, config: { limit: "all" } },
    {
      id: "recentPRs",
      visible: true,
      config: { scope: "all", limit: "5", range: "global" },
    },
    {
      id: "heatmap",
      visible: true,
      config: { intensity: "sets", range: "365" },
    },
    {
      id: "trendA",
      visible: true,
      config: { metric: "workouts", range: "global" },
    },
    {
      id: "trendB",
      visible: true,
      config: { metric: "volume", range: "global" },
    },
    {
      id: "split",
      visible: true,
      config: { groupBy: "bodyPart", measure: "sets", range: "global" },
    },
    {
      id: "muscleSets",
      visible: true,
      config: {
        groupBy: "muscle",
        secondaryHalf: true,
        showTarget: true,
        targetMin: 10,
        targetMax: 20,
        range: "global",
      },
    },
    { id: "tracked", visible: true, config: { showSparkline: true } },
    { id: "measurements", visible: true, config: { metricKeys: [] } },
  ],
};

const DEFAULT_ORDER = DEFAULT_STATS_LAYOUT.widgets.map((w) => w.id);

const defaultWidget = (id: WidgetId): StatsWidget =>
  DEFAULT_STATS_LAYOUT.widgets.find((w) => w.id === id)!;

const isWidgetId = (id: unknown): id is WidgetId =>
  typeof id === "string" && (DEFAULT_ORDER as string[]).includes(id);

const validField = (spec: FieldSpec, value: unknown): boolean => {
  switch (spec.kind) {
    case "enum":
      return typeof value === "string" && spec.values.includes(value);
    case "bool":
      return typeof value === "boolean";
    case "int":
      return typeof value === "number" && spec.values.includes(value);
    case "enumList":
      return (
        Array.isArray(value) &&
        value.length >= spec.min &&
        value.every((v) => typeof v === "string" && spec.values.includes(v)) &&
        new Set(value).size === value.length
      );
    case "stringList":
      return Array.isArray(value) && value.every((v) => typeof v === "string");
  }
};

/** Stored config over the defaults, keeping only fields that are valid. */
export function normalizeWidgetConfig<K extends WidgetId>(
  id: K,
  raw: unknown,
): WidgetConfigs[K] {
  const defaults = defaultWidget(id).config as WidgetConfigs[K];
  const specs = WIDGET_FIELD_SPECS[id] as Record<string, FieldSpec>;
  const stored =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const config = { ...defaults } as Record<string, unknown>;
  for (const [key, spec] of Object.entries(specs)) {
    if (validField(spec, stored[key])) {
      const value = stored[key];
      config[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  if (
    id === "muscleSets" &&
    Number(config.targetMin) >= Number(config.targetMax)
  ) {
    const d = defaults as WidgetConfigs["muscleSets"];
    config.targetMin = d.targetMin;
    config.targetMax = d.targetMax;
  }
  return config as WidgetConfigs[K];
}

/**
 * Reads a stored layout. Unknown widgets are dropped, duplicates keep their
 * first position, and widgets the stored layout does not know yet are added
 * after the widget that precedes them in the default order.
 */
export function normalizeStatsLayout(raw: unknown): StatsLayout {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const storedWidgets =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { widgets?: unknown }).widgets)
      ? ((parsed as { widgets: unknown[] }).widgets as unknown[])
      : null;
  if (!storedWidgets) return cloneLayout(DEFAULT_STATS_LAYOUT);

  const widgets: StatsWidget[] = [];
  const seen = new Set<WidgetId>();
  for (const entry of storedWidgets) {
    if (!entry || typeof entry !== "object") continue;
    const { id, visible, config } = entry as Record<string, unknown>;
    if (!isWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    widgets.push({
      id,
      visible:
        typeof visible === "boolean" ? visible : defaultWidget(id).visible,
      config: normalizeWidgetConfig(id, config),
    } as StatsWidget);
  }

  DEFAULT_ORDER.forEach((id, index) => {
    if (seen.has(id)) return;
    const previous = DEFAULT_ORDER.slice(0, index)
      .reverse()
      .find((p) => seen.has(p));
    const at = previous ? widgets.findIndex((w) => w.id === previous) + 1 : 0;
    widgets.splice(at, 0, cloneWidget(defaultWidget(id)));
    seen.add(id);
  });

  return { v: 1, widgets };
}

const cloneWidget = (widget: StatsWidget): StatsWidget =>
  ({
    ...widget,
    config: JSON.parse(JSON.stringify(widget.config)),
  }) as StatsWidget;

const cloneLayout = (layout: StatsLayout): StatsLayout => ({
  v: 1,
  widgets: layout.widgets.map(cloneWidget),
});

export const defaultStatsLayout = () => cloneLayout(DEFAULT_STATS_LAYOUT);

export function setWidgetVisible(
  layout: StatsLayout,
  id: WidgetId,
  visible: boolean,
): StatsLayout {
  return {
    v: 1,
    widgets: layout.widgets.map((w) => (w.id === id ? { ...w, visible } : w)),
  };
}

export function moveWidget(
  layout: StatsLayout,
  fromIndex: number,
  toIndex: number,
): StatsLayout {
  const widgets = [...layout.widgets];
  const [moved] = widgets.splice(fromIndex, 1);
  if (!moved) return layout;
  widgets.splice(toIndex, 0, moved);
  return { v: 1, widgets };
}

export function setWidgetConfig<K extends WidgetId>(
  layout: StatsLayout,
  id: K,
  patch: Partial<WidgetConfigs[K]>,
): StatsLayout {
  return {
    v: 1,
    widgets: layout.widgets.map((w) =>
      w.id === id
        ? ({
            ...w,
            config: normalizeWidgetConfig(id, { ...w.config, ...patch }),
          } as StatsWidget)
        : w,
    ),
  };
}

export function widgetConfig<K extends WidgetId>(
  layout: StatsLayout,
  id: K,
): WidgetConfigs[K] {
  const widget = layout.widgets.find((w) => w.id === id);
  return (widget?.config ?? defaultWidget(id).config) as WidgetConfigs[K];
}

/** Days for a widget: its pinned range, or the screen's when "global". */
export const resolveRangeDays = (
  override: RangeOverride | undefined,
  globalRange: string,
): string => (!override || override === "global" ? globalRange : override);
