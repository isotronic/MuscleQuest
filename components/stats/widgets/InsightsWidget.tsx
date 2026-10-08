import React, { useMemo } from "react";
import { t } from "@lingui/core/macro";
import { InsightsStrip } from "@/components/stats/InsightsStrip";
import {
  useBodyPartSetCountsQuery,
  useWorkoutSummariesQuery,
} from "@/hooks/useWorkoutSummariesQuery";
import { useTrackedExercisesQuery } from "@/hooks/useTrackedExercisesQuery";
import { useStatsInsights } from "@/hooks/useStatsInsights";
import { mergeBodyPartCounts } from "@/utils/workoutStats";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { WidgetSection } from "./WidgetSection";

export const InsightsWidget: React.FC<{
  config: WidgetConfigs["insights"];
}> = ({ config }) => {
  const {
    globalRange,
    statsOptions,
    excludeDeload,
    weightUnit,
    distanceUnit,
    streak,
  } = useStatsWidgetContext();
  const rangeDays = parseInt(globalRange, 10) || 0;
  const workouts = useWorkoutSummariesQuery(rangeDays, statsOptions);
  const tracked = useTrackedExercisesQuery(
    globalRange,
    statsOptions.excludeWarmup,
    statsOptions.countUnilateralDouble,
    statsOptions.doubleWeightForPaired,
    excludeDeload,
  );
  const { data: bodyPartRows } = useBodyPartSetCountsQuery(
    rangeDays,
    statsOptions.excludeWarmup,
  );
  const bodyPartCounts = useMemo(
    () => bodyPartRows && mergeBodyPartCounts(bodyPartRows),
    [bodyPartRows],
  );
  const insights = useStatsInsights(
    workouts.data?.length,
    tracked.data,
    bodyPartCounts,
    rangeDays,
    weightUnit,
    distanceUnit,
  );

  // Insights only make sense once there is something in the period.
  if (!workouts.isLoading && (workouts.data?.length ?? 0) === 0) return null;

  return (
    <WidgetSection
      title={t`Insights`}
      loading={workouts.isLoading}
      error={!!workouts.error}
    >
      <InsightsStrip
        workoutsPerWeek={insights.workoutsPerWeek}
        biggestGainLabel={insights.biggestGainLabel}
        biggestGainValue={insights.biggestGainValue}
        topBodyPart={insights.topBodyPart}
        streak={streak}
        weightUnit={weightUnit}
        show={config.pills}
      />
    </WidgetSection>
  );
};
