import { useLingui } from "@lingui/react";
import { TIME_RANGES } from "@/components/stats/TimeRangeSelector";
import { resolveRangeDays, type RangeOverride } from "@/utils/statsLayout";
import { useStatsWidgetContext } from "./StatsWidgetContext";

/**
 * The range a widget shows: its pinned range, or the screen's. A pinned range
 * comes with a short label for the widget's heading.
 */
export const useWidgetRange = (override?: RangeOverride) => {
  const { _ } = useLingui();
  const { globalRange } = useStatsWidgetContext();
  const range = resolveRangeDays(override, globalRange);
  const pinned = override && override !== "global";
  const option = TIME_RANGES.find((r) => r.value === range);
  return {
    range,
    rangeDays: parseInt(range, 10) || 0,
    badge: pinned && option ? _(option.label) : null,
  };
};
