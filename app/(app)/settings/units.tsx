import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  SettingAnchor,
  SettingRow,
  SettingsScroll,
} from "@/components/settings/SettingRow";
import { UnitSettingItem } from "@/components/UnitSettingItem";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSettingsOverlay } from "@/hooks/useSettingsOverlay";

export default function UnitsSettingsScreen() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const { showOverlay, overlay } = useSettingsOverlay();

  // When unit settings change, refetch completed workouts and body measurements
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
    queryClient.invalidateQueries({ queryKey: ["bodyMeasurements"] });
  }, [
    settings?.weightUnit,
    settings?.distanceUnit,
    settings?.sizeUnit,
    queryClient,
  ]);

  return (
    <SettingsScroll>
      {overlay}
      <SettingAnchor id="weightUnit">
        <UnitSettingItem
          icon="weight"
          label={t`Weight unit`}
          value={settings?.weightUnit || ""}
          onPress={() =>
            showOverlay("weightUnit", settings?.weightUnit || "", "radio", [
              "kg",
              "lbs",
            ])
          }
        />
      </SettingAnchor>
      <SettingAnchor id="distanceUnit">
        <UnitSettingItem
          icon="map-marker-distance"
          label={t`Distance unit`}
          value={settings?.distanceUnit || "m"}
          onPress={() =>
            showOverlay(
              "distanceUnit",
              settings?.distanceUnit || "m",
              "radio",
              ["m", "ft"],
            )
          }
        />
      </SettingAnchor>
      <SettingRow
        id="sizeUnit"
        icon="ruler"
        title={<Trans>Size unit</Trans>}
        value={settings?.sizeUnit || "cm"}
        onPress={() =>
          showOverlay("sizeUnit", settings?.sizeUnit || "cm", "radio", [
            "cm",
            "in",
          ])
        }
      />
    </SettingsScroll>
  );
}
