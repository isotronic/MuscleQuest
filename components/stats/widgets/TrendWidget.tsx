import React from "react";
import { t } from "@lingui/core/macro";
import { TrendBarChart } from "@/components/charts/TrendBarChart";
import { useWorkoutSummariesQuery } from "@/hooks/useWorkoutSummariesQuery";
import type { TrendMetric, WidgetConfigs } from "@/utils/statsLayout";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { useWidgetRange } from "./useWidgetRange";
import { WidgetSection } from "./WidgetSection";

export const trendTitle = (metric: TrendMetric, weightUnit: string) => {
  switch (metric) {
    case "workouts":
      return t`Workouts per Week`;
    case "volume": {
      const volumeUnit = weightUnit === "lbs" ? "tn" : "t";
      return t`Volume per Week (${volumeUnit})`;
    }
    case "sets":
      return t`Sets per Week`;
    case "reps":
      return t`Reps per Week`;
    case "duration":
      return t`Training Time per Week (h)`;
  }
};

export const TrendWidget: React.FC<{
  config: WidgetConfigs["trendA"];
}> = ({ config }) => {
  const { statsOptions, weightUnit } = useStatsWidgetContext();
  const { range, rangeDays, badge } = useWidgetRange(config.range);
  const workouts = useWorkoutSummariesQuery(rangeDays, statsOptions);

  // Nothing to plot yet: the history widget already says so.
  if (!workouts.isLoading && (workouts.data?.length ?? 0) === 0) return null;

  return (
    <WidgetSection
      title={trendTitle(config.metric, weightUnit)}
      rangeBadge={badge}
      loading={workouts.isLoading}
      error={!!workouts.error}
    >
      <TrendBarChart
        completedWorkouts={workouts.data ?? []}
        timeRange={range}
        metric={config.metric}
        weightUnit={weightUnit}
      />
    </WidgetSection>
  );
};
