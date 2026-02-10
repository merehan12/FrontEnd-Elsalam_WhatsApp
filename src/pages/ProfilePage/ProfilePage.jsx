import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Phone, User, Calendar } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMe,
  selectCurrentUser,
  selectIsAuthenticated,
} from "../../store/slices/authSlice";

export default function ProfilePage({ user: injectedUser }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const authUser = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { loading, error } = useSelector((s) => s.auth);

  // if not injected, show the logged-in user's profile
  const user = injectedUser ?? authUser;

  useEffect(() => {
    if (!injectedUser && isAuthenticated && !authUser && !loading) {
      dispatch(fetchMe());
    }
  }, [injectedUser, isAuthenticated, authUser, loading, dispatch]);

  useEffect(() => {
    if (!injectedUser && !isAuthenticated) navigate("/login", { replace: true });
  }, [injectedUser, isAuthenticated, navigate]);

  const display = {
    name:
      user?.name ||
      `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
      user?.username ||
      "—",
    email: user?.email || "—",
    role: user?.role || user?.role_display || "—",
    phone: user?.phone || user?.phone_e164 || "—",
    status: user?.active === false ? "Inactive" : "Active",
    memberSince: user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : (user?.memberSince || "—"),
    avatar: user?.avatar || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t("profile.title", "Profile")}
              </h2>
            </div>
            {loading && !injectedUser && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {t("profile.loading", "Loading profile…")}
              </p>
            )}
            {!loading && error && !injectedUser && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {typeof error === "string" ? error : t("profile.error", "Failed to load profile.")}
              </p>
            )}
          </div>

          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:gap-6 gap-6">
              <img
                src={display.avatar}
                alt={t("profile.avatar_alt", "Avatar")}
                className="w-24 h-24 rounded-full border border-gray-300"
              />

              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <InfoTile
                      icon={<User className="h-5 w-5" />}
                      label={t("profile.full_name", "Full name")}
                      value={display.name}
                    />
                    <InfoTile
                      icon={<Mail className="h-5 w-5" />}
                      label={t("profile.email", "Email")}
                      value={display.email}
                    />
                  </div>

                  <div className="space-y-4">
                    <InfoTile
                      icon={<Phone className="h-5 w-5" />}
                      label={t("profile.phone", "Phone")}
                      value={display.phone}
                    />
                    <InfoTile
                      icon={<User className="h-5 w-5" />}
                      label={t("profile.role", "Role")}
                      value={display.role}
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t("profile.account_info", "Account info")}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoTile
                      icon={<Calendar className="h-5 w-5" />}
                      label={t("profile.member_since", "Member since")}
                      value={display.memberSince}
                      small
                    />
                    <InfoTile
                      icon={<User className="h-5 w-5" />}
                      label={t("profile.status", "Status")}
                      value={
                        <span
                          className={`font-medium ${
                            display.status === "Active"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {display.status}
                        </span>
                      }
                      small
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>  
    </div>
  );
}

function InfoTile({ icon, label, value, small = false }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <span className="text-gray-500 dark:text-gray-400">{icon}</span>
      <div>
        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </label>
        {typeof value === "string" ? (
          <p className={`${small ? "text-sm" : "text-lg"} font-medium text-gray-900 dark:text-white`}>
            {value}
          </p>
        ) : (
          <div className={`${small ? "text-sm" : "text-lg"}`}>{value}</div>
        )}
      </div>
    </div>
  );
}
