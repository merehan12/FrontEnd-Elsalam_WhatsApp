
// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { MessageSquare, Users, BarChart3, Settings, X } from "lucide-react";
import {
  stopConversationsWS,
  setSelectedConversationId,
} from "../store/slices/conversationsSlice";
import useDarkMode from "../hooks/useDarkMode";
import { useTranslation } from "react-i18next";
import { LayoutGrid, ChevronDown } from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  const [isDark] = useDarkMode();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const selectedConvId = useSelector(
    (s) => s.conversations?.ui?.selectedConversationId ?? null
  );

  const items = [
    { path: "/chats", icon: MessageSquare, label: t("sidebar.chats") },
    { path: "/reports", icon: BarChart3, label: t("sidebar.reports") },
    { path: "/staff", icon: Users, label: t("sidebar.staff") },
    { path: "/customers", icon: Users, label: t("sidebar.customers") },
  ];

  const hardGo = (to) => {
    const comingFromChats = pathname.startsWith("/chats");
    if (comingFromChats) {
      // اقفل حالة الشات تمامًا
      dispatch(setSelectedConversationId(null));
      dispatch(stopConversationsWS());
    }
    navigate(to);

    if (window.innerWidth < 1024) onClose?.();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full z-50 transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto
        bg-white dark:bg-gray-800 
        ${document.dir === "rtl" ? "border-l" : "border-r"} border-gray-200 dark:border-gray-700
        w-64 shadow-lg`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div
            className={`flex items-center ${
              document.dir === "rtl"
                ? "space-x-reverse space-x-3"
                : "space-x-3"
            }`}
          >
            <div className="w-8 h-8 bg-[#952D8C] rounded-lg grid place-items-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-800 dark:text-white">
            Alaylaa WhatsApp 
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close sidebar"
          >
            <X
              className={`w-5 h-5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
            />
          </button>
        </div>

        <nav className="mt-6 px-3 pb-6">
          {items.map(({ path, icon: Icon, label }) => {
            const active = pathname === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => hardGo(path)}
                className={`w-full text-left flex items-center px-4 py-3 mb-2 rounded-lg transition-colors
                ${
                  active
                    ? "bg-[#952D8C] text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    document.dir === "rtl" ? "ml-3" : "mr-3"
                  }`}
                />
                <span className="font-medium">{label}</span>
              </button>
            );
          })}

        

          {/* Settings (بعد CRM) */}
          {(() => {
            const path = "/settings";
            const active = pathname === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => hardGo(path)}
                className={`w-full text-left flex items-center px-4 py-3 mb-2 rounded-lg transition-colors
                ${
                  active
                    ? "bg-[#952D8C] text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Settings
                  className={`w-5 h-5 ${
                    document.dir === "rtl" ? "ml-3" : "mr-3"
                  }`}
                />
                <span className="font-medium">{t("sidebar.settings")}</span>
              </button>
            );
          })()}
        </nav>
      </aside>
    </>
  );
}
