import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import useAuthBootstrap from "../hooks/useAuthBootstrap";

export default function ChatSystemLayout() {  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const onResize = () => window.innerWidth >= 1024 && setSidebarOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useAuthBootstrap();
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-auto">
          {/* force remount on route change */}
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
}
