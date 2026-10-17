import { t } from "@lingui/core/macro";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { showSnackbar } from "@/store/snackbarStore";
import {
  LIST_VIEW_HINT_SETTING,
  loggingStyleOf,
  type LoggingStyle,
} from "@/utils/loggingStyle";

/**
 * The loggingStyle setting, and a switch for it during a workout. Switching
 * also retires the overview's list view hint, since the choice is now made.
 */
export function useLoggingStyle() {
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const style = loggingStyleOf(settings);

  const dismissHint = () =>
    updateSetting({ key: LIST_VIEW_HINT_SETTING, value: "true" });

  const setStyle = (next: LoggingStyle) => {
    updateSetting({ key: "loggingStyle", value: next });
    dismissHint();
    showSnackbar(
      next === "list"
        ? t`Exercises now open as a list of sets. Change this in the workout menu (⋮) or in Settings.`
        : t`Exercises now open one set at a time. Change this in the workout menu (⋮) or in Settings.`,
    );
  };

  return {
    style,
    setStyle,
    hintSeen: settings?.[LIST_VIEW_HINT_SETTING] === "true",
    dismissHint,
  };
}
