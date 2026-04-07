// src/pages/Customers/Customers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCustomers,
  selectCustomers,
  selectCustomersLoading,
  selectCustomersError,
  selectCustomersCount,
  selectCustomersPage,
  selectCustomersPageSize,
  selectCustomersSearch,
  setCustomersPage,
  setCustomersPageSize,
  setCustomersSearch,
} from "../../store/slices/customersSlice";
import { Search, Users, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

function formatCreatedDate(value) {
  if (!value) return "";
  const datePart = String(value).slice(0, 10); 
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  const d = new Date(datePart + "T00:00:00Z");
  return d.toLocaleDateString(); 
}

function asPhone(v) {
  if (!v) return "";
  return String(v).replace(/[^\d+]/g, "");
}

function initialsFrom(text = "") {
  const s = String(text || "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
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

export default function Customers() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isRTL = typeof document !== "undefined" && document.dir === "rtl";

  const customers = useSelector(selectCustomers);
  const loading = useSelector(selectCustomersLoading);
  const error = useSelector(selectCustomersError);
  const total = useSelector(selectCustomersCount);
  const page = useSelector(selectCustomersPage);
  const pageSize = useSelector(selectCustomersPageSize);
  const search = useSelector(selectCustomersSearch);

  const [createdDate, setCreatedDate] = useState("");

  // أول تحميل/ وعند تغيّر الصفحة أو البحث
  useEffect(() => {
    dispatch(fetchCustomers({ page, page_size: pageSize, search }));
  }, [dispatch, page, pageSize, search]);

  // فلترة محلية (بحث + تاريخ الإضافة ليوم واحد)
  const shown = useMemo(() => {
    const q = (search || "").toLowerCase().trim();

    return customers.filter((c) => {
      // 🔍 فلترة بالاسم / wa_id / التليفون
      const matchesSearch =
        !q ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.wa_id || "").toLowerCase().includes(q) ||
        (c.phone_e164 || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (!createdDate) return true; // مفيش فلتر تاريخ → رجّع كل اللي عدّى فلتر السيرش

      if (!c.created_at) return false;

      const datePart = String(c.created_at).slice(0, 10); // "YYYY-MM-DD"
      return datePart === createdDate; // نفس اليوم بالظبط
    });
  }, [customers, search, createdDate]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 🔢 أرقام الـ showing
  const showingFrom = shown.length ? (page - 1) * pageSize + 1 : 0;
  const showingTo = (page - 1) * pageSize + shown.length;

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            {t("customers.title", "Customers Count")}
            <span className="text-gray-500 dark:text-gray-400 text-lg">
              ({total})
            </span>
          </h1>
        </div>

        {/* Search & Controls */}
        <div className="p-4 md:p-6 mb-6 rounded-lg shadow-sm border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Search + Date filter */}
            <div className="sm:col-span-2 lg:col-span-3">
              {/* حقل البحث */}
              <div className="relative">
                <Search
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 ${
                    isRTL ? "right-3" : "left-3"
                  }`}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    dispatch(setCustomersSearch(e.target.value))
                  }
                  placeholder={t(
                    "customers.search",
                    "Search by name, phone, or wa_id"
                  )}
                  className={`w-full ${
                    isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                  } h-10 rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#952D8C]`}
                />
              </div>

              {/* فلترة بتاريخ الإضافة (يوم واحد) */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                    {t("customers.created_at", { defaultValue: "Created at" })}
                  </label>
                  <input
                    type="date"
                    value={createdDate}
                    onChange={(e) => setCreatedDate(e.target.value)}
                    className="w-full h-9 rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs px-2 focus:outline-none focus:ring-2 focus:ring-[#952D8C]"
                  />
                </div>
              </div>
            </div>

            {/* Page size */}
            <div className="sm:col-span-1">
              <div className="relative">
                <select
                  className={`w-full h-10 appearance-none rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white ${
                    isRTL ? "pl-9 pr-3" : "pr-9 pl-3"
                  } focus:outline-none focus:ring-2 focus:ring-[#952D8C]`}
                  value={pageSize}
                  onChange={(e) =>
                    dispatch(setCustomersPageSize(Number(e.target.value)))
                  }
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {t("pagination.per_page", {
                        defaultValue: "{{n}} / page",
                        n,
                      })}
                    </option>
                  ))}
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

          {/* Summary / showing results */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                {t("staff.showing", {
                  defaultValue: "Showing {{from}}–{{to}} of {{total}} results",
                  from: showingFrom,
                  to: showingTo,
                  total,
                })}
              </span>
            </div>

            {createdDate && (
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-300">
                <span>
                  {t("customers.filtered_by_date", {
                    defaultValue: "Filtered by created date: {{date}}",
                    date: formatCreatedDate(createdDate),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setCreatedDate("")}
                  className="px-2 py-0.5 rounded-full border border-transparent hover:border-[#952D8C] text-[#952D8C] hover:bg-[#952D8C]/10"
                >
                  {t("common.clear", { defaultValue: "Clear" })}
                </button>
              </div>
            )}
          </div>
        </div>
  {/* Pagination */}
        <div className="flex justify-center sm:justify-end gap-2 mt-6 my-6">
          <button
            type="button"
            onClick={() => dispatch(setCustomersPage(Math.max(1, page - 1)))}
            disabled={page <= 1 || loading}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {t("pagination.previous")}
          </button>
          <span className="px-3 py-1 rounded bg-[#952D8C] text-white text-sm">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              dispatch(setCustomersPage(Math.min(totalPages, page + 1)))
            }
            disabled={page >= totalPages || loading}
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {t("pagination.next")}
          </button>
        </div>
        {/* Table */}
        <div className="rounded-lg shadow-sm border overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table
              className={`w-full text-sm ${
                isRTL ? "text-right" : "text-left"
              }`}
            >
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("customers.th_customer", { defaultValue: "Customer" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("customers.th_waid", { defaultValue: "WA ID" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("customers.th_phone", { defaultValue: "Phone" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("customers.th_extra_phones", {
                      defaultValue: "Extra Phones",
                    })}
                  </Th>
                  <Th align="center">
                    {t("customers.th_created", { defaultValue: "Created" })}
                  </Th>
                  <Th align={isRTL ? "right" : "left"}>
                    {t("customers.th_actions", { defaultValue: "Actions" })}
                  </Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t("loading", "Loading...")}
                    </td>
                  </tr>
                )}

                {error && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-red-600 dark:text-red-400"
                    >
                      {String(error)}
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  shown.map((c) => {
                    const name = c.name || `Customer #${c.id}`;
                    const avatar = initialsFrom(
                      c.name || c.wa_id || `C${c.id}`
                    );
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-[#952D8C] rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {avatar}
                              </span>
                            </div>
                            <div className={isRTL ? "mr-4" : "ml-4"}>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {name}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {c.wa_id || "-"}
                        </td>

                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {c.phone_e164
                            ? asPhone(c.phone_e164)
                            : asPhone(c.wa_id)}
                        </td>

                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                          {Array.isArray(c.extra_phones) &&
                          c.extra_phones.length
                            ? c.extra_phones.map((p) => asPhone(p)).join(", ")
                            : "-"}
                        </td>

                        <td className="px-4 md:px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-300">
                          {c.created_at ? formatCreatedDate(c.created_at) : "-"}
                        </td>

                        <td className="px-4 md:px-6 py-4">
                          <div
                            className={`flex ${
                              isRTL ? "justify-start" : "justify-start"
                            } gap-2`}
                          >
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
                              title={t("customers.view", {
                                defaultValue: "View",
                              })}
                              // onClick={() => navigate(`/chats?customer=${c.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && !error && shown.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t("customers.no_results", "No customers found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      
      </div>
    </div>
  );
}
