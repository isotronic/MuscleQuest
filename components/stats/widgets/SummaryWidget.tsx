import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "@lingui/core/macro";
import { StatsTile } from "@/components/stats/StatsTile";
import {
  usePreviousPeriodSummariesQuery,
  useWorkoutSummariesQuery,
} from "@/hooks/useWorkoutSummariesQuery";
import { computeStats } from "@/utils/workoutStats";
import { formatToHoursMinutes } from "@/utils/utility";
import type { SummaryTile, WidgetConfigs } from "@/utils/statsLayout";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { WidgetSection } from "./WidgetSection";
import { DEVICE_LOCALE } from "@/utils/numberFormat";

type Stats = ReturnType<typeof computeStats>;

interface TileContent {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  deltaText?: string;
}

/** A signed minute count as "1h5m", "45m" or "2h"; the sign is the arrow's. */
const formatMinutesDelta = (minutes: number) => {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
};

const round = (value: number, decimals: number) =>
  parseFloat(value.toFixed(decimals));

const formatCount = (value: number) =>
  value.toLocaleString(DEVICE_LOCALE, { maximumFractionDigits: 1 });

export const buildTile = (
  tile: SummaryTile,
  current: Stats,
  prev: Stats | null,
  weightUnit: string,
): TileContent => {
  const delta = (pick: (s: Stats) => number, decimals = 0) =>
    prev ? round(pick(current) - pick(prev), decimals) : null;
  switch (tile) {
    case "workouts":
      return {
        label: t`Workouts`,
        value: String(current.totalWorkouts),
        delta: delta((s) => s.totalWorkouts),
      };
    case "volume": {
      const volumeUnit = weightUnit === "lbs" ? "tn" : "t";
      return {
        label: t`Volume (${volumeUnit})`,
        value: current.totalVolumeTons.toLocaleString(DEVICE_LOCALE, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        delta: delta((s) => s.totalVolumeTons, 2),
        deltaLabel: volumeUnit,
      };
    }
    case "totalTime": {
      const minutes = prev
        ? Math.round((current.totalTimeSeconds - prev.totalTimeSeconds) / 60)
        : null;
      return {
        label: t`Total Time`,
        value: formatToHoursMinutes(current.totalTimeSeconds),
        delta: minutes,
        deltaText: minutes == null ? undefined : formatMinutesDelta(minutes),
      };
    }
    case "avgDuration":
      return {
        label: t`Avg Duration`,
        value: formatToHoursMinutes(current.avgDurationSeconds),
      };
    case "sets":
      return {
        label: t`Sets`,
        value: formatCount(current.totalSets),
        delta: delta((s) => s.totalSets),
      };
    case "reps":
      return {
        label: t`Reps`,
        value: formatCount(current.totalReps),
        delta: delta((s) => s.totalReps),
      };
    case "trainingDays":
      return {
        label: t`Training Days`,
        value: String(current.trainingDays),
        delta: delta((s) => s.trainingDays),
      };
    case "avgSets":
      return {
        label: t`Avg Sets / Workout`,
        value: formatCount(current.avgSetsPerWorkout),
        delta: delta((s) => s.avgSetsPerWorkout, 1),
      };
  }
};

export const SummaryWidget: React.FC<{
  config: WidgetConfigs["summary"];
}> = ({ config }) => {
  const { globalRange, statsOptions, weightUnit } = useStatsWidgetContext();
  const rangeDays = parseInt(globalRange, 10) || 0;
  const current = useWorkoutSummariesQuery(rangeDays, statsOptions);
  const previous = usePreviousPeriodSummariesQuery(rangeDays, statsOptions);

  const tiles = useMemo(() => {
    const now = computeStats(current.data ?? [], weightUnit);
    const before = previous.data
      ? computeStats(previous.data, weightUnit)
      : null;
    return config.tiles.map((tile) => ({
      id: tile,
      ...buildTile(tile, now, before, weightUnit),
    }));
  }, [current.data, previous.data, weightUnit, config.tiles]);

  return (
    <WidgetSection
      title={t`Summary`}
      loading={current.isLoading}
      error={!!current.error}
    >
      <View style={styles.grid}>
        {tiles.map(({ id, ...tile }) => (
          <StatsTile key={id} {...tile} />
        ))}
      </View>
    </WidgetSection>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
