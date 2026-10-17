import type { Settings } from "@/utils/db/settings";

export const LOGGING_STYLES = ["focus", "list"] as const;

/** Set once the overview's "try list view" hint is answered or moot. */
export const LIST_VIEW_HINT_SETTING = "listViewHintSeen";
export type LoggingStyle = (typeof LOGGING_STYLES)[number];

/** The loggingStyle setting; anything but "list" (including unset) is focus. */
export const loggingStyleOf = (
  settings: Pick<Settings, "loggingStyle"> | undefined,
): LoggingStyle => (settings?.loggingStyle === "list" ? "list" : "focus");
