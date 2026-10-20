import { i18n } from "@lingui/core";
import { preferredLocale, type AppLocale } from "./appLocale";
import { messages as enMessages } from "../locales/en/messages";
import { messages as deMessages } from "../locales/de/messages";
import { messages as esMessages } from "../locales/es/messages";
import { messages as frMessages } from "../locales/fr/messages";

const catalogs: Record<AppLocale, typeof enMessages> = {
  en: enMessages,
  de: deMessages,
  es: esMessages,
  fr: frMessages,
};

const locale = preferredLocale();
i18n.loadAndActivate({ locale, messages: catalogs[locale] });

export { i18n };
