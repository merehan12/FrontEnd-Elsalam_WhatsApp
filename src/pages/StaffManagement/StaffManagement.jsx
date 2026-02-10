// src/pages/StaffManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Eye,
  UserPlus,
  Mail,
  Shield,
  Save,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  fetchUsers,
  createUser,
  selectUsersProjected,
  selectUsersState,
  fetchUserById,
} from "../../store/slices/usersSlice";
import { selectCurrentUser } from "../../store/slices/authSlice";
import {
  fetchConversations,
  selectConversationList,
} from "../../store/slices/conversationsSlice";

export default function StaffManagement() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isRTL = typeof document !== "undefined" && document.dir === "rtl";

  const users = useSelector(selectUsersProjected);
  const { status, error } = useSelector(selectUsersState);
  const authUser = useSelector(selectCurrentUser);

  // ✅ قائمة المحادثات لاستخراج عدد المحادثات لكل موظف
  const conversations = useSelector(selectConversationList);

  const isAdmin = React.useMemo(() => {
    const r = (authUser?.role || "").toLowerCase();
    return (
      authUser?.is_superuser ||
      authUser?.is_staff ||
      ["admin", "superadmin", "owner", "manager"].includes(r)
    );
  }, [authUser]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (status === "idle") dispatch(fetchUsers());
    dispatch(fetchConversations({ filter: "all", page: 1, page_size: 100 }));
  }, [status, dispatch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((r) => {
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.username || "").toLowerCase().includes(q);
      const matchRole = !roleFilter || r.role === roleFilter;
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchQ && matchRole && matchStatus;
    });
  }, [users, query, roleFilter, statusFilter]);
  const chatsByAssignee = useMemo(() => {
    const m = new Map(); // userId -> count
    for (const c of conversations || []) {
      const assignee = c?.assigned_to?.id ?? c?.assigned_to ?? null;
      if (assignee == null) continue;
      m.set(assignee, (m.get(assignee) || 0) + 1);
    }
    return m;
  }, [conversations]);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("staff.title", { defaultValue: "Staff Management" })}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                dispatch(fetchUsers());
                dispatch(
                  fetchConversations({
                    filter: "all",
                    page: 1,
                    page_size: 100,
                  }),
                );
              }}
              className="inline-flex items-center justify-center px-3 py-2 border rounded-lg text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {status === "loading"
                ? t("common.loading", { defaultValue: "Loading..." })
                : t("common.refresh", { defaultValue: "Refresh" })}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center justify-center px-4 py-2 bg-[#952D8C] text-white rounded-lg  transition-colors"
              >
                <Plus className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                {t("staff.add_staff", { defaultValue: "Add Staff" })}
              </button>
            )}
          </div>
        </div>

        {/* Errors */}
        {status === "failed" && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            {typeof error === "string"
              ? String(error)
              : t("common.error_general", {
                  defaultValue: "An error occurred while loading users.",
                })}
          </div>
        )}

        {/* Search & Filters */}
        <div className="p-4 md:p-6 mb-6 rounded-lg shadow-sm border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="relative">
                <Search
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 ${
                    isRTL ? "right-3" : "left-3"
                  }`}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("staff.search_placeholder", {
                    defaultValue: "Search name, email, or username...",
                  })}
                  className={`w-full ${
                    isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                  } h-10 rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#952D8C]`}
                />
              </div>
            </div>

            {/* Role filter */}
            <div className="sm:col-span-1">
              <div className="relative">
                <select
                  className={`w-full h-10 appearance-none rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${
                    isRTL ? "pl-9 pr-3" : "pr-9 pl-3"
                  } focus:outline-none focus:ring-2 focus:ring-[#952D8C]`}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">
                    {t("staff.all_roles", { defaultValue: "All roles" })}
                  </option>
                  <option value="admin">
                    {t("staff.role.admin", { defaultValue: "Admin" })}
                  </option>
                  <option value="staff">
                    {t("staff.role.staff", { defaultValue: "Staff" })}
                  </option>
                </select>
                <span
                  className={`pointer-events-none absolute inset-y-0 flex items-center text-gray-500 dark:text-gray-400 ${
                    isRTL ? "left-3" : "right-3"
                  }`}
                >
                  ▾
                </span>
              </div>
            </div>

            {/* Status filter */}
            <div className="sm:col-span-1">
              <div className="relative">
                <select
                  className={`w-full h-10 appearance-none rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${
                    isRTL ? "pl-9 pr-3" : "pr-9 pl-3"
                  } focus:outline-none focus:ring-2 focus:ring-[#952D8C]`}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">
                    {t("staff.all_status", { defaultValue: "All status" })}
                  </option>
                  <option value="Active">
                    {t("staff.active", { defaultValue: "Active" })}
                  </option>
                  <option value="Inactive">
                    {t("staff.inactive", { defaultValue: "Inactive" })}
                  </option>
                </select>
                <span
                  className={`pointer-events-none absolute inset-y-0 flex items-center text-gray-500 dark:text-gray-400 ${
                    isRTL ? "left-3" : "right-3"
                  }`}
                >
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg shadow-sm border overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table
              className={`w-full text-sm ${isRTL ? "text-right" : "text-left"}`}
            >
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("staff.th_member", { defaultValue: "Member" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("staff.th_role", { defaultValue: "Role" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("staff.th_status", { defaultValue: "Status" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("staff.th_chats", { defaultValue: "Chats" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("staff.th_join_date", { defaultValue: "Join Date" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("staff.th_actions", { defaultValue: "Actions" })}
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {status === "loading" && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t("common.loading", { defaultValue: "Loading..." })}
                    </td>
                  </tr>
                )}

                {status !== "loading" &&
                  filtered.map((r) => {
                    const isActive =
                      typeof r.active === "boolean"
                        ? r.active
                        : r.status === "Active";
                    const chatsCount = chatsByAssignee.get(r.id) || 0; // ✅ العدد من المحادثات
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-[#952D8C] rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {getInitials(r.name)}
                              </span>
                            </div>
                            <div className={isRTL ? "mr-4" : "ml-4"}>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {r.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {r.email || r.username}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {r.role}
                        </td>

                        <td className="px-4 md:px-6 py-4">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {isActive
                              ? t("staff.active", { defaultValue: "Active" })
                              : t("staff.inactive", {
                                  defaultValue: "Inactive",
                                })}
                          </span>
                        </td>

                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {chatsCount}
                        </td>

                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {r.joinDate}
                        </td>

                        <td className="px-4 md:px-6 py-4">
                          {isAdmin ? (
                            <div className="flex justify-start gap-2">
                              {/* View details */}
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
                                onClick={async () => {
                                  try {
                                    await dispatch(
                                      fetchUserById(r.id),
                                    ).unwrap();
                                  } catch {}
                                  navigate(`/users/${r.id}`);
                                }}
                                title={t("common.view", {
                                  defaultValue: "View",
                                })}
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit user */}
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
                                onClick={() => navigate(`/users/${r.id}/edit`)}
                                title={t("common.edit", {
                                  defaultValue: "Edit",
                                })}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {status !== "loading" && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t("common.no_results", { defaultValue: "No results" })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination (static demo) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
          <div className="text-sm text-gray-700 dark:text-gray-400" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {t("pagination.previous", { defaultValue: "Previous" })}
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded bg-[#952D8C] text-white"
            >
              1
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {t("pagination.next", { defaultValue: "Next" })}
            </button>
          </div>
        </div>
      </div>

      {/* Add Staff Modal — admin only */}
      {isAdmin && isOpen && <AddStaffModal onClose={() => setIsOpen(false)} />}
    </div>
  );
}

function Th({ children, align = "left" }) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";
  return (
    <th
      className={`px-4 md:px-6 py-3 ${alignClass} text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300`}
    >
      {children}
    </th>
  );
}

function AddStaffModal({ onClose }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isRTL = typeof document !== "undefined" && document.dir === "rtl";

  const { createStatus, createError } = useSelector(selectUsersState);

  // helper: تاريخ اليوم بصيغة YYYY-MM-DD
  const todayStr = React.useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "staff",
    active: true,
    email: "",
    first_name: "",
    last_name: "",
    date_joined: todayStr,
  });
  const [errors, setErrors] = useState({});
  const [ok, setOk] = useState("");

  const onChange = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setOk("");
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim())
      e.username = t("validation.username_required", {
        defaultValue: "Username is required",
      });
    if (!form.password.trim())
      e.password = t("validation.password_required", {
        defaultValue: "Password is required",
      });
    else if (form.password.length < 6)
      e.password = t("validation.password_short", {
        defaultValue: "Password must be at least 6 characters",
      });
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      e.email = t("validation.email_invalid", {
        defaultValue: "Invalid email format",
      });
    if (!form.role)
      e.role = t("staff.validation.role_required", {
        defaultValue: "Please select a role",
      });
    if (!form.date_joined)
      e.date_joined = t("staff.validation.join_date_required", {
        defaultValue: "Join date is required",
      });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setOk("");
    try {
      const payload = {
        username: form.username,
        password: form.password,
        role: form.role,
        active: form.active,
        email: form.email || undefined,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        date_joined: form.date_joined,
      };

      await dispatch(createUser(payload)).unwrap();
      setOk(
        t("staff.modal.add_success", {
          defaultValue: "Staff member added successfully",
        }),
      );

      // تحديث القوائم
      dispatch(fetchUsers());
      dispatch(fetchConversations({ filter: "all", page: 1, page_size: 100 }));

      onClose();
    } catch (err) {
      console.error("Create user failed:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <UserPlus className="w-5 h-5" />
            <h3 className="text-lg font-semibold">
              {t("staff.form.title", { defaultValue: "Add New Staff" })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            aria-label={t("common.close", { defaultValue: "Close" })}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-5">
          {createStatus === "failed" && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm break-words">
              {typeof createError === "string"
                ? String(createError)
                : t("common.error_general", {
                    defaultValue: "Failed to create user",
                  })}
            </div>
          )}
          {ok && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">
              {ok}
            </div>
          )}

          {/* Username */}
          <Field
            label={t("validation.userName", { defaultValue: "Username" })}
            error={errors.username}
            icon={<UserPlus className="w-4 h-4" />}
          >
            <input
              type="text"
              value={form.username}
              onChange={(e) => onChange("username", e.target.value)}
              placeholder="e.g. johndoe"
              className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
            />
          </Field>

          {/* Password */}
          <Field
            label={t("validation.password", { defaultValue: "Password" })}
            error={errors.password}
            icon={<Shield className="w-4 h-4" />}
          >
            <input
              type="password"
              value={form.password}
              onChange={(e) => onChange("password", e.target.value)}
              placeholder="••••••••"
              className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
            />
          </Field>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={t("validation.firstname", { defaultValue: "First name" })}
              error={errors.first_name}
            >
              <input
                type="text"
                value={form.first_name || ""}
                onChange={(e) => onChange("first_name", e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
              />
            </Field>
            <Field
              label={t("validation.lastname", { defaultValue: "Last name" })}
              error={errors.last_name}
            >
              <input
                type="text"
                value={form.last_name || ""}
                onChange={(e) => onChange("last_name", e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
              />
            </Field>
          </div>

          {/* Email */}
          <Field
            label={t("staff.form.email", { defaultValue: "Email" })}
            error={errors.email}
            icon={<Mail className="w-4 h-4" />}
          >
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="name@example.com"
              className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
            />
          </Field>

          {/* Join Date (date_joined) */}
          <Field
            label={t("customers.created_at", { defaultValue: "Join date" })}
            error={errors.date_joined}
            icon={<CalendarIcon />}
          >
            <input
              type="date"
              value={form.date_joined}
              onChange={(e) => onChange("date_joined", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
            />
          </Field>

          {/* Role */}
          <Field
            label={t("staff.form.role", { defaultValue: "Role" })}
            error={errors.role}
            icon={<Shield className="w-4 h-4" />}
          >
            <select
              value={form.role}
              onChange={(e) => onChange("role", e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#952D8C] ${isRTL ? "text-right" : "text-left"}`}
            >
              <option value="staff">
                {t("staff.role.staff", { defaultValue: "Staff" })}
              </option>
              <option value="admin">
                {t("staff.role.admin", { defaultValue: "Admin" })}
              </option>
            </select>
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={createStatus === "loading"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-[#952D8C] hover:bg-gradient-to-r disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {createStatus === "loading"
                ? t("common.saving", { defaultValue: "Saving..." })
                : t("common.save", { defaultValue: "Save" })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// أيقونة بسيطة للتاريخ (بدون مكتبات إضافية)
function CalendarIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function Field({ label, error, icon, children }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        {icon}
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
