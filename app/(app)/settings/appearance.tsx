import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsScroll, SwitchRow } from "@/components/settings/SettingRow";
import { useSettingToggle } from "@/hooks/useSettingToggle";
import {
  hasExerciseNameTranslations,
  setExerciseNamesTranslated,
} from "@/utils/db/exerciseNames";

export default function AppearanceSettingsScreen() {
  const queryClient = useQueryClient();
  // Stored as showOnboarding, from when these were introduction cards.
  const [showTips, setShowTips] = useSettingToggle("showOnboarding");
  const [translateNames, setTranslateNames] = useSettingToggle(
    "translateExerciseNames",
  );

  const applyTranslateNames = (value: boolean) => {
    setExerciseNamesTranslated(value);
    // Names are swapped in as rows are read, so everything showing one reads
    // again.
    void queryClient.invalidateQueries();
  };

  const changeTranslateNames = (value: boolean) => {
    const previous = translateNames;
    setTranslateNames(value, () => applyTranslateNames(previous));
    applyTranslateNames(value);
  };

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
      {hasExerciseNameTranslations() && (
        <SwitchRow
          id="translateExerciseNames"
          icon="translate"
          title={<Trans>Translate exercise names</Trans>}
          label={t`Translate exercise names`}
          value={
            translateNames
              ? t`Exercises show in your language, with the English name on the exercise screen.`
              : t`Exercises show their English names.`
          }
          checked={translateNames}
          onValueChange={changeTranslateNames}
        />
      )}
    </SettingsScroll>
  );
}
