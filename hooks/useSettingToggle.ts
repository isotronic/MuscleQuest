import { useEffect, useState } from "react";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import type { Settings } from "@/utils/database";

/**
 * A switch bound to one setting. It flips at once and follows the stored
 * value once the settings query has it, and flips back if the write fails
 * (`onError` then undoes anything the caller changed alongside it). `on` is
 * the stored "on" value ("true" for most settings, "1" for the progression
 * ones).
 */
export function useSettingToggle(
  key: keyof Settings,
  on: "true" | "1" = "true",
): [boolean, (value: boolean, onError?: () => void) => void] {
  const { data: settings } = useSettingsQuery();
  const { mutateAsync: updateSetting } = useUpdateSettingsMutation();
  const stored = settings?.[key] === on;
  const [checked, setChecked] = useState(stored);
  useEffect(() => setChecked(stored), [stored]);

  const set = (value: boolean, onError?: () => void) => {
    const previous = checked;
    setChecked(value);
    const off = on === "1" ? "0" : "false";
    // mutateAsync, not mutate's onError: that one is skipped once the screen
    // unmounts, and the caller's rollback must still run. The mutation itself
    // reports the error.
    updateSetting({ key, value: value ? on : off }).catch(() => {
      setChecked(previous);
      onError?.();
    });
  };
  return [checked, set];
}
