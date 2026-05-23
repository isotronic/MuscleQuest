import { i18n } from "@lingui/core";
import { getLocales } from "expo-localization";
import { messages as enMessages } from "../locales/en/messages";
import { messages as deMessages } from "../locales/de/messages";
import { messages as esMessages } from "../locales/es/messages";
import { messages as frMessages } from "../locales/fr/messages";

const catalogs: Record<string, typeof enMessages> = {
  en: enMessages,
  de: deMessages,
  es: esMessages,
  fr: frMessages,
};

function getPreferredLocale(): string {
  for (const { languageCode } of getLocales()) {
    if (languageCode && languageCode in catalogs) return languageCode;
  }
  return "en";
}

const locale = getPreferredLocale();
i18n.loadAndActivate({ locale, messages: catalogs[locale] });

export { i18n };
