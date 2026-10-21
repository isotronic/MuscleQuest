import { useMemo } from "react";
import { useStatsLayout } from "@/hooks/useStatsLayout";
import type { MuscleSetsTarget } from "@/components/MuscleSetBars";

/**
 * How planned sets per muscle are counted and judged, taken from the Sets per
 * Muscle / Week widget so a plan reads the same as the stats it leads to.
 */
export const useMuscleSetsSettings = (): {
  secondaryWeight: number;
  target: MuscleSetsTarget | null;
} => {
  const { layout } = useStatsLayout();
  const widget = layout.widgets.find((w) => w.id === "muscleSets");
  const config = widget?.id === "muscleSets" ? widget.config : null;
  const secondaryHalf = config?.secondaryHalf ?? true;
  const showTarget = config?.showTarget ?? true;
  const min = config?.targetMin ?? 10;
  const max = config?.targetMax ?? 20;
  return useMemo(
    () => ({
      secondaryWeight: secondaryHalf ? 0.5 : 0,
      target: showTarget ? { min, max } : null,
    }),
    [secondaryHalf, showTarget, min, max],
  );
};
