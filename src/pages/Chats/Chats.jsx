// src/pages/Chats/Chats.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import api from "../../api/axios";
import {
  fetchConversations,
  selectConversationList,
  selectConversationLoading,
  selectConversationError,
  selectConversationParams,
  setUnreadZero,
  setSelectedConversationId,
  wsAssignedChanged,
  assignConversation,
  markConversationRead,
  toggleConversationStatus,
  selectIsUpdatingStatus,
  selectCloseOpenButton,
  fetchSubStatuses,
  selectSubStatusesClosed,
  selectSubStatusesLoading,
  selectSubStatusesError,
  wsUpsertConversation,
  // Hub WS
  startConversationsWS,
  stopConversationsWS,
  wsIncomingMessage,
  fetchUnreadConversations,
  selectUnreadItems,
  selectUnreadItemsCount,
  selectUnreadLoading,
} from "../../store/slices/conversationsSlice";

import {
  selectMessagesByConv,
  selectMessagesLoading,
  selectMessagesError,
  selectLastTsByConv,
  fetchMessages,
  sendMessage,
  selectIsSendingByConv,
  fetchNewer,
  wsMessageReceived,
  wsMessageStatusUpdated,
  resolveMediaUrl,
} from "../../store/slices/messagesSlice";

import {
  fetchUsers,
  selectUsersProjected,
} from "../../store/slices/usersSlice";

import {
  fetchTimelineAll,
  fetchTimelineStatus,
  fetchTimelineStaff,
  fetchTimelineMessages,
  fetchComments,
  createComment,
  editComment,
  deleteComment,
  selectTimelineState,
} from "../../store/slices/timelineSlice";

import { ChatWebSocket as ChatSocket } from "../../ws/chatSocket";
import {
  searchCustomerByPhone,
  selectCustomerByPhoneResult,
  selectCustomerByPhoneError,
  clearCustomerPhoneSearch,
} from "../../store/slices/customersSlice";
import ChatList from "../../components/chats/ChatList";
import ChatWindow from "../../components/chats/ChatWindow";
import CommentsModal from "../../components/chats/CommentsModal";
import AssignModal from "../../components/chats/AssignModal";
import TimelineDrawer from "../../components/chats/TimelineDrawer";

import {
  formatTime,
  asTextSafe,
  extractText,
  sortByLatestDesc,
  mapConversationApiToUI,
  mergeListsKeepUnread,
  bumpConv,
  looksLikePhone,
} from "../../utils/chatHelpers";

// ✅ normalize reply coming from backend (reply_to object OR reply object OR context)
const normalizeReplyFromRaw = (rawMsg) => {
  const replyToObj =
    rawMsg?.reply_to && typeof rawMsg.reply_to === "object"
      ? rawMsg.reply_to
      : null;
  const reply_to =
    (replyToObj?.id ?? null) ||
    rawMsg?.reply_to || // لو id مباشرة
    rawMsg?.replyTo ||
    rawMsg?.reply_id ||
    rawMsg?.context?.id ||
    rawMsg?.context?.message_id ||
    null;
  const replyRaw =
    (rawMsg?.reply && typeof rawMsg.reply === "object" ? rawMsg.reply : null) ||
    (replyToObj ? replyToObj : null) ||
    rawMsg?.context?.quoted_message ||
    null;

  const reply = replyRaw
    ? {
        id: replyRaw?.id ?? reply_to ?? null,
        author: replyRaw?.author ?? replyRaw?.from ?? replyRaw?.sender ?? null,
        type: replyRaw?.type ?? "text",
        text:
          // حالات مختلفة للبودي
          (typeof replyRaw?.text === "string" && replyRaw.text) ||
          (typeof replyRaw?.body === "string" && replyRaw.body) ||
          (typeof replyRaw?.body?.text === "string" && replyRaw.body.text) ||
          (typeof replyRaw?.body?.text?.body === "string" &&
            replyRaw.body.text.body) ||
          (typeof replyRaw?.caption === "string" && replyRaw.caption) ||
          "",
      }
    : null;

  return {
    reply_to: reply_to != null ? String(reply_to) : null,
    reply,
  };
};

const DEBUG_WS = true;
const WS_BASE_OVERRIDE =
  (typeof process !== "undefined" &&
    process.env &&
    typeof process.env.REACT_APP_WS_BASE === "string" &&
    process.env.REACT_APP_WS_BASE.replace(/\/+$/, "")) ||
  undefined;

