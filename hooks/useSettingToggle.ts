import { useEffect, useState } from "react";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import type { Settings } from "@/utils/database";

/**
 * A switch bound to one setting. It flips at once and follows the stored
 * value once the settings query has it. `on` is the stored "on" value
 * ("true" for most settings, "1" for the progression ones).
 */
export function useSettingToggle(
  key: keyof Settings,
  on: "true" | "1" = "true",
): [boolean, (value: boolean) => void] {
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const stored = settings?.[key] === on;
  const [checked, setChecked] = useState(stored);
  useEffect(() => setChecked(stored), [stored]);

  const set = (value: boolean) => {
    setChecked(value);
    const off = on === "1" ? "0" : "false";
    updateSetting({ key, value: value ? on : off });
  };
  return [checked, set];
}
