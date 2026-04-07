// src/components/chats/TimelineDrawer.jsx
import React from "react";
import { inlineText, asTextSafe } from "../../utils/chatHelpers";

const Badge = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    green:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${
        tones[tone] || tones.gray
      }`}
    >
      {children}
    </span>
  );
};

const TabBtn = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition ${
      active
        ? "bg-[#952D8C] text-white shadow"
        : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-600/70 hover:text-white"
    }`}
  >
    {label}
  </button>
);

function fmtDateTime(ts) {
  try {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts || "");
  }
}

function nameFromUserLike(u) {
  // API بتاعك ممكن يرجّع object: {id, username, first_name, last_name}
  if (!u) return "—";
  if (typeof u === "string" || typeof u === "number") return inlineText(u);
  const username = inlineText(u.username ?? "");
  const fn = inlineText(u.first_name ?? "");
  const ln = inlineText(u.last_name ?? "");
  const full = inlineText(`${fn} ${ln}`.trim());
  return username || full || "—";
}

export default function TimelineDrawer({ open, onClose, tl, tlTab, setTlTab }) {
  if (!open) return null;

  const statusChanges = Array.isArray(tl?.status?.status_changes)
    ? tl.status.status_changes
    : [];
  const subStatusChanges = Array.isArray(tl?.status?.sub_status_changes)
    ? tl.status.sub_status_changes
    : [];

  const mergedStatus = (() => {
    const items = [
      ...statusChanges.map((e) => ({
        ...e,
        change_type: e.change_type || "status",
      })),
      ...subStatusChanges.map((e) => ({
        ...e,
        change_type: e.change_type || "sub_status",
      })),
    ];
    const seen = new Set();
    return items.filter((e) => {
      const key =
        e.id != null
          ? `id:${e.id}`
          : `k:${String(e.change_type).toLowerCase()}|${e.timestamp}|${inlineText(
              e.previous_status ?? e.previous_sub_status ?? ""
            )}|${inlineText(e.new_status ?? e.new_sub_status ?? "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // ✅ Assignments من API بتاع Postman: tl.staff.assignment_events
  const assignmentEvents = Array.isArray(tl?.staff?.assignment_events)
    ? tl.staff.assignment_events
    : [];

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />

      <div className="w-[min(480px,95vw)] h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden font-sans antialiased leading-relaxed text-gray-900 dark:text-gray-100">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl md:text-2xl font-semibold tracking-wide text-gray-900 dark:text-gray-100">
            Timeline
          </h3>
          <button
            className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-4 pt-3 flex gap-2">
          <TabBtn
            label="Assignments"
            active={tlTab === "assign"}
            onClick={() => setTlTab("assign")}
          />
          <TabBtn
            label="Status"
            active={tlTab === "status"}
            onClick={() => setTlTab("status")}
          />
          <TabBtn
            label="Messages"
            active={tlTab === "messages"}
            onClick={() => setTlTab("messages")}
          />
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(100vh-140px)] space-y-4">
          {tl?.loading && <div className="text-sm opacity-70">Loading…</div>}
          {tl?.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {String(tl.error)}
            </div>
          )}

          {/* =================== Assignments =================== */}
          {tlTab === "assign" && (
            <div className="space-y-3">
              {assignmentEvents.map((e) => {
                const actor = nameFromUserLike(
                  e?.assigned_by ?? e?.changed_by ?? null
                );

                const fromName = nameFromUserLike(
                  e?.previous_assignee ?? e?.old_assignee ?? null
                );

                const toName = nameFromUserLike(e?.new_assignee ?? null);

                const verb = String(e?.action_type || e?.event_type || "")
                  .toLowerCase()
                  .trim();

                const niceVerb = verb.includes("reassign")
                  ? "Reassigned"
                  : verb.includes("unassign")
                  ? "Unassigned"
                  : verb.includes("assign")
                  ? "Assigned"
                  : e?.action_type || "Changed";

                return (
                  <div
                    key={e.id ?? `${verb}-${e.timestamp}-${fromName}-${toName}`}
                    className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {niceVerb}{" "}
                        <Badge tone="blue">{fromName}</Badge> →{" "}
                        <Badge tone="green">{toName}</Badge>
                      </div>

                      <div className="text-[11px] opacity-70 shrink-0">
                        {fmtDateTime(e?.timestamp)}
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      Assigned by <b>{actor}</b>
                    </div>
                  </div>
                );
              })}

              {assignmentEvents.length === 0 && (
                <div className="text-sm opacity-70">No assignment events</div>
              )}
            </div>
          )}

          {/* =================== Status =================== */}
          {tlTab === "status" &&
            (mergedStatus.length === 0 ? (
              <div className="text-sm opacity-70">No status changes</div>
            ) : (
              <div className="space-y-3">
                {mergedStatus.map((e) => {
                  const isSub = String(e?.change_type || "")
                    .toLowerCase()
                    .includes("sub");

                  const changedBy = inlineText(
                    e?.changed_by?.username ??
                      e?.changed_by?.name ??
                      e?.changed_by ??
                      "system"
                  );

                  return (
                    <div
                      key={
                        e.id ??
                        `${e.change_type}-${e.timestamp}-${inlineText(
                          e.previous_status ?? e.previous_sub_status ?? ""
                        )}-${inlineText(
                          e.new_status ?? e.new_sub_status ?? ""
                        )}`
                      }
                      className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          <span className="mr-2">Change</span>
                          <Badge tone="blue">
                            {inlineText(
                              e.change_type || (isSub ? "sub_status" : "status")
                            )}
                          </Badge>
                        </div>
                        <div className="text-[11px] opacity-70">
                          {fmtDateTime(e?.timestamp)}
                        </div>
                      </div>

                      <div className="mt-2 text-sm font-medium">
                        {isSub ? (
                          <>
                            Sub-status{" "}
                            <Badge tone="amber">
                              {inlineText(e?.previous_sub_status ?? "—")}
                            </Badge>{" "}
                            →{" "}
                            <Badge tone="green">
                              {inlineText(e?.new_sub_status ?? "—")}
                            </Badge>
                          </>
                        ) : (
                          <>
                            Status{" "}
                            <Badge tone="amber">
                              {inlineText(e?.previous_status ?? "—")}
                            </Badge>{" "}
                            →{" "}
                            <Badge tone="green">
                              {inlineText(e?.new_status ?? "—")}
                            </Badge>
                          </>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(e?.previous_sub_status != null ||
                          e?.new_sub_status != null) && (
                          <>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-2">
                              <div className="opacity-70 mb-0.5">
                                Previous sub-status
                              </div>
                              <div className="font-medium">
                                {inlineText(e?.previous_sub_status ?? "—")}
                              </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-2">
                              <div className="opacity-70 mb-0.5">
                                New sub-status
                              </div>
                              <div className="font-medium">
                                {inlineText(e?.new_sub_status ?? "—")}
                              </div>
                            </div>
                          </>
                        )}

                        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-2 sm:col-span-2">
                          <div className="opacity-70 mb-0.5">Changed by</div>
                          <div className="font-medium">{changedBy}</div>
                        </div>

                        {(e?.reason ?? null) !== null && (
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-2 sm:col-span-2">
                            <div className="opacity-70 mb-0.5">Reason</div>
                            <div className="font-medium">
                              {inlineText(e?.reason ?? "—")}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

          {/* =================== Messages metrics =================== */}
          {tlTab === "messages" && (
            <div className="space-y-4">
              {(tl?.msgActivity?.message_activity || []).map((m) => (
                <div
                  key={m.id || "metrics"}
                  className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400">
                        Count
                      </div>
                      <div className="text-2xl font-sm tabular-nums text-gray-900 dark:text-gray-100">
                        {m.message_count}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-700/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400">
                        Avg response
                      </div>
                      <div className="text-2xl font-sm tabular-nums text-gray-900 dark:text-gray-100">
                        {m.average_response_time_minutes}
                        <span className="text-sm opacity-80"> min</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">
                        First message at
                      </div>
                      <div className="text-sm font-sm text-gray-900 dark:text-gray-100">
                        {fmtDateTime(m.first_message_at)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">
                        Last message at
                      </div>
                      <div className="text-sm font-sm text-gray-900 dark:text-gray-100">
                        {fmtDateTime(m.last_message_at)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">
                        Last updated
                      </div>
                      <div className="text-sm font-sm text-gray-900 dark:text-gray-100">
                        {fmtDateTime(m.last_updated)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {Array.isArray(tl?.msgActivity?.messages) &&
                tl.msgActivity.messages.length > 0 && (
                  <div className="space-y-2">
                    {tl.msgActivity.messages.map((x) => {
                      const who = inlineText(x?.sender ?? x?.author ?? "—");
                      const initials = String(who)
                        .trim()
                        .slice(0, 2)
                        .toUpperCase();
                      const txt = asTextSafe(
                        x?.text ||
                          x?.body?.text ||
                          x?.message ||
                          x?.content ||
                          ""
                      );

                      return (
                        <div
                          key={x.id}
                          className="p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {who}
                                </div>
                                <div className="text-[12px] text-gray-500 dark:text-gray-400 shrink-0">
                                  {fmtDateTime(
                                    x.timestamp || x.created_at
                                  )}
                                </div>
                              </div>

                              {txt && (
                                <div className="mt-1 text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                                  {txt}
                                </div>
                              )}

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                {x.direction ? (
                                  <Badge tone="gray">
                                    {String(x.direction ?? "").toUpperCase()}
                                  </Badge>
                                ) : null}
                                {x.status ? (
                                  <Badge tone="blue">
                                    {String(x.status ?? "")}
                                  </Badge>
                                ) : null}
                                {x.type ? (
                                  <Badge tone="amber">
                                    {String(x.type ?? "")}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              {(!tl?.msgActivity ||
                ((tl?.msgActivity?.message_activity || []).length === 0 &&
                  !(
                    Array.isArray(tl?.msgActivity?.messages) &&
                    tl.msgActivity.messages.length
                  ))) && <div className="text-sm opacity-70">No message metrics</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
