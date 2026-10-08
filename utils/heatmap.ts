// The consistency heatmap: one cell per local day, weeks as columns starting
// on Monday (like the weekly goal and streak), shaded by how much was done.
import type { HeatmapIntensity } from "@/utils/statsLayout";
import { localDateKeyToDate, toLocalDateKey } from "@/utils/dates";

export interface HeatmapDay {
  /** local_date key, "YYYY-MM-DD". */
  key: string;
  value: number;
  /** 0 for nothing, else 1 to 4. */
  level: number;
  /** Days after today are drawn empty. */
  future: boolean;
}

export interface Heatmap {
  /** Columns of seven days, Monday first. */
  weeks: HeatmapDay[][];
  trainingDays: number;
}

type DailyWorkout = {
  local_date: string;
  set_count: number;
  volume_kg: number;
};

const startOfIsoWeek = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

/**
 * Builds the grid from `from` to `today` (both local days). Levels split the
 * busiest day into quarters; "presence" marks any training day as full.
 */
export function buildHeatmap(
  workouts: readonly DailyWorkout[],
  from: Date,
  today: Date,
  intensity: HeatmapIntensity,
): Heatmap {
  const totals = new Map<string, number>();
  for (const w of workouts) {
    const add =
      intensity === "volume"
        ? w.volume_kg
        : intensity === "sets"
          ? w.set_count
          : 1;
    // A workout with nothing logged still marks the day as trained.
    totals.set(
      w.local_date,
      (totals.get(w.local_date) ?? 0) + Math.max(add, 0),
    );
  }

  const firstKey = toLocalDateKey(from);
  const todayKey = toLocalDateKey(today);
  let max = 0;
  let trainingDays = 0;
  for (const [key, value] of totals) {
    if (key < firstKey || key > todayKey) continue;
    trainingDays++;
    max = Math.max(max, value);
  }

  const levelOf = (key: string): number => {
    if (!totals.has(key) || key < firstKey) return 0;
    if (intensity === "presence" || max <= 0) return 4;
    const value = totals.get(key)!;
    return Math.max(1, Math.ceil((value / max) * 4));
  };

  const weeks: HeatmapDay[][] = [];
  // Stepping by calendar day, not 24 hours, stays on the right day across
  // daylight saving changes.
  const cursor = startOfIsoWeek(from);
  const end = startOfIsoWeek(today);
  end.setDate(end.getDate() + 6);
  while (cursor <= end) {
    const week: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const key = toLocalDateKey(cursor);
      const future = key > todayKey;
      week.push({
        key,
        value: key < firstKey || future ? 0 : (totals.get(key) ?? 0),
        level: future ? 0 : levelOf(key),
        future,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, trainingDays };
}

/** First day the heatmap covers: the range, or the first workout for all time. */
export function heatmapStart(
  rangeDays: number,
  oldestLocalDate: string | null,
  today: Date,
): Date {
  if (rangeDays > 0) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - rangeDays);
    return d;
  }
  return oldestLocalDate
    ? localDateKeyToDate(oldestLocalDate)
    : new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
