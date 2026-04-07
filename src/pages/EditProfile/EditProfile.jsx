// src/pages/EditProfile.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Save, X, Upload } from "lucide-react";

import {
  fetchMe,
  selectCurrentUser,
  selectIsAuthenticated,
} from "../../store/slices/authSlice";

import {
  fetchUserById,
  makeSelectProjectedUserById,
  selectUserByIdStatus,
  selectUserUpdateStatus,
  selectUserUpdateError,
  updateUser,
  toggleUserActive, 
} from "../../store/slices/usersSlice";

export default function EditProfile() {
  const { t } = useTranslation();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authUser = useSelector(selectCurrentUser);

  const isAdmin = useMemo(() => {
    const r = (authUser?.role || "").toLowerCase();
    return authUser?.is_superuser || authUser?.is_staff || ["admin","superadmin","owner","manager"].includes(r);
  }, [authUser]);

  const targetId = useMemo(() => {
    if (paramId && isAdmin) return Number(paramId);
    return authUser?.id ?? null;
  }, [paramId, isAdmin, authUser]);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login", { replace: true });
    if (paramId && !isAdmin) navigate("/profile", { replace: true });
  }, [isAuthenticated, isAdmin, paramId, navigate]);

  useEffect(() => {
    if (isAuthenticated && !authUser) dispatch(fetchMe());
  }, [isAuthenticated, authUser, dispatch]);

  const selectProjected = useMemo(() => makeSelectProjectedUserById(), []);
  const user = useSelector((s) => (targetId ? selectProjected(s, targetId) : null));
  const loadStatus = useSelector((s) => (targetId ? selectUserByIdStatus(s, targetId) : "idle"));

  useEffect(() => {
    if (targetId && loadStatus !== "loading" && !user) {
      dispatch(fetchUserById(targetId));
    }
  }, [targetId, user, loadStatus, dispatch]);

  const updateStatus = useSelector((s) => (targetId ? selectUserUpdateStatus(s, targetId) : "idle"));
  const updateErr = useSelector((s) => (targetId ? selectUserUpdateError(s, targetId) : null));

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    avatarPreview: "",
    role: "staff",
    is_active: true,
  });
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    if (user) {
      const full = user.name || user.username || "";
      setFormData({
        name: full,
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        avatarPreview: user.avatar || "",
        role: user.role || "staff",
        is_active:
          typeof user.active === "boolean"
            ? user.active
            : user.is_active !== false,
      });
      setAvatarFile(null);
    }
  }, [user]);

  const handlePickAvatar = () => fileInputRef.current?.click();
  const handleAvatarChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    const rd = new FileReader();
    rd.onload = () => setFormData((p) => ({ ...p, avatarPreview: rd.result }));
    rd.readAsDataURL(f);
  };

  const splitName = (n) => {
    const parts = String(n || "").trim().split(/\s+/);
    const first_name = parts.shift() || "";
    const last_name = parts.join(" ");
    return { first_name, last_name };
  };

  const handleSave = async () => {
    if (!targetId) return;

    const { first_name, last_name } = splitName(formData.name);
    const useMultipart = !!avatarFile;
    
    // الحالة الحالية من الداتا الأصلية
    const prevActive =
      typeof user?.active === "boolean"
        ? user.active
        : user?.is_active !== false;

    const nextActive = !!formData.is_active;

    try {
      // ✅ لو الحالة تغيّرت، استعمل نفس toggleUserActive
      if (prevActive !== nextActive) {
        await dispatch(
          toggleUserActive({
            id: targetId,
            currentActive: prevActive,
            // نفس المفتاح المستخدم قبل كده (غيّريه لـ "is_active" لو الـ API بتقبل كده)
            field: "active",
          })
        ).unwrap();
      }

      // جهّزي Payload لباقي الحقول (من غير is_active عشان ما نرجّعش الحالة)
      const payload = useMultipart
        ? {
            first_name,
            last_name,
            username: formData.username,
            email: formData.email,
            phone_e164: formData.phone,
            avatar: avatarFile,
            ...(isAdmin && formData.role ? { role: formData.role } : {}),
          }
        : {
            first_name,
            last_name,
            username: formData.username,
            email: formData.email,
            phone_e164: formData.phone,
            ...(isAdmin && formData.role ? { role: formData.role } : {}),
          };

      await dispatch(updateUser({ id: targetId, data: payload, useMultipart })).unwrap();

      // لو الأدمن عطّل نفسه
      if (authUser?.id === targetId && !nextActive) {
        navigate("/login", { replace: true });
        return;
      }

      // انعاش بيانات المستخدم
      dispatch(fetchUserById(targetId));
      navigate(paramId ? `/users/${targetId}` : "/profile");
    } catch (e) {
      // سيبيه صامت أو ضيفي هاندلينج بسيط هنا حسب رغبتك
    }
  };

  const fallbackAvatar = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("profile.edit_title", { defaultValue: "Edit Profile" })}
          </h2>
          <button
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => navigate(paramId ? `/users/${targetId}` : "/profile")}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <img
              src={formData.avatarPreview || fallbackAvatar}
              alt="avatar"
              className="w-20 h-20 rounded-full border border-gray-300 dark:border-gray-600 object-cover"
            />
            <div>
              <button
                type="button"
                onClick={handlePickAvatar}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Upload className="w-4 h-4" />
                {t("profile.change_avatar", { defaultValue: "Change Avatar" })}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t("settings.profile.full_name", { defaultValue: "Full name" })}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t("validation.userName", { defaultValue: "Username" })}
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t("settings.profile.email", { defaultValue: "Email" })}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t("settings.profile.phone", { defaultValue: "Phone" })}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Role (admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t("settings.profile.role", { defaultValue: "Role" })}
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="staff">{t("staff.role.staff", { defaultValue: "Staff" })}</option>
                <option value="manager">{t("staff.role.manager", { defaultValue: "Manager" })}</option>
                <option value="admin">{t("staff.role.admin", { defaultValue: "Admin" })}</option>
              </select>
            </div>
          )}

          {/* Status (admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t("settings.profile.status", { defaultValue: "Status" })}
              </label>
              <select
                value={formData.is_active ? "active" : "inactive"}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, is_active: e.target.value === "active" }))
                }
                className="w-full px-3 py-2 rounded-lg border focus:outline-none
                           focus:ring-2 focus:ring-[#63bbb3] bg-white border-gray-300
                           text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="active">{t("common.active", { defaultValue: "Active" })}</option>
                <option value="inactive">{t("common.inactive", { defaultValue: "Inactive" })}</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(paramId ? `/users/${targetId}` : "/profile")}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateStatus === "loading"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-[#63bbb3] hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {updateStatus === "loading"
                ? t("common.saving", { defaultValue: "Saving..." })
                : t("common.save", { defaultValue: "Save" })}
            </button>
          </div>

          {updateStatus === "failed" && (
            <div className="text-sm text-red-600">
              {typeof updateErr === "string" ? updateErr : t("common.error_general", { defaultValue: "Update failed" })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
