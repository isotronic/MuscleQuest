import { i18n } from "@lingui/core";
import { formatDistanceToNow, type Locale } from "date-fns";
import { de, es, fr } from "date-fns/locale";

// English is date-fns's default, so it needs no entry.
const dateLocales: Record<string, Locale> = { de, es, fr };

/** "2 days ago", in the app's active language. */
export function formatTimeAgo(date: Date): string {
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: dateLocales[i18n.locale],
  });
}
