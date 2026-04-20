
// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ProtectedRoute from "./routes/ProtectedRoute";
import MainLayout from "./layouts/MainLayout";
import RouteGuardCleanup from "./components/RouteGuardCleanup/RouteGuardCleanup";
import Chats from "./pages/Chats/Chats";
import StaffManagement from "./pages/StaffManagement/StaffManagement";
import Customers from "./pages/Customers/Customers";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";
import ProfilePage from "./pages/ProfilePage/ProfilePage";
import EditProfile from "./pages/EditProfile/EditProfile";
import UserProfilePage from "./pages/ProfilePage/UserProfilePage";
import LoginPage from "./pages/LoginPage/LoginPage";
import { refreshTokensThunk } from "./store/slices/authSlice";
import TemplateBroadcastPage from "./pages/TemplateBroadcastPage/TemplateBroadcastPage";
function AppInner() {
  const dispatch = useDispatch();
  const { access, refresh } = useSelector((s) => s.auth);

  // 🔁 سيلنت ريفرش عند أول لود للتطبيق
  useEffect(() => {
    if (!access && refresh) {
      dispatch(refreshTokensThunk());
    }
  }, [access, refresh, dispatch]);

  return (
    <>
      {/* يراقب المسار وينضّف لما نخرج من /chats لو حابة */}
      <RouteGuardCleanup />

      <Routes>
        {/* صفحة اللوجين */}
        <Route path="/login" element={<LoginPage />} />

        {/* باقي التطبيق محمي */}
        <Route element={<ProtectedRoute />}>
          {/* layout واحد لكل الصفحات */}
          <Route element={<MainLayout />}>
            {/* default redirect */}
            <Route path="/" element={<Navigate to="/chats" replace />} />

            {/* الشات */}
            <Route path="/chats" element={<Chats />} />
            {/* باقي الصفحات */}
            <Route path="/reports" element={<Reports />} />
            <Route path="/staff" element={<StaffManagement />} />
            <Route path="/customers" element={<Customers />} />\
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/users/:id" element={<UserProfilePage />} />
            <Route path="/users/:id/edit" element={<EditProfile />} />
            <Route path="/templates/broadcast" element={<TemplateBroadcastPage />} />
          </Route>
        </Route>

        {/* أي مسار غلط → الشات */}
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}
