import React, { useMemo } from "react";
import { t } from "@lingui/core/macro";
import BodyPartChart from "@/components/charts/BodyPartChart";
import { useTrainingSplitQuery } from "@/hooks/useWorkoutSummariesQuery";
import { mergeSplitRows } from "@/utils/workoutStats";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { useWidgetRange } from "./useWidgetRange";
import { WidgetSection } from "./WidgetSection";

export const SplitWidget: React.FC<{
  config: WidgetConfigs["split"];
}> = ({ config }) => {
  const { statsOptions } = useStatsWidgetContext();
  const { rangeDays, badge } = useWidgetRange(config.range);
  const split = useTrainingSplitQuery(rangeDays, config.groupBy, statsOptions);
  // The split shares out each set once, so only target muscles count.
  const counts = useMemo(
    () =>
      split.data && mergeSplitRows(split.data, config.groupBy, config.measure),
    [split.data, config.groupBy, config.measure],
  );

  return (
    <WidgetSection
      title={
        config.measure === "volume"
          ? t`Training Split (by volume)`
          : t`Training Split (by sets)`
      }
      rangeBadge={badge}
      loading={split.isLoading}
      error={!!split.error}
    >
      <BodyPartChart
        bodyPartCounts={counts}
        grouping={config.groupBy}
        measure={config.measure}
      />
    </WidgetSection>
  );
};
