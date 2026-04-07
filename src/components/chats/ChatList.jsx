
// src/components/chats/ChatList.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { previewTextFromChat } from "../../utils/chatHelpers";

export default function ChatList({
  t,
  isRTL,
  filter,
  onFilterChange,
  allList,
  myIdSet,
  query,
  setQuery,
  tryPhoneLookup,
  phoneSearchErr,
  loading,
  error,
  listForTab, // 👈 سيبناه بس مش هنستخدمه

  // ⬅️ دول جايين من Chats.jsx
  dateFilter,
  setDateFilter,
  chatsOnThisDayCount,
  uniqueCustomersCount,
  selectedChat,
  onOpenChat,
  currentUsername = "",
 unreadItems = [],
  unreadCount = 0,
  onUnreadFetch = () => {},
  onFilteredListChange = () => {},

  // هيسيبوا زي ما هم لو محتاجاهم بعدين للـ API
  hasNextPage = false,
  onLoadMore = () => {},
}) {
  /* ========= أمان للـ props ========= */
  const safeAllList = Array.isArray(allList) ? allList : [];
  const safeMyIdSet = myIdSet instanceof Set ? myIdSet : new Set();
const safeUnreadItems = Array.isArray(unreadItems) ? unreadItems : [];

const sourceList = useMemo(() => {
  if (filter === "unread") {
    return safeUnreadItems.map((u) => {
      const fromAll = safeAllList.find((a) => String(a.id) === String(u.id));
      // ✅ ندي الأولوية لبيانات allList (lastMessage/time) + نخلي unread_count من unread
      return fromAll
        ? { ...fromAll, ...u }
        : u;
    });
  }
  return safeAllList;
}, [filter, safeUnreadItems, safeAllList]);

// ✅ أول ما المستخدم يفتح تبويب Unread نجيب الداتا
useEffect(() => {
  if (filter === "unread") {
    onUnreadFetch();
  }
}, [filter, onUnreadFetch]);

const myUsername = useMemo(() => {
  return String(currentUsername || "").trim().toLowerCase();
}, [currentUsername]);
 

  const normalizeAssignedTo = useCallback((v) => {
    if (!v) return "";
    if (typeof v === "string") return v.trim().toLowerCase();
    if (typeof v === "object") {
      return String(v.username || v.name || "").trim().toLowerCase();
    }
    return String(v).trim().toLowerCase();
  }, []);

  const isClosedConv = useCallback(
    (c) => String(c?.status || "").toLowerCase() === "closed",
    []
  );

  const isMineConv = useCallback(
    (c) => {
      const a = normalizeAssignedTo(c?.assigned_to);
      if (a && myUsername) return a === myUsername;
      // fallback لو assigned_to مش واضح
      return safeMyIdSet.has(String(c?.id));
    },
    [normalizeAssignedTo, myUsername, safeMyIdSet]
  );

  const isUnassignedConv = useCallback(
    (c) => !c?.assigned_to && !isClosedConv(c),
    [isClosedConv]
  );

  /* ========= Counters (من كل الليست) ========= */
  const { totalCount, unassignedCount, myCount, closedCount } = useMemo(() => {
    let total = 0;
    let unassigned = 0;
    let mine = 0;
    let closed = 0;

    for (const c of safeAllList) {
      total += 1;

      const isClosed = isClosedConv(c);
      if (isClosed) {
        closed += 1;
        continue; // closed مش بيتحسب ضمن unassigned ولا my
      }

      if (isUnassignedConv(c)) unassigned += 1;
      if (isMineConv(c)) mine += 1;
    }

    return {
      totalCount: total,          // كل المحادثات (open + closed)
      unassignedCount: unassigned, // unassigned open فقط
      myCount: mine,              // my open فقط
      closedCount: closed,        // closed فقط
    };
  }, [safeAllList, isClosedConv, isUnassignedConv, isMineConv]);

  /* ========= Desktop / Resize ========= */
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => setIsDesktop(mq.matches);

    handler();

    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const MIN_W = 2;
  const MAX_W = 600;
  const [width, setWidth] = useState(600);
  const wrapRef = useRef(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onResize = useCallback(
    (e) => {
      if (!isResizing.current || !wrapRef.current) return;
      const dx = isRTL ? startX.current - e.clientX : e.clientX - startX.current;
      const w = Math.min(Math.max(startW.current + dx, MIN_W), MAX_W);
      setWidth(w);
    },
    [isRTL]
  );

  const stopResize = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    document.removeEventListener("mousemove", onResize);
    document.removeEventListener("mouseup", stopResize);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [onResize]);

  const startResize = useCallback(
    (e) => {
      if (!isDesktop || !wrapRef.current) return;
      isResizing.current = true;
      startX.current = e.clientX;
      startW.current = wrapRef.current.getBoundingClientRect().width;
      document.addEventListener("mousemove", onResize);
      document.addEventListener("mouseup", stopResize);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isDesktop, onResize, stopResize]
  );

  const edgeClass = isRTL ? "left-0" : "right-0";
  const borderSide = isRTL ? "border-l" : "border-r";

  /* ========= Helpers للتاريخ ========= */
  const extractRawDate = useCallback((src) => {
    if (!src) return null;

    if (typeof src === "string") {
      // ISO: 2025-12-13...
      const m = src.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];

      // لو جالك "12/13/2025"
      const m2 = src.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m2) {
        const mm = String(m2[1]).padStart(2, "0");
        const dd = String(m2[2]).padStart(2, "0");
        const yy = String(m2[3]);
        return `${yy}-${mm}-${dd}`;
      }
    }

    try {
      const d = new Date(src);
      if (Number.isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m2 = String(d.getMonth() + 1).padStart(2, "0");
      const d2 = String(d.getDate()).padStart(2, "0");
      return `${y}-${m2}-${d2}`;
    } catch {
      return null;
    }
  }, []);

  const getConversationDay = useCallback(
    (chat) => {
      const src =
        chat?.conversationDateRaw ||
        chat?.conversation_date ||
        chat?.conversationDate ||
        chat?.created_at ||
        chat?.last_message_at ||
        chat?.lastMessageAt ||
        chat?.last_message?.timestamp ||
        chat?.updated_at ||
        chat?._updated_at ||
        null;

      return extractRawDate(src);
    },
    [extractRawDate]
  );

  const formatConversationDate = useCallback(
    (chat) => {
      const raw = getConversationDay(chat);
      if (!raw) return "";
      const [y, m, d] = raw.split("-");
      return `${d}/${m}/${y}`;
    },
    [getConversationDay]
  );

  // ✅ مهم: dateFilter ممكن يبقى ISO أو MM/DD/YYYY — نوحّده لـ YYYY-MM-DD
  const dateFilterYMD = useMemo(() => {
    if (!dateFilter) return "";
    return extractRawDate(dateFilter) || "";
  }, [dateFilter, extractRawDate]);


