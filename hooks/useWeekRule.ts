import { useMemo } from "react";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { weekRuleFromSettings, type WeekRule } from "@/utils/week";

/** The user's week rule from settings; Monday weeks until they load. */
export function useWeekRule(): WeekRule {
  const { data: settings } = useSettingsQuery();
  const weekStartsOn = settings?.weekStartsOn;
  const weekStartsOnPrevious = settings?.weekStartsOnPrevious;
  const weekStartsOnFrom = settings?.weekStartsOnFrom;
  return useMemo(
    () =>
      weekRuleFromSettings({
        weekStartsOn,
        weekStartsOnPrevious,
        weekStartsOnFrom,
      }),
    [weekStartsOn, weekStartsOnPrevious, weekStartsOnFrom],
  );
}
