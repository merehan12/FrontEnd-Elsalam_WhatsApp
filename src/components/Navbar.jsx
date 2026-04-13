// src/components/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { Menu, Sun, Moon, Globe, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  serverLogout,
  fetchMe,
  selectCurrentUser,
  selectIsAuthenticated,
  // startAuthWatchdog 
} from "../store/slices/authSlice";


export default function Navbar({ onMenuClick }) {
  const [isDark, setIsDark] = useDarkMode();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // من الـ authSlice مباشرة
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { loading } = useSelector((s) => s.auth); // لتعطيل زر اللوج آوت وقت الطلب

  const { t, i18n } = useTranslation();

  const handleLanguageToggle = () => {
    const next = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(next);
    document.dir = next === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

//   useEffect(() => {
//   dispatch(startAuthWatchdog());
// }, [dispatch]);
  // اجلب /auth/me عند توافر توكن ومفيش user في الستور
  useEffect(() => {
    if (isAuthenticated && !user && !loading) {
      dispatch(fetchMe());
    }
  }, [isAuthenticated, user, loading, dispatch]);

  // إغلاق المنيو عند الضغط خارجها أو Esc
  useEffect(() => {
    const onClick = (e) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setShowProfileDropdown(false);
    };
    const onKey = (e) => e.key === "Escape" && setShowProfileDropdown(false);

    if (showProfileDropdown) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showProfileDropdown]);

  const displayName =
    user?.name || user?.username || (loading ? "Loading..." : "—");
  const displayEmail = user?.email || "";

  return (
    <nav
      className={`sticky top-0 z-30 px-6 py-4 border-b ${
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            aria-label="Toggle sidebar"
            className={`lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleLanguageToggle}
            title={t("navbar.language_toggle", "Toggle Language")}
            className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            <Globe className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            title={t("navbar.toggle_dark", "Toggle Dark Mode")}
            className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Profile */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileDropdown((v) => !v)}
              className={`flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
              aria-haspopup="menu"
              aria-expanded={showProfileDropdown}
            >
              <div className="w-8 h-8 bg-[#63bbb3] rounded-full grid place-items-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span
                className={`hidden md:block font-medium ${
                  isDark ? "text-white" : "text-gray-700"
                }`}
              >
                {displayName}
              </span>
            </button>

            {showProfileDropdown && (
              <div
                role="menu"
                className={`absolute ${
                  document.dir === "rtl" ? "left-0" : "right-0"
                } mt-2 w-56 rounded-xl shadow-lg border ${
                  isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                }`}
              >
                <div
                  className={`px-4 py-3 border-b ${
                    isDark ? "border-gray-700" : "border-gray-200"
                  } ${document.dir === "rtl" ? "text-right" : "text-left"}`}
                >
                  <p
                    className={`${
                      isDark ? "text-white" : "text-gray-900"
                    } font-medium`}
                  >
                    {displayName}
                  </p>
                  <p
                    className={`${
                      isDark ? "text-gray-400" : "text-gray-500"
                    } text-sm`}
                  >
                    {displayEmail || (loading ? "…" : "—")}
                  </p>
                </div>

                {/* Go to profile */}
                <button
                  role="menuitem"
                  className={`w-full ${
                    document.dir === "rtl" ? "text-right" : "text-left"
                  } flex items-center px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    isDark ? "text-gray-200" : "text-gray-700"
                  }`}
                  onClick={() => {
                    setShowProfileDropdown(false);
                    navigate("/profile"); // صفحة بروفايل واحدة تعتمد على /auth/me
                  }}
                >
                  <User
                    className={`w-4 h-4 ${
                      document.dir === "rtl" ? "ml-3" : "mr-3"
                    }`}
                  />
                  {t("navbar.profile", "Profile")}
                </button>

                <div
                  className={`my-1 border-t ${
                    isDark ? "border-gray-700" : "border-gray-200"
                  }`}
                />

                {/* Logout */}
                <button
                  role="menuitem"
                  disabled={loading}
                  className={`w-full ${
                    document.dir === "rtl" ? "text-right" : "text-left"
                  } flex items-center px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 disabled:opacity-50`}
                  onClick={async () => {
                    setShowProfileDropdown(false);
                    try {
                      await dispatch(serverLogout()).unwrap();
                    } finally {
                      navigate("/login", { replace: true });
                    }
                  }}
                >
                  <LogOut
                    className={`w-4 h-4 ${
                      document.dir === "rtl" ? "ml-3" : "mr-3"
                    }`}
                  />
                  {t("navbar.logout", "Logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
