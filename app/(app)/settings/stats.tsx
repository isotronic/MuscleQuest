import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { SettingsScroll, SwitchRow } from "@/components/settings/SettingRow";
import { useSettingToggle } from "@/hooks/useSettingToggle";

export default function StatsSettingsScreen() {
  const [excludeWarmup, setExcludeWarmup] =
    useSettingToggle("excludeWarmupSets");
  const [unilateral, setUnilateral] = useSettingToggle("countUnilateralDouble");
  const [paired, setPaired] = useSettingToggle("doubleWeightForPaired");
  const [bodyWeight, setBodyWeight] = useSettingToggle(
    "includeBodyWeightInVolume",
  );

  return (
    <SettingsScroll>
      <SwitchRow
        id="excludeWarmupSets"
        icon="fire-off"
        title={<Trans>Exclude warmup sets from stats</Trans>}
        label={t`Exclude warmup sets from stats`}
        value={excludeWarmup ? t`Enabled` : t`Disabled`}
        checked={excludeWarmup}
        onValueChange={setExcludeWarmup}
      />
      <SwitchRow
        id="countUnilateralDouble"
        icon="arm-flex"
        title={<Trans>Single-side rep logging</Trans>}
        label={t`Single-side rep logging`}
        value={
          unilateral
            ? t`On — log one side; app doubles reps for volume`
            : t`Off — log total reps across both sides`
        }
        checked={unilateral}
        onValueChange={setUnilateral}
      />
      <SwitchRow
        id="doubleWeightForPaired"
        icon="dumbbell"
        title={<Trans>Per-side weight entry</Trans>}
        label={t`Per-side weight entry`}
        value={
          paired
            ? t`On — log per dumbbell/cable; app doubles weight for volume`
            : t`Off — log total weight across both sides`
        }
        checked={paired}
        onValueChange={setPaired}
      />
      <SwitchRow
        id="includeBodyWeightInVolume"
        icon="human"
        title={<Trans>Include body weight in volume</Trans>}
        label={t`Include body weight in volume`}
        value={t`Counts your body weight for push-ups, pull-ups and other bodyweight exercises.`}
        checked={bodyWeight}
        onValueChange={setBodyWeight}
      />
    </SettingsScroll>
  );
}