export default function Chats() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const isRTL = typeof document !== "undefined" && document.dir === "rtl";

  // ===== Redux selects =====
  const sliceItems = useSelector(selectConversationList);
  const convLoading = useSelector(selectConversationLoading);
  const convError = useSelector(selectConversationError);
  const params = useSelector(selectConversationParams);
  const access = useSelector((s) => s.auth?.access);
  const meId = useSelector((s) => s.auth?.user?.id || null);
  const meUsername = useSelector((s) => s.auth?.user?.username || null);
  const authUser = useSelector((s) => s.auth?.user || null);
  const users = useSelector(selectUsersProjected);
  const [replyTarget, setReplyTarget] = useState(null);
  const clientMsgId = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const isAdmin = useMemo(() => {
    const r = (authUser?.role || "").toLowerCase();
    return (
      authUser?.is_superuser ||
      authUser?.is_staff ||
      ["admin", "superadmin", "owner", "manager"].includes(r)
    );
  }, [authUser]);

  // ===== Local state =====
  const [selectedChat, setSelectedChat] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [dateFilter, setDateFilter] = useState("");
  const phoneSearchRes = useSelector(selectCustomerByPhoneResult);
  const phoneSearchErr = useSelector(selectCustomerByPhoneError);

  const wsRef = useRef(null);
  const [allList, setAllList] = useState([]);
  const firstLoadDone = useRef(false);
  const [myIdSet, setMyIdSet] = useState(new Set());
  const messagesPrefetchedRef = useRef(new Set());

  const messages = useSelector((s) =>
    selectMessagesByConv(s, String(selectedChat)),
  );

  // الحالة الحقيقية من الـ slice
  const rawMessagesLoading = useSelector((s) =>
    selectMessagesLoading(s, String(selectedChat)),
  );

  // هنعتبره loading بس لو مفيش رسائل لسه
  const messagesLoading =
    rawMessagesLoading && (!messages || messages.length === 0);

  const messagesError = useSelector((s) =>
    selectMessagesError(s, String(selectedChat)),
  );
  const lastISO = useSelector((s) =>
    selectLastTsByConv(s, String(selectedChat)),
  );

  const isSending = useSelector((s) =>
    selectIsSendingByConv(s, String(selectedChat)),
  );
  const closeOpenBtn = useSelector((s) =>
    selectedChat
      ? selectCloseOpenButton(s, selectedChat)
      : {
          label: t("close_chat.button"),
          className: "px-3 py-1 rounded-lg bg-red-600 text-white",
        },
  );
  const isUpdatingThis = useSelector((s) =>
    selectedChat ? selectIsUpdatingStatus(s, selectedChat) : false,
  );
  const subStatusesClosed = useSelector(selectSubStatusesClosed);
  const subStatusesLoading = useSelector(selectSubStatusesLoading);
  const subStatusesError = useSelector(selectSubStatusesError);

  // ===== UI: menus/modals =====
  const [closeMenuOpen, setCloseMenuOpen] = useState(false);
  const [selectedSubStatusId, setSelectedSubStatusId] = useState(null);
  const subMenuRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assigningTo, setAssigningTo] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [tlTab, setTlTab] = useState("assign");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const tl = useSelector((s) => selectTimelineState(s, selectedChat));
  const unreadItems = useSelector(selectUnreadItems);
  const unreadCount = useSelector(selectUnreadItemsCount);
  const unreadLoading = useSelector(selectUnreadLoading);

  // ===== Scroll refs =====
  const messagesWrapRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    const wrap = messagesWrapRef.current;
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    const end = messagesEndRef.current;
    if (end?.scrollIntoView) {
      try {
        end.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
      } catch {
        end.scrollIntoView();
      }
    }
  };

  // ✅ customerId resolved from API when not present in list
  const [resolvedCustomerId, setResolvedCustomerId] = useState(null);
  function getSelectedCustomerId() {
    const convId = String(selectedChat || "");
    if (!convId) return null;

    const fromList =
      allList.find((c) => String(c.id) === convId) ||
      (sliceItems || []).find((c) => String(c.id) === convId) ||
      null;

    const cid =
      fromList?.customer?.id ??
      fromList?.customer_id ??
      fromList?.customer?.customer_id ??
      fromList?.customer?.customerId ??
      null;

    return cid != null ? String(cid) : null;
  }

  // ✅ final customerId used by Comments (resolved overrides list)
  const customerIdForComments = useMemo(() => {
    return resolvedCustomerId || getSelectedCustomerId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCustomerId, selectedChat, allList, sliceItems]);

  // ✅ when change chat reset resolved id
  useEffect(() => {
    setResolvedCustomerId(null);
  }, [selectedChat]);

  // ✅ ensure customerId exists (fetch conversation if missing)
  async function ensureCustomerId() {
    let cid = getSelectedCustomerId();
    if (cid) return cid;

    if (!selectedChat) return null;

    try {
      const { data } = await api.get(`/conversations/${String(selectedChat)}/`);

      cid =
        data?.customer?.id ??
        data?.customer_id ??
        data?.customer?.customer_id ??
        data?.customer?.customerId ??
        null;

      if (cid != null) {
        const cidStr = String(cid);
        setResolvedCustomerId(cidStr);

        // optional: update redux so next time it's already there
        if (data) dispatch(wsUpsertConversation(data));

        return cidStr;
      }
    } catch (e) {
      console.warn("ensureCustomerId failed", e);
    }

    return null;
  }

  // ===== Cleanup on unmount =====
  useEffect(() => {
    return () => {
      setSelectedChat(null);
      dispatch(setSelectedConversationId(null));
    };
  }, [dispatch]);

  // ✅ Hub WebSocket (/ws/agent/)
  useEffect(() => {
    if (!access) {
      dispatch(stopConversationsWS());
      return;
    }

    dispatch(
      startConversationsWS({
        token: access,
        base: WS_BASE_OVERRIDE,
      }),
    );

    return () => {
      dispatch(stopConversationsWS());
    };
  }, [access, dispatch]);

  useEffect(() => {
    if (
      closeMenuOpen &&
      (!subStatusesClosed || subStatusesClosed.length === 0)
    ) {
      dispatch(fetchSubStatuses()).catch(() => {});
    }
  }, [closeMenuOpen, subStatusesClosed?.length, dispatch]);

  useEffect(() => {
    setCloseMenuOpen(false);
    setSelectedSubStatusId(null);
    setReplyTo(null);
  }, [selectedChat]);

  useEffect(() => {
    function onDocClick(e) {
      if (!subMenuRef.current) return;
      if (!subMenuRef.current.contains(e.target)) setCloseMenuOpen(false);
    }
    if (closeMenuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [closeMenuOpen]);

  // ===== Users filtering =====
  const filteredUsers = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q),
    );
  }, [users, assigneeQuery]);

  async function handleAssignTo(user) {
    if (!selectedChat || !user?.id) return;

let customerId = resolvedCustomerId || getSelectedCustomerId();
    if (!customerId) {
      try {
        const { data } = await api.get(
          `/conversations/${String(selectedChat)}/`,
        );
        customerId =
          data?.customer?.id ??
          data?.customer_id ??
          data?.customer?.customer_id ??
          null;

        if (customerId != null) customerId = String(customerId);

        // (اختياري) خزّني التحديث في السلايس عشان بعد كده يبقى موجود
        if (data) dispatch(wsUpsertConversation(data));
      } catch (e) {
        console.warn("Failed to fetch conversation for customerId", e);
      }
    }

    if (!customerId) {
      console.warn(
        "Assign aborted: no customerId for selected chat",
        selectedChat,
      );
      return;
    }

    setAssigningTo(user.id);

    try {
      const resWrap = await dispatch(
        assignConversation({
          customerId,
          userId: user.id,
        }),
      ).unwrap();

      const res = resWrap?.data || resWrap;

      const assignedName =
        res?.assigned_to?.username ||
        res?.assigned_to?.name ||
        user.name ||
        user.username ||
        `User-${user.id}`;

      // (اختياري) UI list update — تفضلي أو شيليه لو مش محتاجة
      setAllList((prev) =>
        sortByLatestDesc(
          prev.map((x) => {
            const xCustomerId =
              x?.customer?.id ??
              x?.customer_id ??
              x?.customer?.customer_id ??
              null;
            return String(xCustomerId) === String(customerId)
              ? { ...x, assigned_to: assignedName }
              : x;
          }),
        ),
      );

      dispatch(
        wsAssignedChanged({
          customer_id: customerId,
          assigned_to: assignedName,
        }),
      );

      setMenuOpen(false);
    } catch (e) {
      console.warn("Assign failed", e);
    } finally {
      setAssigningTo(null);
    }
  }

  // ===== Hydrate previews (last message) =====
  const MAX_HYDRATE = 30; // 👈 هنجيب lastMessage لأول 30 محادثة بس

  async function hydrateLastMessages(items) {
    // اختار المحادثات اللي مافيهاش lastMessage لسه
    const targets = items
      .filter((x) => !x.lastMessage || !x.lastMessage.trim())
      .slice(0, MAX_HYDRATE)
      .map((x) => x.id);

    if (!targets.length) return;

    const beforeISO = new Date().toISOString();

    await Promise.allSettled(
      targets.map(async (cid) => {
        try {
          const { data } = await api.get(`/conversations/${cid}/messages/`, {
            params: { limit: 1, before: beforeISO },
          });
          const list = Array.isArray(data?.messages)
            ? data.messages
            : Array.isArray(data?.results)
              ? data.results
              : [];
          if (!list.length) return;
          const last = list[list.length - 1];
          const text = extractText(last) || "";
          const when =
            last?.timestamp || last?.ts || last?.created_at || Date.now();

          setAllList((prev) => {
            const next = prev.map((x) =>
              String(x.id) === String(cid)
                ? {
                    ...x,
                    lastMessage: text || x.lastMessage,
                    time: formatTime(when),
                    _updated_at: when,
                  }
                : x,
            );
            return sortByLatestDesc(next);
          });
        } catch {
          // ignore
        }
      }),
    );
  }

  // ===== First load =====
  useEffect(() => {
    async function loadAll() {
      try {
        const [assignedResp, unResp, myResp, closedResp] = await Promise.all([
          dispatch(
            fetchConversations({
              filter: "assigned",
              page: 1,
              page_size: params.page_size,
            }),
          ).unwrap(),
          dispatch(
            fetchConversations({
              filter: "unassigned",
              page: 1,
              page_size: params.page_size,
            }),
          ).unwrap(),
          dispatch(
            fetchConversations({
              filter: "my",
              page: 1,
              page_size: params.page_size,
            }),
          ).unwrap(),
          dispatch(
            fetchConversations({
              filter: "closed",
              page: 1,
              page_size: params.page_size,
            }),
          ).unwrap(),
        ]);

        const listAssigned = (assignedResp?.results || []).map(
          mapConversationApiToUI,
        );
        const listUn = (unResp?.results || []).map(mapConversationApiToUI);
        const listMy = (myResp?.results || []).map(mapConversationApiToUI);
        const listClosed = (closedResp?.results || []).map(
          mapConversationApiToUI,
        );

        const mergedOnce = [
          ...listAssigned,
          ...listUn,
          ...listMy,
          ...listClosed,
        ];

        setAllList((prev) =>
          sortByLatestDesc(
            mergeListsKeepUnread(prev, mergedOnce, selectedChat),
          ),
        );
        setMyIdSet(new Set(listMy.map((x) => String(x.id))));
        hydrateLastMessages(mergedOnce); // HYDRATE محدود
      } catch {
        // convError هيتعرض في الـ UI
      } finally {
        firstLoadDone.current = true;
      }
    }
    if (!firstLoadDone.current) loadAll();
  }, [dispatch, params.page_size, selectedChat]);

  // ===== Load users first time =====
  useEffect(() => {
    dispatch(fetchUsers()).catch(() => {});
  }, [dispatch]);

  // ===== Any slice update -> UI list =====
  useEffect(() => {
    if (!Array.isArray(sliceItems)) return;
    const mapped = sliceItems.map(mapConversationApiToUI);
    setAllList((prev) =>
      sortByLatestDesc(mergeListsKeepUnread(prev, mapped, selectedChat)),
    );
    const needHydrate = mapped.some(
      (c) => !c.lastMessage || !c.lastMessage.trim(),
    );
    if (needHydrate) hydrateLastMessages(mapped);
  }, [sliceItems, selectedChat]);

  // ===== Sync status/sub_status/unread from Redux =====
  useEffect(() => {
    if (!sliceItems || sliceItems.length === 0) return;

    const mapById = new Map(sliceItems.map((c) => [String(c.id), c]));

    setAllList((prev) =>
      sortByLatestDesc(
        prev.map((x) => {
          const m = mapById.get(String(x.id));
          if (!m) return x;

          // unread من الـ slice
          const unreadFromSlice = Number(m.unread_count ?? m.unread ?? 0);
          // unread الحالي في الليست
          const unreadFromList = Number(x.unread ?? x.unread_count ?? 0);

          // ما نزودش العداد من الـ slice، بس لو الـ slice أقل (حد تاني قرأ) ناخده
          const unread =
            unreadFromSlice < unreadFromList ? unreadFromSlice : unreadFromList;

          return {
            ...x,
            status: m.status ?? x.status,
            sub_status: m.sub_status ?? x.sub_status,
            unread,
            unread_count: unread,
          };
        }),
      ),
    );
  }, [sliceItems]);

  const handleFilterChange = (next) => setFilter(next);

  useEffect(() => {
    if (filter !== "unread") return;
    dispatch(fetchUnreadConversations()).catch(() => {});
  }, [filter, dispatch]);

  // ===== Helpers للتاريخ الخاص بالفلتر =====
  const extractRawDate = (src) => {
    if (!src) return null;
    if (typeof src === "string") {
      const m = src.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
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
  };

  // يوم المحادثة اللي هنستخدمه في الفلترة
  const getChatDay = (chat) => {
    const src =
      chat?.conversationDateRaw ||
      chat?.created_at || // من الـ API
      chat?.last_message_at ||
      chat?.updated_at ||
      chat?._updated_at ||
      chat?.customer_created_at ||
      chat?.customer?.created_at ||
      null;

    return extractRawDate(src);
  };

  // ===== Stats for date filter (على كل المحادثات) =====
  const chatsOnThisDayCount = useMemo(() => {
    if (!dateFilter) return 0;
    return allList.filter((c) => getChatDay(c) === dateFilter).length;
  }, [allList, dateFilter]);

  const uniqueCustomersCount = useMemo(() => {
    if (!dateFilter) return 0;
    const set = new Set();
    allList.forEach((c) => {
      if (getChatDay(c) !== dateFilter) return;
      const cid = c?.customer?.id ?? c?.customer_id;
      if (cid != null) set.add(String(cid));
    });
    return set.size;
  }, [allList, dateFilter]);

  // ===== قائمة الشات حسب التاب + البحث (من غير تاريخ) =====
  const listForTab = useMemo(() => {
    const norm = (c) => String(c?.status || "").toLowerCase();

    const matchesTab = (c) => {
      if (filter === "unassigned") {
        return !c.assigned_to && norm(c) !== "closed";
      }
      if (filter === "my") {
        return myIdSet.has(String(c.id)) && norm(c) !== "closed";
      }
      if (filter === "closed") {
        return norm(c) === "closed";
      }

      // filter === "all" → استبعد المحادثات المغلقة
      return norm(c) !== "closed";
    };

    let base = allList.filter(matchesTab);

    const q = String(query || "")
      .trim()
      .toLowerCase();
    if (q) {
      base = base.filter((c) => (c.name || "").toLowerCase().includes(q));
    }

    return base;
  }, [allList, filter, myIdSet, query]);

  const selectedChatData =
    listForTab.find((c) => String(c.id) === String(selectedChat)) ||
    allList.find((c) => String(c.id) === String(selectedChat));

  // ===== Open chat =====
  function openChat(chat) {
    const idStr = String(chat.id);
    setSelectedChat(idStr);
    dispatch(setSelectedConversationId(idStr));
    dispatch(setUnreadZero(idStr));
    setAllList((prev) =>
      sortByLatestDesc(
        prev.map((x) => (String(x.id) === idStr ? { ...x, unread: 0 } : x)),
      ),
    );
    dispatch(markConversationRead({ conversationId: idStr })).catch(() => {});
    api
      .get(`/conversations/${idStr}/`)
      .then((res) => {
        if (res?.data) dispatch(wsUpsertConversation(res.data));
      })
      .catch(() => {});
  }

  // ===== Ensure selected chat exists in store =====
  useEffect(() => {
    if (!selectedChat) return;
    const exists = (sliceItems || []).some(
      (c) => String(c.id) === String(selectedChat),
    );
    if (!exists) {
      api
        .get(`/conversations/${selectedChat}/`)
        .then((res) => {
          if (res?.data) dispatch(wsUpsertConversation(res.data));
        })
        .catch(() => {});
    }
  }, [selectedChat, sliceItems, dispatch]);

  // ===== Prefetch messages for first few chats to reduce initial "Loading..." =====
  useEffect(() => {
    if (!Array.isArray(allList) || allList.length === 0) return;

    // 👈 هنسبق ونجلب الرسائل لأول 20 محادثة بس بدل 100
    const firstFew = allList.slice(0, 20);

    firstFew.forEach((chat) => {
      const cid = chat?.id != null ? String(chat.id) : null;
      if (!cid) return;

      if (messagesPrefetchedRef.current.has(cid)) return;
      messagesPrefetchedRef.current.add(cid);

      dispatch(
        fetchMessages({
          id: cid,
          limit: 50,
          opened: false,
        }),
      ).catch(() => {});
    });
  }, [allList, dispatch]);

  // ===== Load messages for opened chat (with cache) =====
  useEffect(() => {
    setDraft("");
    if (!selectedChat) return;

    const cid = String(selectedChat);
    const hasAnyMessages = Array.isArray(messages) && messages.length > 0;
    const last = lastISO || null;

    // 1) أول مرة افتح المحادثة → مفيش رسائل في الكاش
    if (!hasAnyMessages) {
      dispatch(fetchMessages({ id: cid, limit: 1000, opened: true }))
        .unwrap()
        .then((res) => {
          const list = Array.isArray(res?.items) ? res.items : [];
          if (list.length) {
            const lastMsg = list[list.length - 1];
            const text = extractText(lastMsg) || "";
            const when =
              lastMsg?.timestamp ||
              lastMsg?.ts ||
              lastMsg?.created_at ||
              Date.now();

            setAllList((prev) => {
              const next = prev.map((x) =>
                String(x.id) === cid
                  ? {
                      ...x,
                      lastMessage: text,
                      time: formatTime(when),
                      _updated_at: when,
                      unread: 0,
                    }
                  : x,
              );
              return sortByLatestDesc(next);
            });
          }
        })
        .finally(() => {
          setAllList((prev) =>
            sortByLatestDesc(
              prev.map((x) => (String(x.id) === cid ? { ...x, unread: 0 } : x)),
            ),
          );
          requestAnimationFrame(() => scrollToBottom(false));
        });

      return;
    }

    // 2) سبق واتفتحت وفي رسائل في الكاش → اعرض فورًا وجيب الجديد بس
    if (last) {
      dispatch(
        fetchNewer({
          id: cid,
          limit: 50,
          afterISO: last,
          opened: true,
        }),
      );
    }

    requestAnimationFrame(() => scrollToBottom(false));
  }, [selectedChat, dispatch, messages.length, lastISO]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Room WS (/ws/chat/<id>/) – استقبال و إرسال في نفس الغرفة =====
  useEffect(() => {
    if (!selectedChat || !access) return;

    if (wsRef.current) {
      try {
        wsRef.current.disconnect();
      } catch {}
      wsRef.current = null;
    }

    const wsRoomId = String(selectedChat);
    const client = new ChatSocket(String(wsRoomId), access, {
      base: WS_BASE_OVERRIDE,
      onOpen: () => {
        if (DEBUG_WS) console.log(`[WS] connected to room ${wsRoomId}`);
      },
      onClose: () => {
        if (DEBUG_WS) console.log("[WS] closed for conversation", wsRoomId);
      },
      onEvent: (eventName, payload) => {
        if (DEBUG_WS) console.log("[WS Room event]", eventName, payload);
        const ev = String(eventName || payload?.event || "").toLowerCase();
        const data =
          payload &&
          typeof payload === "object" &&
          payload.data &&
          typeof payload.data === "object"
            ? payload.data
            : payload;

        switch (ev) {
          case "ack":
          case "system":
          case "pong":
          case "ping":
            return;

          // رسالة جديدة
          case "message:new":
          case "message":
          case "message_created":
          case "message:created":
          case "auto_response": {
            const rawMsg = data?.last_message || data?.message || data || {};
            const { reply_to, reply } = normalizeReplyFromRaw(rawMsg);

            const convId = String(
              rawMsg?.conversation_id ??
                rawMsg?.conversation ??
                data?.conv_id ??
                data?.conversation_id ??
                wsRoomId ??
                "",
            );
            if (!convId) return;

            const text =
              extractText(rawMsg) ||
              rawMsg?.caption ||
              rawMsg?.body?.caption ||
              "";

            const when =
              rawMsg?.timestamp ||
              rawMsg?.ts ||
              rawMsg?.created_at ||
              data?.last_message_at ||
              data?.timestamp ||
              data?.created_at ||
              Date.now();

            // تحديد هل من الـ agent ولا من العميل
            let fromAgent = false;
            try {
              const authorId =
                rawMsg?.author_id ??
                rawMsg?.user?.id ??
                rawMsg?.agent?.id ??
                rawMsg?.sender_id ??
                null;
              const authorIdStr = authorId != null ? String(authorId) : null;

              const authorName = String(
                rawMsg?.user?.username ||
                  rawMsg?.user?.name ||
                  rawMsg?.agent?.username ||
                  rawMsg?.agent?.name ||
                  rawMsg?.sender_name ||
                  "",
              ).toLowerCase();

              const role = String(
                rawMsg?.sender_role || rawMsg?.role || "",
              ).toLowerCase();

              const senderType = String(
                rawMsg?.sender_type || rawMsg?.from || "",
              ).toLowerCase();

              fromAgent =
                rawMsg?.from_me === true ||
                rawMsg?.is_from_me === true ||
                role === "agent" ||
                senderType === "agent" ||
                (meId && authorIdStr && authorIdStr === String(meId)) ||
                (meUsername &&
                  authorName &&
                  authorName === String(meUsername).toLowerCase());
            } catch {
              fromAgent = false;
            }

            const baseMsg = {
              ...rawMsg,
              conversation_id: convId,
              conversation: convId,
              text,
              timestamp: when,
              from_me: fromAgent,
              is_from_me: fromAgent,
              outbound: fromAgent,
              inbound: !fromAgent,
              direction: fromAgent ? "out" : "in",
              sender: fromAgent ? "agent" : "customer",
              sender_role: rawMsg?.sender_role
                ? rawMsg.sender_role
                : fromAgent
                  ? "agent"
                  : "customer",

              reply_to,
              reply,
            };

            // ✅ تحديث ChatList
            dispatch(wsIncomingMessage(baseMsg));

            // ✅ إدخال الرسالة فى الـ messagesSlice
            const isActive = String(selectedChat || "") === convId;
            dispatch(
              wsMessageReceived({
                message: baseMsg,
                isActive,
              }),
            );

            // ✅ resolveMediaUrl لو فى media_id من غير URL
            const mediaId =
              baseMsg?.media_id ||
              baseMsg?.media?.id ||
              baseMsg?.body?.media_id ||
              baseMsg?.body?.media?.id;

            const mediaUrl =
              baseMsg?.media_url ||
              baseMsg?.media_url_full ||
              baseMsg?.file_url ||
              baseMsg?.body?.media_url ||
              baseMsg?.body?.file_url ||
              null;

            if (mediaId && !mediaUrl) {
              dispatch(
                resolveMediaUrl({
                  conversationId: convId,
                  messageId: baseMsg?.id,
                  client_msg_id: baseMsg?.client_msg_id,
                  mediaId,
                }),
              );
            }

            break;
          }

          // تحديث حالة الرسالة
          case "message:status":
          case "status":
          case "message_status": {
            const payloadData =
              payload && payload.data ? payload.data : payload;

            const convId = String(
              payloadData?.conversation_id ??
                payloadData?.conversation ??
                wsRoomId ??
                "",
            );

            dispatch(
              wsMessageStatusUpdated({
                ...payloadData,
                conversation_id: convId,
                conversation: convId,
              }),
            );
            break;
          }

          default:
            if (DEBUG_WS) console.log("[WS Room] unhandled event", ev, data);
        }
      },
      onError: (e) => {
        if (DEBUG_WS) console.warn("[WS] error", e);
      },
    });

    client.connect();
    wsRef.current = client;

    if (typeof window !== "undefined") {
      window.__CHAT_SOCKETS__ = window.__CHAT_SOCKETS__ || {};
      window.__CHAT_SOCKETS__[wsRoomId] = client;
    }

    return () => {
      try {
        client.disconnect();
      } catch {}
      wsRef.current = null;

      if (typeof window !== "undefined" && window.__CHAT_SOCKETS__) {
        delete window.__CHAT_SOCKETS__[wsRoomId];
      }

      if (DEBUG_WS) console.log("[WS] closed for conversation", wsRoomId);
    };
  }, [selectedChat, access, dispatch, meId, meUsername]);

  const statusLabel = (s) =>
    s === "online"
      ? t("status.online")
      : s === "away"
        ? t("status.away")
        : t("status.offline");

  const visibleMessages = useMemo(() => {
    return (messages || [])
      .filter((m) => {
        const textLower = (extractText(m) || m?.text || "").toLowerCase();
        if (/^welcome!?\s+you are connected to customer/.test(textLower))
          return false;
        return true;
      })
      .map((m) => {
        const author_id =
          m?.author_id ??
          m?.user?.id ??
          m?.raw?.user?.id ??
          m?.agent?.id ??
          null;

        const author_username =
          m?.author_username ||
          m?.user?.username ||
          m?.user?.name ||
          m?.raw?.user?.username ||
          m?.agent?.username ||
          m?.agent?.name ||
          m?.sender_name ||
          null;

        const dir = String(
          m?.direction || m?.direction_type || m?.message_direction || "",
        ).toLowerCase();

        const outboundServer =
          m?.outbound === true ||
          m?.is_outbound === true ||
          dir === "outbound" ||
          dir === "out";

        const role =
          typeof m?.sender_role === "string" ? m.sender_role.toLowerCase() : "";

        const senderStr =
          typeof m?.sender === "string" ? m.sender.toLowerCase() : "";

        const senderType =
          typeof m?.sender_type === "string" ? m.sender_type.toLowerCase() : "";

        const isMine =
          m?.from_me === true ||
          m?.is_from_me === true ||
          outboundServer ||
          role === "agent" ||
          senderStr === "agent" ||
          senderType === "agent" ||
          (meId && author_id != null && String(author_id) === String(meId)) ||
          (meUsername &&
            author_username &&
            String(author_username).toLowerCase() ===
              String(meUsername).toLowerCase());

        return {
          ...m,
          author_id,
          author_username,
          text: extractText(m) || m?.text || "",
          isMine,
          from_me: isMine || m?.from_me,
          is_from_me: isMine || m?.is_from_me,
          outbound: isMine || m?.outbound,
          inbound: !isMine && (m?.inbound ?? !isMine),
          direction: isMine ? dir || "out" : dir || "in",
          sender: m?.sender || (isMine ? "agent" : "customer"),
          sender_role: m?.sender_role || (isMine ? "agent" : "customer"),
        };
      });
  }, [messages, meId, meUsername]);

  // ===== Auto scroll on new messages =====
  useEffect(() => {
    if (!selectedChat || messagesLoading) return;
    scrollToBottom(true);
  }, [visibleMessages.length, selectedChat, messagesLoading]);

  // ===== Send =====
  function handleSend(textArg, meta = {}) {
    const text = String(textArg ?? draft ?? "").trim();
    if (!text || !selectedChat) return;

    const cid = String(selectedChat);
    const optimisticAt = new Date().toISOString();

    // ✅ لكل رسالة client_msg_id مختلف
    const client_msg_id =
      meta?.client_msg_id ||
      `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const reply_to = meta?.reply_to ? String(meta.reply_to) : null;
    const reply =
      meta?.reply && typeof meta.reply === "object" ? meta.reply : null;

    // ✅ optimistic داخل الـ messagesSlice (عشان preview يظهر فورًا حتى قبل WS يرجع)
    dispatch(
      wsMessageReceived({
        isActive: true,
        message: {
          id: client_msg_id, // id مؤقت
          client_msg_id,
          conversation_id: cid,
          conversation: cid,
          sender: "agent",
          sender_role: "agent",
          direction: "out",
          text,
          body: { text },
          status: "sending",
          ts: optimisticAt,
          created_at: optimisticAt,
          timestamp: optimisticAt,
          from_me: true,
          is_from_me: true,

          // ✅ reply fields for UI
          reply_to,
          reply,
        },
      }),
    );

    // ✅ تحديث ChatList preview
    setAllList((prev) =>
      bumpConv(prev, cid, (c) => ({
        ...c,
        lastMessage: text,
        time: formatTime(optimisticAt),
        unread: 0,
        _updated_at: optimisticAt,
      })),
    );

    // ✅ أرسل عبر WS (مع reply_to)
    let sentViaWS = false;
    if (wsRef.current && typeof wsRef.current.sendText === "function") {
      try {
        wsRef.current.sendText(text, {
          author_id: meId ?? undefined,
          author_username: meUsername ?? undefined,
          sender_role: "agent",
          client_msg_id,

          // ✅ أهم سطرين
          reply_to: reply_to || undefined,
        });
        sentViaWS = true;
      } catch (e) {
        console.warn("WS sendText failed, will fallback to API", e);
      }
    }

    // fallback API
    if (!sentViaWS) {
      dispatch(
        sendMessage({
          conversationId: cid,
          text,
          type: "text",
          client_msg_id,
          reply_to,
          reply, // للـ UI
          meId,
          meUsername,
        }),
      ).catch(() => {});
    }

    requestAnimationFrame(() => scrollToBottom(true));
  }

  function retrySend(msg) {
    const text = (extractText(msg) || asTextSafe(msg?.text || "")).trim();
    if (!text || !selectedChat) return;

    const cid = String(selectedChat);
    const nowISO = new Date().toISOString();

    const client_msg_id = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // reply لو الرسالة كانت reply
    const { reply_to, reply } = normalizeReplyFromRaw(msg);

    // optimistic
    dispatch(
      wsMessageReceived({
        isActive: true,
        message: {
          id: client_msg_id,
          client_msg_id,
          conversation_id: cid,
          conversation: cid,
          sender: "agent",
          sender_role: "agent",
          direction: "out",
          text,
          body: { text },
          status: "sending",
          ts: nowISO,
          created_at: nowISO,
          timestamp: nowISO,
          from_me: true,
          is_from_me: true,
          reply_to,
          reply,
        },
      }),
    );

    // تحديث ChatList
    setAllList((prev) =>
      bumpConv(prev, cid, (c) => ({
        ...c,
        lastMessage: text,
        time: formatTime(nowISO),
        unread: 0,
        _updated_at: nowISO,
      })),
    );

    // WS first
    let sentViaWS = false;
    if (wsRef.current && typeof wsRef.current.sendText === "function") {
      try {
        wsRef.current.sendText(text, {
          author_id: meId ?? undefined,
          author_username: meUsername ?? undefined,
          sender_role: "agent",
          client_msg_id,
          reply_to: reply_to || undefined,
        });
        sentViaWS = true;
      } catch (e) {
        console.warn("WS retry sendText failed, fallback to API", e);
      }
    }

    if (!sentViaWS) {
      dispatch(
        sendMessage({
          conversationId: cid,
          text,
          type: "text",
          client_msg_id,
          reply_to,
          reply,
          meId,
          meUsername,
        }),
      ).catch(() => {});
    }

    requestAnimationFrame(() => scrollToBottom(true));
  }

  // ===== Update ChatList with last message from visibleMessages =====
  useEffect(() => {
    if (!selectedChat) return;

    const list = Array.isArray(visibleMessages) ? visibleMessages : [];
    if (!list.length) return;

    const last = list[list.length - 1];
    const text = extractText(last) || asTextSafe(last?.text) || "";
    const when = last?.timestamp || last?.ts || last?.created_at || Date.now();

    setAllList((prev) => {
      let changed = false;
      const next = prev.map((x) => {
        if (String(x.id) !== String(selectedChat)) return x;
        const sameText =
          (x.lastMessage && x.lastMessage === text) ||
          (x.last_message && x.last_message.text === text);
        const sameTime =
          (x.last_message && x.last_message.timestamp === when) ||
          x._updated_at === when;
        if (sameText && sameTime && x.unread === 0) {
          return x;
        }
        changed = true;
        return {
          ...x,
          lastMessage: text,
          time: formatTime(when),
          unread: 0,
          _updated_at: when,
        };
      });
      if (!changed) return prev;
      return sortByLatestDesc(next);
    });
  }, [selectedChat, visibleMessages.length]);

  // ===== Close/Open =====
  function handleToggleStatus() {
    if (!selectedChat) return;
    const wantsClose = closeOpenBtn.label.includes("إغلاق");

    if (wantsClose) {
      if (!selectedSubStatusId) {
        setCloseMenuOpen(true);
        if (!subStatusesClosed || subStatusesClosed.length === 0) {
          dispatch(fetchSubStatuses()).catch(() => {});
        }
        return;
      }
      dispatch(
        toggleConversationStatus({
          conversationId: String(selectedChat),
          subStatusId: selectedSubStatusId,
        }),
      )
        .unwrap()
        .then((res) => {
          if (res?.data) dispatch(wsUpsertConversation(res.data));
          setCloseMenuOpen(false);
          setSelectedSubStatusId(null);
        })
        .catch(() => {});
    } else {
      dispatch(
        toggleConversationStatus({ conversationId: String(selectedChat) }),
      )
        .unwrap()
        .then((res) => {
          if (res?.data) dispatch(wsUpsertConversation(res.data));
        })
        .catch(() => {});
    }
  }

  // ===== Phone lookup =====
  function tryPhoneLookup() {
    const q = String(query || "").trim();
    if (!q) return;
    if (!looksLikePhone(q)) return;
    setFilter("all");
    dispatch(searchCustomerByPhone(q));
  }

  useEffect(() => {
    if (!phoneSearchRes) return;

    const conv = phoneSearchRes.conversation;
    const cust = phoneSearchRes.customer;
    setFilter("all");
    if (conv?.id) {
      const mapped = mapConversationApiToUI(conv);
      setAllList((prev) =>
        sortByLatestDesc(mergeListsKeepUnread(prev, [mapped], selectedChat)),
      );

      const phone =
        conv?.customer?.phone_e164 ||
        conv?.customer?.wa_id ||
        conv?.conversation_id ||
        "";
      if (phone) setQuery(String(phone));

      dispatch(clearCustomerPhoneSearch());
    } else if (cust?.id) {
      const phone = cust.phone_e164 || cust.wa_id || cust.conversation_id || "";
      if (phone) setQuery(String(phone));
      dispatch(clearCustomerPhoneSearch());
    }
  }, [phoneSearchRes, dispatch, selectedChat]);

  // ===== Reset panels when selectedChat changes =====
  useEffect(() => {
    setCommentsOpen(false);
    setTimelineOpen(false);
    setTlTab("assign");
  }, [selectedChat]);

  // ===== Lazy load timelines/comments =====
  useEffect(() => {
    if (!commentsOpen) return;
    if (!customerIdForComments) return;

    dispatch(fetchComments({ customerId: customerIdForComments }));
  }, [commentsOpen, customerIdForComments, dispatch]);
 useEffect(() => {
  if (!selectedChat || !timelineOpen) return;

  const conversationId = String(selectedChat);

let customerId =
  selectedChatData?.customer?.id ||
  selectedChatData?.customer_id ||
  getSelectedCustomerId();

if (!customerId) {
  ensureCustomerId().then((cid) => {
    if (cid) dispatch(fetchTimelineStaff({ customerId: String(cid), conversationId }));
  });
}

    getSelectedCustomerId();

  console.log("conversationId:", conversationId);
  console.log("customerId:", customerId);
  console.log("selectedChatData:", selectedChatData);

  dispatch(fetchTimelineAll({ conversationId }));
  dispatch(fetchTimelineStatus({ conversationId }));
  dispatch(fetchTimelineMessages({ conversationId }));

  // ✅ staff endpoint محتاج customerId
  if (customerId) {
    dispatch(fetchTimelineStaff({ customerId: String(customerId), conversationId }));
  }
}, [timelineOpen, selectedChat, dispatch]);


  const hasMessagesForSelected = Array.isArray(messages) && messages.length > 0;

  const effectiveMessagesLoading = messagesLoading && !hasMessagesForSelected;

  // ===== Render =====
  return (
    <div className="h-[calc(100dvh-80px)] md:h-[calc(100vh-80px)] bg-gray-50 dark:bg-gray-900 min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 overflow-x-hidden items-stretch">
        <ChatList
          t={t}
          isRTL={isRTL}
          filter={filter}
          onFilterChange={handleFilterChange}
          allList={allList}
          myIdSet={myIdSet}
          query={query}
          setQuery={setQuery}
          tryPhoneLookup={tryPhoneLookup}
          phoneSearchErr={phoneSearchErr}
          loading={convLoading}
          error={convError}
          listForTab={listForTab}
          selectedChat={selectedChat}
          onOpenChat={openChat}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          chatsOnThisDayCount={chatsOnThisDayCount}
          uniqueCustomersCount={uniqueCustomersCount}
          currentUsername={meUsername}
          unreadItems={unreadItems}
          unreadCount={unreadCount}
          unreadLoading={unreadLoading}
          onUnreadFetch={() => dispatch(fetchUnreadConversations())}
        />

        <ChatWindow
          isRTL={isRTL}
          t={t}
          selectedChat={selectedChat}
          selectedChatData={selectedChatData}
          statusLabel={statusLabel}
          closeOpenBtn={closeOpenBtn}
          isUpdatingThis={isUpdatingThis}
          onToggleStatus={handleToggleStatus}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onOpenComments={async () => {
            setMenuOpen(false);
            setAssignOpen(false);

            const cid = await ensureCustomerId();
            if (!cid) {
              alert(
                "مش قادره أجيب customerId للمحادثة دي. جرّبي تفتحي المحادثة الأول.",
              );
              return;
            }

            setCommentsOpen(true);
            setAssigneeQuery("");
          }}
          onOpenAssign={() => {
            setMenuOpen(false);
            setAssignOpen(true);
          }}
         onOpenTimeline={async () => {
  setMenuOpen(false);
  setAssignOpen(false);

  // ✅ لازم نجيب customerId قبل فتح التايملاين
  const cid = await ensureCustomerId();
  if (!cid) {
    alert("مش قادره أجيب customerId للمحادثة دي.");
    return;
  }

  setTimelineOpen(true);
}}

          closeMenuOpen={closeMenuOpen}
          subMenuRef={subMenuRef}
          subStatusesLoading={subStatusesLoading}
          subStatusesError={subStatusesError}
          subStatusesClosed={subStatusesClosed}
          selectedSubStatusId={selectedSubStatusId}
          setSelectedSubStatusId={setSelectedSubStatusId}
          setCloseMenuOpen={setCloseMenuOpen}
          messagesError={messagesError}
          messagesLoading={effectiveMessagesLoading}
          visibleMessages={visibleMessages}
          messagesWrapRef={messagesWrapRef}
          messagesEndRef={messagesEndRef}
          onRetrySend={retrySend}
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          isSending={isSending}
          meId={meId}
          meUsername={meUsername}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          onBackToList={() => setSelectedChat(null)}
          replyTarget={replyTarget}
          setReplyTarget={setReplyTarget}
        />
      </div>

      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        customerId={customerIdForComments}
        meId={meId}
        isAdmin={isAdmin}
      />

      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        t={t}
        assigneeQuery={assigneeQuery}
        setAssigneeQuery={setAssigneeQuery}
        filteredUsers={filteredUsers}
        assigningTo={assigningTo}
        onAssign={async (u) => {
          await handleAssignTo(u);
          setAssignOpen(false);
          setAssigneeQuery("");
        }}
      />

      <TimelineDrawer
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        tl={tl}
        tlTab={tlTab}
        setTlTab={setTlTab}
      />
    </div>
  );
}
