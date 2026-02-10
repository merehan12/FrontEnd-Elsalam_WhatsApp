
// src/layouts/MainLayout.jsx
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import useAuthBootstrap from "../hooks/useAuthBootstrap";
import { useDispatch } from "react-redux";
import { setSelectedConversationId, stopConversationsWS } from "../store/slices/conversationsSlice";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useDispatch();

  useAuthBootstrap();

  useEffect(() => {
    const onResize = () => window.innerWidth >= 1024 && setSidebarOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // لو عايزة أول ما ندخل الـ Layout نقفل أي شات قديم
  useEffect(() => {
    dispatch(setSelectedConversationId(null));
    dispatch(stopConversationsWS());
  }, [dispatch]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigateSide={() => {
          // لو حابة تمسحي الشات بس لما حد يغيّر صفحة من السايدبار
          dispatch(setSelectedConversationId(null));
        }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-auto">
          {/* ❌ مفيش key هنا عشان ما نعملش remount للصفحات */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
