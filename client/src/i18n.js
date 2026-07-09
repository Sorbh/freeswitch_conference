import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en_common from "./locales/en/common.json";
import en_landing from "./locales/en/landing.json";
import en_own from "./locales/en/own.json";
import en_legal from "./locales/en/legal.json";
import en_auth from "./locales/en/auth.json";
import en_dashboard from "./locales/en/dashboard.json";

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
  { code: "ja", label: "日本語", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

const NAMESPACES = ["common", "landing", "own", "legal", "auth", "dashboard"];

const loaders = {
  es: () => import("./locales/es/common.json").then(() => Promise.all([
    import("./locales/es/common.json"), import("./locales/es/landing.json"),
    import("./locales/es/own.json"), import("./locales/es/legal.json"),
    import("./locales/es/auth.json"), import("./locales/es/dashboard.json"),
  ])).then(([common, landing, own, legal, auth, dashboard]) => ({
    common: common.default, landing: landing.default, own: own.default,
    legal: legal.default, auth: auth.default, dashboard: dashboard.default,
  })),
  ar: () => Promise.all([
    import("./locales/ar/common.json"), import("./locales/ar/landing.json"),
    import("./locales/ar/own.json"), import("./locales/ar/legal.json"),
    import("./locales/ar/auth.json"), import("./locales/ar/dashboard.json"),
  ]).then(([common, landing, own, legal, auth, dashboard]) => ({
    common: common.default, landing: landing.default, own: own.default,
    legal: legal.default, auth: auth.default, dashboard: dashboard.default,
  })),
  zh: () => Promise.all([
    import("./locales/zh/common.json"), import("./locales/zh/landing.json"),
    import("./locales/zh/own.json"), import("./locales/zh/legal.json"),
    import("./locales/zh/auth.json"), import("./locales/zh/dashboard.json"),
  ]).then(([common, landing, own, legal, auth, dashboard]) => ({
    common: common.default, landing: landing.default, own: own.default,
    legal: legal.default, auth: auth.default, dashboard: dashboard.default,
  })),
  ja: () => Promise.all([
    import("./locales/ja/common.json"), import("./locales/ja/landing.json"),
    import("./locales/ja/own.json"), import("./locales/ja/legal.json"),
    import("./locales/ja/auth.json"), import("./locales/ja/dashboard.json"),
  ]).then(([common, landing, own, legal, auth, dashboard]) => ({
    common: common.default, landing: landing.default, own: own.default,
    legal: legal.default, auth: auth.default, dashboard: dashboard.default,
  })),
  fr: () => Promise.all([
    import("./locales/fr/common.json"), import("./locales/fr/landing.json"),
    import("./locales/fr/own.json"), import("./locales/fr/legal.json"),
    import("./locales/fr/auth.json"), import("./locales/fr/dashboard.json"),
  ]).then(([common, landing, own, legal, auth, dashboard]) => ({
    common: common.default, landing: landing.default, own: own.default,
    legal: legal.default, auth: auth.default, dashboard: dashboard.default,
  })),
};

async function loadLanguage(lng) {
  const base = lng.split("-")[0];
  if (base === "en" || !loaders[base]) return;
  if (i18n.hasResourceBundle(base, "common")) return;
  const bundles = await loaders[base]();
  for (const ns of NAMESPACES) {
    if (bundles[ns]) i18n.addResourceBundle(base, ns, bundles[ns], true, true);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en_common, landing: en_landing, own: en_own, legal: en_legal, auth: en_auth, dashboard: en_dashboard },
    },
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    ns: NAMESPACES,
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

function applyDirection(lng) {
  const base = (lng || "en").split("-")[0];
  const lang = LANGUAGES.find((l) => l.code === base);
  document.documentElement.lang = base;
  document.documentElement.dir = lang?.dir || "ltr";
}

const detectedLng = i18n.resolvedLanguage || i18n.language || "en";
applyDirection(detectedLng);
loadLanguage(detectedLng);

i18n.on("languageChanged", (lng) => {
  applyDirection(lng);
  loadLanguage(lng);
});

export default i18n;
