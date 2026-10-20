import { useEffect, useRef, useState } from "react";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import type { Settings } from "@/utils/database";

/**
 * A switch bound to one setting. It flips at once and follows the stored
 * value once the settings query has it, and flips back if the write fails
 * (`onError` then undoes anything the caller changed alongside it). A tap
 * while a write is still running is ignored (the setter returns false), so
 * writes cannot finish out of order. `on` is the stored "on" value ("true" for most settings, "1" for the
 * progression ones).
 */
export function useSettingToggle(
  key: keyof Settings,
  on: "true" | "1" = "true",
): [boolean, (value: boolean, onError?: () => void) => boolean] {
  const { data: settings } = useSettingsQuery();
  const { mutateAsync: updateSetting } = useUpdateSettingsMutation();
  const stored = settings?.[key] === on;
  const [checked, setChecked] = useState(stored);
  useEffect(() => setChecked(stored), [stored]);
  const writing = useRef(false);

  const set = (value: boolean, onError?: () => void) => {
    if (writing.current) return false;
    writing.current = true;
    const previous = checked;
    setChecked(value);
    const off = on === "1" ? "0" : "false";
    // mutateAsync, not mutate's onError: that one is skipped once the screen
    // unmounts, and the caller's rollback must still run. The mutation itself
    // reports the error.
    updateSetting({ key, value: value ? on : off })
      .catch(() => {
        setChecked(previous);
        onError?.();
      })
      .finally(() => {
        writing.current = false;
      });
    return true;
  };
  return [checked, set];
}
