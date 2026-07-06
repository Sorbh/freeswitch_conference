import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en_common from "./locales/en/common.json";
import en_landing from "./locales/en/landing.json";
import en_own from "./locales/en/own.json";
import en_legal from "./locales/en/legal.json";
import en_auth from "./locales/en/auth.json";
import en_dashboard from "./locales/en/dashboard.json";

import es_common from "./locales/es/common.json";
import es_landing from "./locales/es/landing.json";
import es_own from "./locales/es/own.json";
import es_legal from "./locales/es/legal.json";
import es_auth from "./locales/es/auth.json";
import es_dashboard from "./locales/es/dashboard.json";

import ar_common from "./locales/ar/common.json";
import ar_landing from "./locales/ar/landing.json";
import ar_own from "./locales/ar/own.json";
import ar_legal from "./locales/ar/legal.json";
import ar_auth from "./locales/ar/auth.json";
import ar_dashboard from "./locales/ar/dashboard.json";

import zh_common from "./locales/zh/common.json";
import zh_landing from "./locales/zh/landing.json";
import zh_own from "./locales/zh/own.json";
import zh_legal from "./locales/zh/legal.json";
import zh_auth from "./locales/zh/auth.json";
import zh_dashboard from "./locales/zh/dashboard.json";

import ja_common from "./locales/ja/common.json";
import ja_landing from "./locales/ja/landing.json";
import ja_own from "./locales/ja/own.json";
import ja_legal from "./locales/ja/legal.json";
import ja_auth from "./locales/ja/auth.json";
import ja_dashboard from "./locales/ja/dashboard.json";

import fr_common from "./locales/fr/common.json";
import fr_landing from "./locales/fr/landing.json";
import fr_own from "./locales/fr/own.json";
import fr_legal from "./locales/fr/legal.json";
import fr_auth from "./locales/fr/auth.json";
import fr_dashboard from "./locales/fr/dashboard.json";

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
  { code: "ja", label: "日本語", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en_common, landing: en_landing, own: en_own, legal: en_legal, auth: en_auth, dashboard: en_dashboard },
      es: { common: es_common, landing: es_landing, own: es_own, legal: es_legal, auth: es_auth, dashboard: es_dashboard },
      ar: { common: ar_common, landing: ar_landing, own: ar_own, legal: ar_legal, auth: ar_auth, dashboard: ar_dashboard },
      zh: { common: zh_common, landing: zh_landing, own: zh_own, legal: zh_legal, auth: zh_auth, dashboard: zh_dashboard },
      ja: { common: ja_common, landing: ja_landing, own: ja_own, legal: ja_legal, auth: ja_auth, dashboard: ja_dashboard },
      fr: { common: fr_common, landing: fr_landing, own: fr_own, legal: fr_legal, auth: fr_auth, dashboard: fr_dashboard },
    },
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    ns: ["common", "landing", "own", "legal", "auth", "dashboard"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

// Keep <html lang> and text direction in sync with the active language,
// including the very first load (e.g. Arabic system language → RTL).
function applyDirection(lng) {
  const base = (lng || "en").split("-")[0];
  const lang = LANGUAGES.find((l) => l.code === base);
  document.documentElement.lang = base;
  document.documentElement.dir = lang?.dir || "ltr";
}
applyDirection(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", applyDirection);

export default i18n;
