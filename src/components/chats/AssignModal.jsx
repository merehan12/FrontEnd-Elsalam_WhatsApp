// src/components/chats/AssignModal.jsx
import React, { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
export default function AssignModal({
  open,
  onClose,
  t,
  assigneeQuery,
  setAssigneeQuery,
  filteredUsers,
  assigningTo,
  onAssign,
}) {
  const [warnUser, setWarnUser] = useState(null);
  const title = t?.("assign.title", "Assign chat to") || "Assign chat to";
  const searchPh = t?.("assign.search", "Search staff…") || "Search staff…";
  const inactiveTxt = t?.("staff.inactive", "Inactive") || "Inactive";
  const activeTxt = t?.("staff.active", "Active") || "Active";
  const closeTxt = t?.("common.close", "Close") || "Close";
  const cannotAssignTxt =
    t?.(
      "assign.inactive_block",
      "You cannot assign this chat to an inactive user."
    ) || "You cannot assign this chat to an inactive user.";

  const users = useMemo(() => {
    return (filteredUsers || []).map((u) => {
      const statusLower = String(u.status ?? "").toLowerCase();
      const active =
        typeof u.active === "boolean"
          ? u.active
          : statusLower
          ? statusLower === "active"
          : true;
      return { ...u, __active: active };
    });
  }, [filteredUsers]);

  const handleAssignClick = (u) => {
    if (!u.__active) {
      setWarnUser(u);
      return;
    }
    onAssign(u);
  };

  // ✅ الشرط بعد الهوكس
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-50 w-[min(560px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200/70 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            className="px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <input
            value={assigneeQuery}
            onChange={(e) => setAssigneeQuery(e.target.value)}
            placeholder={searchPh}
            className="w-full px-3 py-2 rounded-lg border bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />

          <div className="space-y-1">
            {users.map((u) => (
              <button
                key={u.id}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm
                  ${u.__active ? "text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"}`}
                onClick={() => handleAssignClick(u)}
                disabled={assigningTo === u.id}
              >
                <span className="truncate">
                  {u.name} {u.username ? `(@${u.username})` : ""}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold
                      ${u.__active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}
                  >
                    {u.__active ? activeTxt : inactiveTxt}
                  </span>
                  {assigningTo === u.id && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-900 text-right">
          <button
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-90"
            onClick={onClose}
          >
            {closeTxt}
          </button>
        </div>
      </div>

      {/* Warn if inactive */}
      {warnUser && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setWarnUser(null)}
          />
          <div className="relative z-[61] w-[min(440px,92vw)] rounded-2xl border border-red-200/60 dark:border-red-700 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="p-4 border-b border-red-200/60 dark:border-red-700 flex items-center justify-between">
              <h4 className="text-base font-semibold text-red-700 dark:text-red-300">
                {inactiveTxt}
              </h4>
              <button
                className="px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setWarnUser(null)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 text-sm text-gray-800 dark:text-gray-200 space-y-2">
              <p className="leading-6">
                <span className="font-medium">{warnUser.name}</span>{" "}
                {t?.("assign.is_inactive_msg", "is currently inactive.") ||
                  "is currently inactive."}
              </p>
              <p className="leading-6">{cannotAssignTxt}</p>
            </div>
            <div className="p-3 border-t border-red-200/60 dark:border-red-700 text-right">
              <button
                onClick={() => setWarnUser(null)}
                className="px-4 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t?.("common.ok", "OK") || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
