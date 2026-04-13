// src/pages/Settings.jsx
import React, { useEffect, useState } from "react";
import {  User,  Moon, Sun } from "lucide-react";
import useDarkMode from "../../hooks/useDarkMode";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

// ✅ use /auth/me from authSlice
import {
  fetchMe,
  selectCurrentUser,
} from "../../store/slices/authSlice";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const isRTL = typeof document !== "undefined" && document.dir === "rtl";
  const dispatch = useDispatch();

  // current user comes from auth slice
  const user = useSelector(selectCurrentUser);
  const { loading: authLoading, error: authError } = useSelector((s) => s.auth);

  const [formData, setFormData] = useState({});
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en");
  const [isDark, setIsDark] = useDarkMode();

  // 🔄 on mount (or if user null), fetch /auth/me
  useEffect(() => {
    if (!user && !authLoading) dispatch(fetchMe());
  }, [user, authLoading, dispatch]);

  // 🔄 when user changes, hydrate the form
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.name || user.username || "",
        email: user.email || "",
        phone: user.phone_e164 || "",
        role: user.role || user.role_display || "staff",
      });
    }
  }, [user]);

  const handleInputChange = (field, value) =>
    setFormData((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!user) return;
    const [first_name, ...rest] = String(formData.fullName || "").trim().split(/\s+/);
    const last_name = rest.join(" ");
  };

  const switchLanguage = (lang) => {
    setCurrentLanguage(lang);
    i18n.changeLanguage(lang);
    if (typeof document !== "undefined") {
      document.dir = lang === "ar" ? "rtl" : "ltr";
    }
    
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("settings.title")}
          </h1>
       
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Side Menu */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-fit">
            <nav className="space-y-2">
              <a
                href="#profile"
                className="flex items-center px-3 py-2 rounded-lg text-white bg-[#63bbb3] hover:bg-gradient-to-r transition-colors"
              >
                <User className={`w-4 h-4 ${isRTL ? "ml-3" : "mr-3"}`} />
                {t("settings.profile_settings")}
              </a>
            </nav>
          </div>
          <div className="lg:col-span-2 space-y-6">
            {/* Profile */}
            <section
              id="profile"
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
                {t("settings.profile_settings")}
              </h2>

              {authLoading && <p>{t("common.loading")}...</p>}
              {authError && !authLoading && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {String(authError)}
                </p>
              )}
              {user && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      {t("settings.profile.full_name")}
                    </label>
                    <input
                      type="text"
                      value={formData.fullName || ""}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      {t("settings.profile.email")}
                    </label>
                    <input
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      {t("settings.profile.phone")}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      {t("settings.profile.role")}
                    </label>
                    {/* 🔒 role للعرض فقط عادة */}
                    <input
                      type="text"
                      value={formData.role || ""}
                      disabled
                      className="w-full px-3 py-2 rounded-lg border bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Preferences */}
            <section
              id="preferences"
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
                {t("settings.preferences")}
              </h2>

              <div className="space-y-6">
                {/* Language */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    {t("settings.preferences_block.language")}
                  </label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => switchLanguage("en")}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        currentLanguage === "en"
                          ? "border-[#63bbb3] bg-[#63bbb3] text-white hover:bg-gradient-to-r"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {t("settings.preferences_block.english")}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchLanguage("ar")}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        currentLanguage === "ar"
                          ? "border-[#63bbb3] bg-[#63bbb3] text-white hover:bg-gradient-to-r"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {t("settings.preferences_block.arabic")}
                    </button>
                  </div>
                </div>

                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    {t("settings.preferences_block.theme")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsDark(!isDark)}
                    className="flex items-center px-4 py-2 rounded-lg border transition-colors border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    {isDark ? (
                      <Sun className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                    ) : (
                      <Moon className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                    )}
                    {isDark
                      ? t("settings.preferences_block.switch_to_light")
                      : t("settings.preferences_block.switch_to_dark")}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