const listAfterDateFilterAll = useMemo(() => {
  if (!dateFilterYMD) return sourceList;

  return sourceList.filter(
    (chat) => getConversationDay(chat) === dateFilterYMD
  );
}, [sourceList, dateFilterYMD, getConversationDay]);


const listForCurrentTab = useMemo(() => {
  if (dateFilterYMD) return listAfterDateFilterAll;

  // ✅ لو unread: خلاص هو متفلتر من الباك
  if (filter === "unread") return sourceList;

  return sourceList.filter((c) => {
    const closed = isClosedConv(c);
    if (filter === "closed") return closed;
    if (filter === "unassigned") return !closed && isUnassignedConv(c);
    if (filter === "my") return !closed && isMineConv(c);
    return !closed; // all open
  });
}, [
  sourceList,
  filter,
  dateFilterYMD,
  listAfterDateFilterAll,
  isClosedConv,
  isUnassignedConv,
  isMineConv,
]);

const baseListForSearch = useMemo(() => {
  if (dateFilterYMD) return listAfterDateFilterAll;
  return sourceList;
}, [dateFilterYMD, listAfterDateFilterAll, sourceList]);

  const listAfterFilters = useMemo(() => {
  const q = String(query || "").trim().toLowerCase();
  let list = q ? baseListForSearch : listForCurrentTab;
  if (dateFilterYMD) {
    list = list.filter((chat) => getConversationDay(chat) === dateFilterYMD);
  }

  // search
  if (q) {
    list = list.filter((chat) => {
      const name = String(chat?.name || "").toLowerCase();
      const last = String(previewTextFromChat(chat) || "").toLowerCase();
      const asg = String(chat?.assigned_to || "").toLowerCase();
      return name.includes(q) || last.includes(q) || asg.includes(q);
    });
  }

  return list;
}, [
  query,
  baseListForSearch,
  listForCurrentTab,
  dateFilterYMD,
  getConversationDay,
]);

  // ✅ رجّع الليست لأي مكان “في أي حتة”
  useEffect(() => {
    onFilteredListChange(listAfterFilters);
  }, [listAfterFilters, onFilteredListChange]);

  /* ========= Pagination (30 item per page) ========= */
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(0); // 0-based

  const totalItems = listAfterFilters.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [filter, query, dateFilterYMD, totalItems]);

  const startIndex = page * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;

  const pageItems = useMemo(
    () => listAfterFilters.slice(startIndex, endIndex),
    [listAfterFilters, startIndex, endIndex]
  );

  const canGoPrev = page > 0;
  const canGoNext = page < totalPages - 1 && totalItems > 0;

  const handlePrev = useCallback(() => {
    if (canGoPrev) setPage((p) => p - 1);
  }, [canGoPrev]);

  const handleNext = useCallback(() => {
    if (canGoNext) setPage((p) => p + 1);
  }, [canGoNext]);

  const pageLabel =
    totalItems === 0
      ? t("chats.pagination.empty", "No chats")
      : t("chats.pagination.summary", {
          defaultValue: "Page {{page}} of {{pages}}",
          page: page + 1,
          pages: totalPages,
        });

  const rangeLabel =
    totalItems === 0
      ? ""
      : `${startIndex + 1}–${Math.min(endIndex, totalItems)} / ${totalItems}`;

  /* ========= Render ========= */
  return (
    <div
      ref={wrapRef}
      className={`${
        selectedChat ? "hidden" : "flex"
      } md:flex relative flex-col min-h-0 min-w-0 shrink-0
        bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${borderSide} border-gray-200 dark:border-gray-700
        w-full overflow-hidden`}
      style={{ width: isDesktop ? `${width}px` : "100%" }}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white overflow-hidden">
        <h2 className="text-xl font-semibold mb-4 truncate">
          {t("chats.title", "Chats")}
        </h2>

        {/* Filters */}
        <div
          className={`flex gap-2 mb-3 ${
            isRTL ? "justify-end ms-auto flex-row-reverse" : "justify-start"
          } 
          ${isDesktop ? "flex-nowrap overflow-hidden" : "flex-wrap"}`}
        >
          <button
            onClick={() => onFilterChange("all")}
            className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition shrink-0 whitespace-nowrap ${
              filter === "all"
                ? "bg-[#63bbb3] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            }`}
          >
            {t("chats.filters.all", "All")}{" "}
            <span className="opacity-80">{loading ? "…" : `(${totalCount})`}</span>
          </button>

          <button
            onClick={() => onFilterChange("unassigned")}
            className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition shrink-0 whitespace-nowrap ${
              filter === "unassigned"
                ? "bg-[#63bbb3] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            }`}
          >
            {t("chats.filters.unassigned", "Unassigned")}{" "}
            <span className="opacity-80">
              {loading ? "…" : `(${unassignedCount})`}
            </span>
          </button>

          <button
            onClick={() => onFilterChange("my")}
            className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition shrink-0 whitespace-nowrap ${
              filter === "my"
                ? "bg-[#63bbb3] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            }`}
          >
            {t("chats.filters.my", "My conversations")}{" "}
            <span className="opacity-80">{loading ? "…" : `(${myCount})`}</span>
          </button>

          <button
            onClick={() => onFilterChange("closed")}
            className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition shrink-0 whitespace-nowrap ${
              filter === "closed"
                ? "bg-[#63bbb3] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            }`}
          >
            {t("chats.filters.closed", "Closed")}{" "}
            <span className="opacity-80">
              {loading ? "…" : `(${closedCount})`}
            </span>
          </button>
          <button
  onClick={() => onFilterChange("unread")}
  className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition shrink-0 whitespace-nowrap ${
    filter === "unread"
      ? "bg-[#63bbb3] text-white"
      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
  }`}
>
  {t("chats.filters.unread", "Unread")}{" "}
  <span className="opacity-80">
    {loading ? "…" : `(${unreadCount || safeUnreadItems.length || 0})`}
  </span>
</button>

        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tryPhoneLookup();
              }
            }}
            placeholder={t("chats.search", "Search")}
            className={`w-full ${isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"} py-2 rounded-lg border bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white`}
          />
        </div>

        {/* Date Filter */}
        <div
          className={`mt-3 flex items-center gap-2 text-xs ${
            isRTL ? "justify-end flex-row-reverse" : "justify-start"
          }`}
        >
          <label className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
            {t("chats.date_filter_label", "Filter by date")}
          </label>

          <input
            type="date"
            value={dateFilterYMD || ""}
            onChange={(e) => setDateFilter(e.target.value)} // يخزن ISO
            className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
          />

          {(dateFilterYMD || dateFilter) && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-[11px]"
            >
              {t("chats.clear_date_filter", "Clear")}
            </button>
          )}
        </div>

        {dateFilterYMD && (
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
            <div>
              {t("chats.date_filter_chats_count", "Chats on this day")}:{" "}
              <span className="font-semibold">{chatsOnThisDayCount}</span>
            </div>
          </div>
        )}

        {phoneSearchErr && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 truncate">
            {String(phoneSearchErr)}
          </div>
        )}
      </div>

      {/* List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar overflow-x-hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("loading", "Loading...")}
          </div>
        ) : (
          <>
            {error && (
              <div className="p-6 text-center text-sm text-red-600 dark:text-red-400">
                {String(error)}
              </div>
            )}

            {pageItems.map((chat) => {
              const isClosed = String(chat.status).toLowerCase() === "closed";
              const presence = String(chat.presence || "").toLowerCase();
              const createdLabel = formatConversationDate(chat);
              const unread = Number(chat.unread_count ?? chat.unread ?? 0);

              return (
                <div
                  key={chat.id}
                  onClick={() => onOpenChat(chat)}
                  className={`p-4 border-b cursor-pointer transition-colors 
                    ${
                      String(selectedChat) === String(chat.id)
                        ? "bg-[#63bbb3] bg-opacity-10"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    }
                    ${isClosed ? "opacity-80" : ""} border-gray-100 dark:border-gray-700`}
                >
                  <div
                    className={`flex items-center ${
                      isRTL ? "space-x-reverse space-x-3" : "space-x-3"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 bg-[#63bbb3] rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {chat.avatar}
                        </span>
                      </div>
                      <div
                        className={`absolute bottom-0 ${
                          isRTL ? "left-0" : "right-0"
                        } w-3 h-3 rounded-full border-2
                          ${
                            presence === "online"
                              ? "bg-green-500"
                              : presence === "away"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                          }
                          border-white dark:border-gray-800`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium truncate text-gray-900 dark:text-white">
                            <span
                              className={`${isClosed ? "line-through opacity-70" : ""}`}
                            >
                              {chat.name}
                            </span>
                          </h3>
                          {createdLabel && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {t("chats.customer_created_at", "Conversation date")}:
                              {" "}
                              {createdLabel}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isClosed && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">
                              {t("chats.closed", "Closed")}
                            </span>
                          )}

                          {chat.assigned_to ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap">
                              {t("chats.assigned_to", { defaultValue: "Assigned to" })}:{" "}
                              {typeof chat.assigned_to === "object"
                                ? chat.assigned_to.username || chat.assigned_to.name
                                : chat.assigned_to}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
                              {t("chats.unassigned", "Unassigned")}
                            </span>
                          )}

                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {chat.time}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p className="text-sm truncate text-gray-600 dark:text-gray-400">
                          {previewTextFromChat(chat)}
                        </p>
                        {unread > 0 && (
                          <span className="bg-[#63bbb3] text-white text-xs rounded-full px-2 py-1 shrink-0">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {totalItems === 0 && (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t("chats.no_results", "No chats found")}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination controls */}
      {!loading && totalItems > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between text-xs md:text-sm">
          <div className="text-gray-500 dark:text-gray-400">
            {rangeLabel && <span className="mr-2">{rangeLabel}</span>}
            <span className="hidden sm:inline">{pageLabel}</span>
          </div>

          <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={!canGoPrev}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRTL ? t("chats.pagination.next", "Next") : t("chats.pagination.prev", "Previous")}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRTL ? t("chats.pagination.prev", "Previous") : t("chats.pagination.next", "Next")}
            </button>
          </div>
        </div>
      )}

      {/* مقبض السحب */}
      <div
        onMouseDown={startResize}
        className={`hidden md:block absolute top-0 ${edgeClass} h-full w-[1px] cursor-col-resize bg-gray-300 dark:bg-gray-400 hover:bg-gray-400`}
        style={{ zIndex: 20 }}
        aria-label="Resize chat list"
        role="separator"
      />
    </div>
  );
}
