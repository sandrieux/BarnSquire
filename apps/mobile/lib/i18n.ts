// Hermes lacks full Intl.PluralRules, which ICU plural messages
// ({count, plural, ...}) need — polyfill it before i18n initializes.
import "@formatjs/intl-pluralrules/polyfill-force";
import "@formatjs/intl-pluralrules/locale-data/en";
import "@formatjs/intl-pluralrules/locale-data/fr";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ICU from "i18next-icu";
import { getLocales } from "expo-localization";
import en from "../messages/en.json";
import frCA from "../messages/fr-CA.json";
import frFR from "../messages/fr-FR.json";

// Reuse the web's next-intl catalogs verbatim. They use ICU MessageFormat
// (e.g. "{done}/{total}" and plurals), so we load i18next-icu to parse them.
const SUPPORTED = ["en", "fr-CA", "fr-FR"] as const;
type Supported = (typeof SUPPORTED)[number];

function isSupported(tag: string | null | undefined): tag is Supported {
  return !!tag && (SUPPORTED as readonly string[]).includes(tag);
}

export function resolveLocale(preferred?: string | null): Supported {
  if (isSupported(preferred)) return preferred;
  const device = getLocales()[0];
  if (isSupported(device?.languageTag)) return device.languageTag as Supported;
  if (device?.languageCode === "fr") return "fr-FR";
  return "en";
}

export function initI18n(preferredLocale?: string | null): typeof i18n {
  const lng = resolveLocale(preferredLocale);
  if (!i18n.isInitialized) {
    i18n
      .use(ICU)
      .use(initReactI18next)
      .init({
        resources: {
          en: { translation: en },
          "fr-CA": { translation: frCA },
          "fr-FR": { translation: frFR },
        },
        lng,
        fallbackLng: "en",
        interpolation: { escapeValue: false },
        returnNull: false,
      });
  } else if (i18n.language !== lng) {
    void i18n.changeLanguage(lng);
  }
  return i18n;
}

export default i18n;
