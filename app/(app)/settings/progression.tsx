import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  SettingAnchor,
  SettingRow,
  SettingsScroll,
  SwitchRow,
  useSettingStyles,
} from "@/components/settings/SettingRow";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSettingsOverlay } from "@/hooks/useSettingsOverlay";
import { useSettingToggle } from "@/hooks/useSettingToggle";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { PROGRESSION_OFFER_SETTING } from "@/utils/progressionOffer";
import { toDisplayDecimal } from "@/utils/numberFormat";

const INCREMENTS = [
  {
    key: "progression_increment_barbell_kg",
    fallback: "2.5",
    icon: "weight-lifter",
  },
  {
    key: "progression_increment_dumbbell_kg",
    fallback: "2.0",
    icon: "dumbbell",
  },
  { key: "progression_increment_cable_kg", fallback: "2.5", icon: "plus" },
  {
    key: "progression_increment_machine_kg",
    fallback: "2.5",
    icon: "seat-recline-extra",
  },
] as const;

export default function ProgressionSettingsScreen() {
  const styles = useSettingStyles();
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const { showOverlay, overlay } = useSettingsOverlay();
  const [progressionOn, setProgressionOn] = useSettingToggle(
    "adaptive_progression_enabled",
    "1",
  );
  const [excludeDeload, setExcludeDeload] = useSettingToggle(
    "exclude_deload_from_stats",
    "1",
  );

  const toggleAdaptiveProgression = (value: boolean) => {
    setProgressionOn(value);
    // Switched off on purpose: the summary should not offer it again.
    if (!value) {
      updateSetting({ key: PROGRESSION_OFFER_SETTING, value: "later" });
    }
  };

  const incrementTitle = (key: (typeof INCREMENTS)[number]["key"]) => {
    switch (key) {
      case "progression_increment_barbell_kg":
        return <Trans>Barbell load increment</Trans>;
      case "progression_increment_dumbbell_kg":
        return <Trans>Dumbbell load increment</Trans>;
      case "progression_increment_cable_kg":
        return <Trans>Cable load increment</Trans>;
      case "progression_increment_machine_kg":
        return <Trans>Machine load increment</Trans>;
    }
  };

  return (
    <SettingsScroll>
      {overlay}
      <SwitchRow
        id="adaptiveProgression"
        icon="trending-up"
        title={<Trans>Suggest load and rep adjustments</Trans>}
        label={t`Suggest load and rep adjustments`}
        testID="setting-adaptive-progression"
        value={progressionOn ? t`Enabled` : t`Disabled`}
        checked={progressionOn}
        onValueChange={toggleAdaptiveProgression}
      >
        <ThemedText style={styles.currentSetting}>
          <Trans>
            Suggestions work in plans and saved workouts, not quick workouts.
          </Trans>
        </ThemedText>
      </SwitchRow>
      {progressionOn && (
        <>
          <SettingAnchor id="progressionIncrements">
            {INCREMENTS.map(({ key, fallback, icon }) => (
              <SettingRow
                key={key}
                icon={icon}
                title={incrementTitle(key)}
                value={`${toDisplayDecimal(settings?.[key] || fallback)} ${
                  settings?.weightUnit || "kg"
                }`}
                onPress={() =>
                  showOverlay(key, settings?.[key] || fallback, "number")
                }
              />
            ))}
          </SettingAnchor>
          <SwitchRow
            id="excludeDeload"
            icon="arrow-down"
            title={<Trans>Exclude deload workouts from exercise stats</Trans>}
            label={t`Exclude deload workouts from exercise stats`}
            value={excludeDeload ? t`Enabled` : t`Disabled`}
            checked={excludeDeload}
            onValueChange={setExcludeDeload}
          />
        </>
      )}
    </SettingsScroll>
  );
}
