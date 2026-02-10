import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import useAuthBootstrap from "../hooks/useAuthBootstrap";
import { useDispatch } from "react-redux";
import { setSelectedConversationId, stopConversationsWS } from "../store/slices/conversationsSlice";
export default function ChatsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  useAuthBootstrap();
  useEffect(() => {
    const onResize = () => window.innerWidth >= 1024 && setSidebarOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // عند الخروج من /chats (تفكيك عند unmount)
  
  useEffect(() => {
    return () => {
      dispatch(setSelectedConversationId(null));
      dispatch(stopConversationsWS());
    };
  }, [dispatch]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* سايدبار فيها روابط، هتفصل الشات تلقائياً لأننا ننتقل Layout */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigateSide={() => {
          // لو المستخدم ناوي يخرج من /chats، نظّف أي state مهم
          dispatch(setSelectedConversationId(null));
        }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-auto">
          {/* مفتاح قوي للتأكد من إعادة تركيب الأطفال داخل الشات */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
