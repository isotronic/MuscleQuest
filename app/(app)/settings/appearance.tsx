import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { SettingsScroll, SwitchRow } from "@/components/settings/SettingRow";
import { useSettingToggle } from "@/hooks/useSettingToggle";

export default function AppearanceSettingsScreen() {
  // Stored as showOnboarding, from when these were introduction cards.
  const [showTips, setShowTips] = useSettingToggle("showOnboarding");

  return (
    <SettingsScroll>
      <SwitchRow
        id="showTips"
        icon="lightbulb-on-outline"
        title={<Trans>Show tips on home</Trans>}
        label={t`Show tips on home`}
        value={
          showTips
            ? t`A few tips show on the home screen.`
            : t`Hidden. Turn this on to see the tips again.`
        }
        checked={showTips}
        onValueChange={setShowTips}
      />
    </SettingsScroll>
  );
}
