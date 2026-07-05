import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en_common from "./locales/en/common.json";
import en_landing from "./locales/en/landing.json";
import en_own from "./locales/en/own.json";
import en_legal from "./locales/en/legal.json";

import es_common from "./locales/es/common.json";
import es_landing from "./locales/es/landing.json";
import es_own from "./locales/es/own.json";
import es_legal from "./locales/es/legal.json";

import ar_common from "./locales/ar/common.json";
import ar_landing from "./locales/ar/landing.json";
import ar_own from "./locales/ar/own.json";
import ar_legal from "./locales/ar/legal.json";

import zh_common from "./locales/zh/common.json";
import zh_landing from "./locales/zh/landing.json";
import zh_own from "./locales/zh/own.json";
import zh_legal from "./locales/zh/legal.json";

import ja_common from "./locales/ja/common.json";
import ja_landing from "./locales/ja/landing.json";
import ja_own from "./locales/ja/own.json";
import ja_legal from "./locales/ja/legal.json";

import fr_common from "./locales/fr/common.json";
import fr_landing from "./locales/fr/landing.json";
import fr_own from "./locales/fr/own.json";
import fr_legal from "./locales/fr/legal.json";

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
      en: { common: en_common, landing: en_landing, own: en_own, legal: en_legal },
      es: { common: es_common, landing: es_landing, own: es_own, legal: es_legal },
      ar: { common: ar_common, landing: ar_landing, own: ar_own, legal: ar_legal },
      zh: { common: zh_common, landing: zh_landing, own: zh_own, legal: zh_legal },
      ja: { common: ja_common, landing: ja_landing, own: ja_own, legal: ja_legal },
      fr: { common: fr_common, landing: fr_landing, own: fr_own, legal: fr_legal },
    },
    fallbackLng: "en",
    ns: ["common", "landing", "own", "legal"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;
