// src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
// لو بتستخدم ملفات JSON محلية:
import ar from "../src/locales/ar/translation.json";
import en from "../src/locales/en/translation.json";

const APP_LANG_KEY = "app_lang"; // اسم المفتاح في localStorage

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: "en",
    debug: false,
    interpolation: { escapeValue: false },

    detection: {
      // الأهم: اقرَأ من localStorage أولاً
      order: ["localStorage", "htmlTag", "cookie", "navigator"],
      caches: ["localStorage"],                 // خزّن اختيار اللغة
      lookupLocalStorage: APP_LANG_KEY,        // اسم المفتاح
      // لو عايزة تمنعي الكتابة في الكوكيز
      lookupCookie: null,
      cookieMinutes: null,
    },
  });

// (اختياري) ظبّطي اتجاه الصفحة حسب اللغة المخزنة
const lang = localStorage.getItem(APP_LANG_KEY) || i18n.language || "en";
document.documentElement.lang = lang;
document.documentElement.dir = lang.startsWith("ar") ? "rtl" : "ltr";

export default i18n;
