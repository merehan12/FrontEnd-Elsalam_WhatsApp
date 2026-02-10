// src/store/slices/conversationsSlice.js
import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import api from "../../api/axios";
import { ConversationsHubWS } from "../../ws/chatSocket";
import { wsMessageStatusUpdated } from "./messagesSlice";

/* ================= WS Hub Instance ================= */
let convHub = null;
let convHubToken = null;
let reconnectTimer = null;
/* ================= Helpers ================= */

// اختيار base للـ WS من env إن وُجد
const WS_BASE_OVERRIDE =
  (typeof process !== "undefined" &&
    process.env &&
    typeof process.env.REACT_APP_WS_BASE === "string" &&
    process.env.REACT_APP_WS_BASE.replace(/\/+$/, "")) ||
  undefined;

// env helper لتخفيف الـ console في production
const IS_PROD =
  typeof process !== "undefined" &&
  process.env &&
  process.env.NODE_ENV === "production";

// كشف نوع الوسائط من أشكال متنوعة
const detectMediaType = (m = {}) => {
  const t =
    String(
      m?.type ||
        m?.body?.type ||
        m?.raw?.body?.type ||
        m?.body?.raw?.type ||
        ""
    ).toLowerCase() ||
    String(m?.body?.raw?.messages?.[0]?.type || "").toLowerCase();
  if (!t) return null;
  if (t.includes("image")) return "image";
  if (t.includes("video")) return "video";
  if (t.includes("audio") || t.includes("voice")) return "audio";
  if (t.includes("document") || t.includes("file")) return "document";
  return null;
};
const mediaLabel = (m = {}) => {
  const k = detectMediaType(m);
  if (!k) return "";
  if (k === "image") return "[📷 صورة]";
  if (k === "video") return "[🎥 فيديو]";
  if (k === "audio") return "[🔊 صوت]";
  if (k === "document") return "[📄 ملف]";
  return "";
};


// Robust text extraction
const extractText = (m = {}) => {
  const direct = [
    m?.text,
    m?.message,
    m?.content,
    m?.preview,
    m?.caption,
    m?.body,
    m?.body?.text,
    m?.body?.message,
    m?.body?.body,
    m?.raw?.text,
    m?.raw?.message,
    m?.payload?.text,
    m?.payload?.message,
    m?.last_message_text,
  ];
  for (const v of direct) {
    if (typeof v === "string" && v.trim()) return v;
    if (
      v &&
      typeof v === "object" &&
      typeof v?.body === "string" &&
      v.body.trim()
    )

      return v.body;
  }

  const wa =
    m?.body?.raw?.text?.body ||
    m?.body?.raw?.message?.text?.body ||
    m?.body?.raw?.messages?.[0]?.text?.body ||
    m?.body?.raw?.messages?.[0]?.caption ||
    m?.body?.raw?.caption ||
    m?.body?.caption ||
    m?.caption ||
    m?.image?.caption ||
    m?.video?.caption ||
    m?.document?.caption;
  if (typeof wa === "string" && wa.trim()) return wa;

  const interactiveTitle =
    m?.body?.raw?.interactive?.button_reply?.title ||
    m?.body?.raw?.interactive?.list_reply?.title ||
    m?.interactive?.button_reply?.title ||
    m?.interactive?.list_reply?.title;
  if (typeof interactiveTitle === "string" && interactiveTitle.trim())
    return interactiveTitle;

  const comps = m?.body?.raw?.template?.components || m?.template?.components;
  if (Array.isArray(comps)) {
    const parts = [];
    for (const c of comps) {
      const ps = c?.parameters;
      if (Array.isArray(ps)) {
        for (const p of ps) {
          const t = p?.text || p?.payload || p?.body;
          if (typeof t === "string" && t.trim()) parts.push(t);
        }
      }
    }
    if (parts.length) return parts.join(" ");
  }

  const arrays =
    m?.messages ||
    m?.body?.messages ||
    m?.body?.raw?.messages ||
    m?.raw?.body?.raw?.messages;
  if (Array.isArray(arrays) && arrays.length) {
    const m0 = arrays[0];
    const fromArray =
      m0?.text?.body ||
      m0?.text ||
      m0?.caption ||
      m0?.message ||
      m0?.body;
    if (typeof fromArray === "string" && fromArray.trim()) return fromArray;
  }

  const entry =
    m?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ||
    m?.raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (entry) {
    const t =
      entry?.text?.body ||
      entry?.button?.text ||
      entry?.interactive?.button_reply?.title ||
      entry?.interactive?.list_reply?.title ||
      entry?.image?.caption ||
      entry?.video?.caption ||
      entry?.document?.caption ||
      entry?.audio?.caption;
    if (typeof t === "string" && t.trim()) return t;
  }

  const quoted =
    m?.context?.quoted_message?.text?.body ||
    m?.context?.quoted_message?.caption;
  if (typeof quoted === "string" && quoted.trim()) return quoted;
  // ✅ Reply preview (backend schema)
  if (typeof m?.reply?.text === "string" && m.reply.text.trim()) {
    return m.reply.text;
  }

  return "";
};

// inbound من العميل فقط
const isInboundFromCustomer = (m = {}) => {
  const dir = String(m.direction || m.dir || "").toLowerCase();
  if (dir.includes("in")) return true;
  if (dir.includes("out")) return false;

  const inboundFlag =
    m?.inbound === true ||
    m?.is_inbound === true ||
    m?.from_customer === true ||
    m?.is_outbound === false;
  const outboundFlag = m?.outbound === true || m?.is_outbound === true;
  if (inboundFlag) return true;
  if (outboundFlag) return false;

  const senderRole = String(
    m?.sender_role || m?.sender || m?.from || ""
  ).toLowerCase();
  if (["agent", "staff", "operator", "admin"].includes(senderRole)) return false;
  if (["customer", "client", "user"].includes(senderRole)) return true;

  if (m?.from_me === true || m?.is_from_me === true || m?.author === "agent")
    return false;

  const type = String(m?.type || m?.event || "").toLowerCase();
  if (["auto_response", "system"].includes(type)) return false;

  return true;
};

// استخراج رقم العميل فقط
const pickNumber = (obj = {}) =>
  obj?.customer?.phone_e164 ??
  obj?.customer?.wa_id ??
  obj?.wa_id ??
  obj?.customer_phone ??
  obj?.phone ??
  obj?.msisdn ??
  obj?.number ??
  null;

/* ================= Thunks ================= */

export const markConversationRead = createAsyncThunk(
  "conversations/markConversationRead",
  async ({ conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `/conversations/${conversationId}/mark-read/`
      );
      return { conversationId: String(conversationId), data };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "فشل تحديث حالة القراءة";
      return rejectWithValue({ conversationId, error: msg });
    }
  }
);
export const fetchConversations = createAsyncThunk(
  "conversations/fetchConversations",
  // مش محتاجين نبعِت filter من الفرونت
  async ({ force = false } = {}, { rejectWithValue }) => {
    try {
      let page = 1;
      let allResults = [];
      let firstPayload = null;
      let guard = 0;

      while (true) {
        const { data } = await api.get("/conversations/", {
          params: {
            filter: "all", // 👈 دايمًا ALL من الباك
            page,
          },
        });

        if (!IS_PROD) {
          // eslint-disable-next-line no-console
          console.log("Conversations API (page)", page, data);
        }

        if (!firstPayload) firstPayload = data;

        const pageResults = Array.isArray(data.results) ? data.results : [];
        allResults = allResults.concat(pageResults);

        const hasNext =
          data.has_next === true ||
          (data.page && data.total_pages && data.page < data.total_pages);

        if (!hasNext) break;

        page += 1;
        guard += 1;
        if (guard > 50) break; // أمان لو حصل لُوب غريب
      }

      const finalPayload = {
        ...(firstPayload || {}),
        results: allResults,
        page: 1,
        page_size: allResults.length,
        total_pages: 1,
        has_next: false,
        filter: "all",
      };

      return finalPayload;
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "فشل تحميل المحادثات";
      return rejectWithValue(msg);
    }
  },
  {
    // ✅ دي أهم إضافة: تمنع إعادة الجلب لما نرجع لنفس الصفحة والداتا موجودة
    condition: ({ force = false } = {}, { getState }) => {
      const s = getState();

      // لو فيه تحميل شغال بالفعل → متبدأش تحميل جديد
      if (s.conversations?.loading) return false;

      const items = s.conversations?.items;

      // لو الداتا موجودة ومش طالب force → متعملش refetch
      if (!force && Array.isArray(items) && items.length > 0) {
        return false;
      }

      return true;
    },
  }
);

export const assignConversation = createAsyncThunk(
  "conversations/assignConversation",
  async ({ customerId, userId }, { rejectWithValue }) => {
    try {
      // ✅ لو baseURL في axios عندك فيه /api بالفعل استخدمي /customer/...
      // ✅ لو baseURL بدون /api يبقى استخدمي /api/customer/...
      const { data } = await api.post(`/customer/${customerId}/assign/`, {
        user_id: userId,
      });

      // المتوقع يرجع: { customer_id: 1, assigned_to: {id, username} }
      return { customerId: String(customerId), data };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "فشل تعيين العميل";
      return rejectWithValue({ customerId, error: msg });
    }
  }
);


export const fetchSubStatuses = createAsyncThunk(
  "conversations/fetchSubStatuses",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/sub-statuses/");
      const grouped = data?.grouped || {};
      return {
        open: Array.isArray(grouped.open) ? grouped.open : [],
        closed: Array.isArray(grouped.closed) ? grouped.closed : [],
        raw: data,
      };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "فشل تحميل Sub-Statuses";
      return rejectWithValue(msg);
    }
  }
);

export const toggleConversationStatus = createAsyncThunk(
  "conversations/toggleConversationStatus",
  async (
    { conversationId, subStatusId = null },
    { getState, rejectWithValue }
  ) => {
    try {
      const idStr = String(conversationId);
      const state = getState();
      const conv = (state.conversations.items || []).find(
        (c) => String(c.id) === idStr
      );

      const isClosed =
        String(conv?.status || "").toLowerCase() === "closed";
      const nextStatus = isClosed ? "open" : "closed";

      const payload =
        nextStatus === "closed"
          ? { status: "closed", sub_status: subStatusId }
          : { status: "open" };

      const { data } = await api.put(`/conversations/${idStr}/`, payload);
      return { conversationId: idStr, data };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "فشل تحديث حالة المحادثة";
      return rejectWithValue({ conversationId, error: msg });
    }
  }
);

export const fetchUnreadConversations = createAsyncThunk(
  "conversations/fetchUnreadConversations",
  async (_, { rejectWithValue }) => {
    try {
      let page = 1;
      let allResults = [];
      let firstPayload = null;
      let guard = 0;

      while (true) {
        const { data } = await api.get("/conversations/", {
          params: { filter: "unread", page },
        });

        if (!firstPayload) firstPayload = data;

        const pageResults = Array.isArray(data.results) ? data.results : [];
        allResults = allResults.concat(pageResults);

        const hasNext =
          data.has_next === true ||
          (data.page && data.total_pages && data.page < data.total_pages);

        if (!hasNext) break;
        page += 1;
        guard += 1;
        if (guard > 50) break;
      }

      return {
        ...(firstPayload || {}),
        results: allResults,
        page: 1,
        page_size: allResults.length,
        total_pages: 1,
        has_next: false,
        filter: "unread",
      };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "فشل تحميل محادثات Unread";
      return rejectWithValue(msg);
    }
  }
);

/* ================= WS (Hub) ================= */

export const startConversationsWS = createAsyncThunk(
  "conversations/startWS",
  async ({ token, base }, { dispatch, rejectWithValue }) => {
    try {
      if (!token) return;

      const baseToUse = (base && base.replace(/\/+$/, "")) || WS_BASE_OVERRIDE;

      // ✅ لو التوكن اتغير → لازم نكسر القديم
      const tokenChanged = convHubToken && convHubToken !== token;

      const rs =
        convHub?.ws?.readyState ??
        convHub?.socket?.readyState ??
        convHub?._ws?.readyState ??
        null;

      const isAlive = rs === 1 || rs === 0; // OPEN أو CONNECTING

      if ((convHub && !isAlive) || tokenChanged) {
        try {
          if (typeof convHub.destroy === "function") convHub.destroy();
          else if (typeof convHub.disconnect === "function") convHub.disconnect();
        } catch {}
        convHub = null;
      }

      // لو فيه reconnect timer شغال → الغيه
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // لو بالفعل شغال ومش محتاج تغييرات → خلاص
      if (convHub) return;

      convHubToken = token;

      convHub = new ConversationsHubWS(token, {
        base: baseToUse,

        onOpen: () => {
          dispatch(wsHubConnected());
        },

        onClose: () => {
          dispatch(wsHubDisconnected());

          // ✅ Auto-reconnect بعد ثانيتين
          reconnectTimer = setTimeout(() => {
            dispatch(startConversationsWS({ token, base: baseToUse }));
          }, 2000);
        },

        onError: () => {
          dispatch(wsHubError("WS error"));
        },

        onEvent: (event, payload) => {
          // ✅ خلي قراءة اسم الحدث أكثر مرونة
          const ev =
            String(
              event ||
                payload?.event ||
                payload?.type ||
                payload?.name ||
                ""
            ).toLowerCase();

          const data =
            payload &&
            typeof payload === "object" &&
            payload.data &&
            typeof payload.data === "object"
              ? payload.data
              : payload;

          // ✅ لو عايزة تتأكدي إن فعلاً events بتوصل:
          // console.log("WS EVENT:", ev, data);

          switch (ev) {
            case "ack":
            case "system":
            case "pong":
            case "ping":
              return;

            case "message:new":
            case "message":
            case "message_created":
            case "message:created":
            case "auto_response": {
              const rawMsg = data?.last_message || data?.message || data || {};
              const convId =
                rawMsg?.conversation_id ||
                rawMsg?.conversation ||
                data?.conv_id ||
                data?.conversation_id ||
                null;

              if (!convId) return;

              dispatch(
                wsIncomingMessage({
                  ...rawMsg,
                  conversation_id: String(convId),
                  conversation: String(convId),
                })
              );
              return;
            }

            case "message:status":
            case "status":
            case "message_status": {
              const payloadData = payload?.data ? payload.data : payload;
              dispatch(wsMessageStatusOnConversation(payloadData));
              dispatch(wsMessageStatusUpdated(payloadData));
              return;
            }

            case "conversation:new":
            case "conversation_created":
            case "conversation:update":
            case "conversation:updated":
            case "conversation_patch":
            case "conversation:patch": {
              if (data?.id || data?.conversation_id) {
                dispatch(
                  wsUpsertConversation({
                    id: String(data.id ?? data.conversation_id),
                    ...data,
                  })
                );
              }
              return;
            }

            case "conversation:assigned":
            case "assigned_changed":
              dispatch(wsAssignedChanged(data));
              return;

            default:
              return;
          }
        },
      });

      convHub.connect();
    } catch (e) {
      return rejectWithValue("فشل فتح WebSocket");
    }
  }
);


export const stopConversationsWS = createAsyncThunk(
  "conversations/stopWS",
  async () => {
    try {
      if (convHub) {
        if (typeof convHub.destroy === "function") convHub.destroy();
        else convHub.disconnect();
        convHub = null;
      }
    } catch {
      // ignore
    }
  }
);

/* ================= Slice ================= */

const initialState = {
  items: [],
  count: 0,
  page: 1,
  page_size: null,        // 👈 بدل 100
  total_pages: 1,
  has_next: false,
  loading: false,
  error: null,
  params: { filter: "my", page: 1 }, // 👈 شيل page_size من هنا
  selectedId: null,
  wsHubConnected: false,
  wsHubError: null,
  // ...
  // ✅ لازم موجودة علشان toggleConversationStatus.pending
  updatingStatusIds: {},
  // ✅ علشان fetchSubStatuses ما يعملش مشاكل
  subStatuses: { open: [], closed: [], raw: null },
  subStatusesLoading: false,
  subStatusesError: null, 
  unreadItems: [],
unreadLoading: false,
unreadError: null,

};


const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    setConversationParams(state, action) {
      state.params = { ...state.params, ...action.payload };
    },
    clearConversations(state) {
      state.items = [];
      state.count = 0;
      state.page = 1;
      state.page_size = 100;
      state.error = null;
      state.selectedId = null;
      state.updatingStatusIds = {};
        // ✅ مهم
  state.subStatuses = { open: [], closed: [], raw: null };
  state.subStatusesLoading = false;
  state.subStatusesError = null;
    },

    setUnreadZero(state, action) {
      const id = action.payload != null ? String(action.payload) : null;
      state.items = state.items.map((c) =>
        String(c.id) === id ? { ...c, unread: 0, unread_count: 0 } : c
      );
    },

    setSelectedConversationId(state, action) {
      const id = action.payload != null ? String(action.payload) : null;
      state.selectedId = id;
      if (id) {
        state.items = state.items.map((c) =>
          String(c.id) === id
            ? { ...c, unread: 0, unread_count: 0 }
            : c
        );
      }
    },

    wsHubConnected(state) {
      state.wsHubConnected = true;
      state.wsHubError = null;
    },
    wsHubDisconnected(state) {
      state.wsHubConnected = false;
    },
    wsHubError(state, action) {
      state.wsHubError = action.payload || "WS error";
    },

    // إدراج/تحديث محادثة — بدون أي ترتيب هنا (الباك مسؤول عن الترتيب عند الجلب)
    wsUpsertConversation(state, action) {
      const c = action.payload || {};
      if (c?.id == null && c?.conversation_id == null) return;

      const idStr = String(c.id ?? c.conversation_id);
      const idx = state.items.findIndex((x) => String(x.id) === idStr);
      const prev = idx >= 0 ? state.items[idx] : null;

      const unread =
        c.unread_count ?? c.unread ?? (prev?.unread ?? prev?.unread_count ?? 0);

      const numberNow =
        c?.customer?.phone_e164 ??
        c?.customer?.wa_id ??
        c?.wa_id ??
        c?.customer_phone ??
        c?.phone ??
        c?.msisdn ??
        c?.number ??
        (prev?.name && prev?.name !== "Unknown" ? prev?.name : null);
      const name = numberNow ? String(numberNow) : prev?.name ?? "Unknown";

      const txtFromMsg = extractText(c?.last_message || c);
      const label = mediaLabel(c?.last_message || c);
      const lastText = txtFromMsg || label || "";

      const when =
        c?.last_message_at ??
        c?.last_message?.timestamp ??
        c?.updated_at ??
        c?._updated_at ??
        prev?.updated_at ??
        prev?.last_message?.timestamp ??
        Date.now();

      const next = {
        ...(prev || {}),
        ...c,
        id: idStr,
        name,
        unread,
        unread_count: unread,
        last_message: c?.last_message
          ? { ...c.last_message }
          : lastText
          ? { text: lastText, timestamp: when }
          : prev?.last_message,
        last_message_text:
          c?.last_message_text ?? lastText ?? prev?.last_message_text ?? "",
        status: c?.status ?? prev?.status ?? "open",
        sub_status: c?.sub_status ?? prev?.sub_status ?? null,
        updated_at: when,
        _updated_at: when,
        _preview_at: prev?._preview_at ?? when,
      };

      const incTs = new Date(
        c?.last_message_at ??
          c?.last_message?.timestamp ??
          c?.updated_at ??
          c?._updated_at ??
          when
      ).getTime();
      const prvTs = new Date(
        prev?._preview_at ?? prev?._updated_at ?? 0
      ).getTime();

      if (prev && prvTs && (!incTs || incTs <= prvTs)) {
        next.last_message = prev.last_message ?? next.last_message;
        next.last_message_text =
          prev.last_message_text ?? next.last_message_text;
        next.updated_at = prev.updated_at ?? next.updated_at;
        next._updated_at = prev._updated_at ?? next._updated_at;
        next._preview_at = prev._preview_at ?? next._preview_at;
      } else {
        next._preview_at = incTs || when;
      }

      if (idx === -1) {
        state.items = [...state.items, next];
        state.count += 1;
      } else {
        state.items[idx] = next;
      }
    },

    // رسالة جديدة → حدّث preview + عداد غير المقروء (بدون ترتيب)
    wsIncomingMessage(state, action) {
      const m = action.payload || {};
      const convId = String(m.conversation_id ?? m.conversation ?? "");
      if (!convId) return;

      const inbound = isInboundFromCustomer(m);
const mainText = extractText(m) || mediaLabel(m) || "";
const replyPreview =
  m?.reply_to && (m?.reply?.text || m?.reply?.body_preview)
    ? `↩️ ${(m.reply.text || m.reply.body_preview || "").trim()}`
    : "";

const text = replyPreview
  ? `${replyPreview} • ${mainText}`.trim()
  : mainText;
      const when =
        m.last_message_at || m.timestamp || m.ts || m.created_at || Date.now();

      let found = false;

      state.items = state.items.map((c) => {
        if (String(c.id) !== convId) return c;
        found = true;

        const isOpen = String(state.selectedId) === convId;
        const prevUnread = Number(c.unread ?? c.unread_count ?? 0);
        const nextUnread = isOpen
          ? 0
          : inbound
          ? prevUnread + 1
          : prevUnread;

        const lastMsg = c.last_message || {};
        const nextLast = {
          ...lastMsg,
          text: text && text.trim() ? text : lastMsg.text || "",
          timestamp: when || lastMsg.timestamp || Date.now(),
        };

        return {
          ...c,
          last_message: nextLast,
          last_message_text: nextLast.text,
          updated_at: when,
          _updated_at: when,
          _preview_at: when,
          unread: nextUnread,
          unread_count: nextUnread,
        };
      });

      if (!found) {
        const number = pickNumber(m);
        state.items = [
          ...state.items,
          {
            id: convId,
            name: number ? String(number) : "Unknown",
            last_message: text ? { text, timestamp: when } : undefined,
            last_message_text: text,
            updated_at: when,
            _updated_at: when,
            _preview_at: when,
            unread: inbound ? 1 : 0,
            unread_count: inbound ? 1 : 0,
            assigned_to: null,
            status: "open",
          },
        ];
        state.count += 1;
      }
    },

    wsMessageStatusOnConversation(state, action) {
      const p = action.payload || {};

      const convId = String(
        p.conversation_id ?? p.conversation ?? p.conv_id ?? ""
      );
      if (!convId) return;

      const payloadUnread =
        typeof p.unread_count === "number"
          ? p.unread_count
          : typeof p.unread === "number"
          ? p.unread
          : null;

      const statusStr = String(
        p.status || p.message_status || p.delivery_status || ""
      ).toLowerCase();

      state.items = state.items.map((c) => {
        if (String(c.id) !== convId) return c;

        const prevUnread = Number(c.unread_count ?? c.unread ?? 0);
        let nextUnread = prevUnread;

        if (payloadUnread != null) {
          nextUnread = payloadUnread;
        } else if (
          statusStr === "read" ||
          statusStr === "seen" ||
          p.read === true
        ) {
          nextUnread = 0;
        }

        return {
          ...c,
          unread: nextUnread,
          unread_count: nextUnread,
        };
      });
    },

   wsAssignedChanged(state, action) {
  const p = action.payload || {};

  // ممكن يجي customer_id أو customerId
  const customerId =
    p.customer_id ??
    p.customerId ??
    p?.customer?.id ??
    p?.conversation?.customer_id ??
    p?.conversation?.customer?.id ??
    null;

  const convId = String(
    p.conversation_id ?? p.id ?? p?.conversation?.id ?? ""
  );

  const assigned_to =
    p.assigned_to?.username ||
    p.assigned_to?.name ||
    p.assigned_to ||
    p?.conversation?.assigned_to ||
    null;

  // ✅ لو عندنا customerId → حدّث كل المحادثات اللي تخص نفس العميل
  if (customerId != null) {
    const cidStr = String(customerId);
    state.items = state.items.map((c) => {
      const cCustomerId =
        c?.customer?.id ??
        c?.customer_id ??
        c?.customer?.customer_id ??
        null;

      return String(cCustomerId) === cidStr ? { ...c, assigned_to } : c;
    });
    return;
  }

  // ✅ fallback القديم: لو مفيش customerId → حدّث محادثة واحدة بالـ conversation_id
  if (!convId) return;

  state.items = state.items.map((c) =>
    String(c.id) === convId ? { ...c, assigned_to } : c
  );
},

  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
    .addCase(fetchConversations.fulfilled, (state, action) => {
  state.loading = false;
  const payload = action.payload || {};
  const results = payload.results || [];

  const mapped = results.map((c) => {
    const unread = c.unread_count ?? c.unread ?? 0;
    const number = pickNumber(c);
    const name = number ? String(number) : "Unknown";

    const when =
      c?.last_message_at ??
      c?.last_message?.timestamp ??
      c?.updated_at ??
      c?._updated_at ??
      Date.now();

    const lastText =
      extractText(c?.last_message || c) ||
      mediaLabel(c?.last_message || c) ||
      "";

    return {
      ...c, // 👈 بنسيب customer زي ما هو عشان فلترة التاريخ
      id: String(c.id),
      name,
      unread,
      unread_count: unread,
      last_message: c?.last_message
        ? { ...c.last_message }
        : lastText
        ? { text: lastText, timestamp: when }
        : undefined,
      last_message_text: c?.last_message_text ?? lastText ?? "",
      status: c?.status ?? "open",
      sub_status: c?.sub_status ?? null,
      updated_at: when,
      _preview_at: when,
      _updated_at: when,
    };
  });

  const page = payload.page ?? 1;

  if (page > 1) {
    // صفحة تانية أو بعد كده → نضيف بدون تكرار
    const existingIds = new Set(state.items.map((c) => String(c.id)));
    const merged = [...state.items];

    for (const conv of mapped) {
      const idStr = String(conv.id);
      if (!existingIds.has(idStr)) merged.push(conv);
    }

    state.items = merged;
  } else {
    // أول صفحة → نستبدل الليست
    state.items = mapped;
  }

  state.count = payload.count ?? state.count;
  state.page = page;
  state.page_size = payload.page_size ?? state.page_size; // 👈 جاي من الباك
  state.total_pages = payload.total_pages ?? state.total_pages;
  state.has_next = payload.has_next ?? false;

  state.params = {
    ...state.params,
    filter: payload.filter ?? state.params.filter,
    page,
    page_size: state.page_size, // 👈 بنسجِّل اللي راجع من الـ API بس
  };
})

      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "حدث خطأ أثناء جلب المحادثات";
      })

    .addCase(assignConversation.fulfilled, (state, action) => {
  const { customerId, data } = action.payload || {};
  if (!customerId) return;

  const assigned_to =
    data?.assigned_to?.username ||
    data?.assigned_to?.name ||
    data?.assigned_to ||
    null;

  // ✅ حدّث أي محادثة تخص نفس العميل
  state.items = state.items.map((c) => {
    const cCustomerId =
      c?.customer?.id ??
      c?.customer_id ??
      c?.customer?.customer_id ??
      null;

    return String(cCustomerId) === String(customerId)
      ? { ...c, assigned_to }
      : c;
  });
})


      .addCase(fetchSubStatuses.pending, (state) => {
        state.subStatusesLoading = true;
        state.subStatusesError = null;
      })
      .addCase(fetchSubStatuses.fulfilled, (state, action) => {
        state.subStatusesLoading = false;
        state.subStatuses = {
          open: action.payload.open,
          closed: action.payload.closed,
          raw: action.payload.raw,
        };
      })
      .addCase(fetchSubStatuses.rejected, (state, action) => {
        state.subStatusesLoading = false;
        state.subStatusesError =
          action.payload || "تعذر تحميل Sub-Statuses";
      })

      .addCase(toggleConversationStatus.pending, (state, action) => {
        const id = String(action.meta.arg?.conversationId || "");
        if (id) state.updatingStatusIds[id] = true;
      })
      .addCase(toggleConversationStatus.fulfilled, (state, action) => {
        const id = String(action.payload?.conversationId || "");
        if (id) delete state.updatingStatusIds[id];

        const apiConv = action.payload?.data || {};
        state.items = state.items.map((c) => {
          if (String(c.id) !== id) return c;
          return {
            ...c,
            status: apiConv.status ?? c.status,
            sub_status: apiConv.sub_status ?? c.sub_status,
            updated_at: apiConv.updated_at ?? c.updated_at,
            _updated_at: apiConv.updated_at ?? c._updated_at,
          };
        });
      })
      .addCase(toggleConversationStatus.rejected, (state, action) => {
        const id = String(
          action.payload?.conversationId ||
            action.meta.arg?.conversationId ||
            ""
        );
        if (id) delete state.updatingStatusIds[id];
        state.error =
          action.payload?.error || "تعذر تبديل حالة المحادثة";
      })

      .addCase(markConversationRead.fulfilled, (state, action) => {
        const idStr = String(action.payload?.conversationId || "");
        if (!idStr) return;
        state.items = state.items.map((c) =>
          String(c.id) === idStr
            ? { ...c, unread: 0, unread_count: 0 }
            : c
        );
      })
      .addCase(fetchUnreadConversations.pending, (state) => {
  state.unreadLoading = true;
  state.unreadError = null;
})
.addCase(fetchUnreadConversations.fulfilled, (state, action) => {
  state.unreadLoading = false;

  const results = action.payload?.results || [];
  state.unreadItems = results.map((c) => {
    const unread = c.unread_count ?? c.unread ?? 0;
    const number = pickNumber(c);
    const name = number ? String(number) : "Unknown";

    const when =
      c?.last_message_at ??
      c?.last_message?.timestamp ??
      c?.updated_at ??
      Date.now();

    const lastText =
      extractText(c?.last_message || c) ||
      mediaLabel(c?.last_message || c) ||
      "";

    return {
      ...c,
      id: String(c.id),
      name,
      unread,
      unread_count: unread,
      last_message: c?.last_message
        ? { ...c.last_message }
        : lastText
        ? { text: lastText, timestamp: when }
        : undefined,
      last_message_text: c?.last_message_text ?? lastText ?? "",
      updated_at: when,
      _updated_at: when,
      _preview_at: when,
    };
  });
})
.addCase(fetchUnreadConversations.rejected, (state, action) => {
  state.unreadLoading = false;
  state.unreadError = action.payload || "تعذر تحميل unread";
})

      
      ;
  },
});

export const {
  setConversationParams,
  clearConversations,
  setUnreadZero,
  setSelectedConversationId,
  wsHubConnected,
  wsHubDisconnected,
  wsHubError,
  wsUpsertConversation,
  wsIncomingMessage,
  wsMessageStatusOnConversation,
  wsAssignedChanged,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;

/* ================= Selectors ================= */
export const selectConversationList = (s) => s.conversations.items;
export const selectConversationCount = (s) => s.conversations.count;
export const selectConversationLoading = (s) => s.conversations.loading;
export const selectConversationError = (s) => s.conversations.error;
export const selectConversationParams = (s) => s.conversations.params;
export const selectSelectedConversationId = (s) =>
  s.conversations.selectedId;

// helper داخلي لاستعماله مع createSelector
const selectItems = (s) => s.conversations.items || [];

// نفس الـ API القديم لكن بميمو:
export const selectTotalUnread = createSelector(
  [selectItems],
  (items) =>
    items.reduce(
      (sum, c) =>
        sum + Number(c.unread_count ?? c.unread ?? 0),
      0
    )
);

export const selectConvById = (s, id) =>
  (s.conversations.items || []).find(
    (c) => String(c.id) === String(id)
  );

export const selectIsUpdatingStatus = (s, id) =>
  Boolean(s.conversations.updatingStatusIds?.[String(id)]);

export const selectCloseOpenButton = (s, id) => {
  const conv = selectConvById(s, id);
  const isClosed =
    String(conv?.status || "").toLowerCase() === "closed";
  return {
    label: isClosed ? "فتح" : "إغلاق",
    className: isClosed
      ? "px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
      : "px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700",
  };
};

export const selectSubStatusesGrouped = (s) =>
  s.conversations.subStatuses || { open: [], closed: [] };
export const selectSubStatusesOpen = (s) =>
  s.conversations.subStatuses?.open || [];
export const selectSubStatusesClosed = (s) =>
  s.conversations.subStatuses?.closed || [];
export const selectSubStatusesLoading = (s) =>
  s.conversations.subStatusesLoading;
export const selectSubStatusesError = (s) =>
  s.conversations.subStatusesError;

// pagination selectors
export const selectConversationPage = (s) => s.conversations.page;
export const selectConversationHasNext = (s) => s.conversations.has_next;
export const selectConversationPageSize = (s) =>
  s.conversations.page_size;
export const selectUnreadItems = (s) => s.conversations.unreadItems || [];
export const selectUnreadItemsCount = createSelector(
  [selectUnreadItems],
  (items) => items.length
);
export const selectUnreadLoading = (s) => s.conversations.unreadLoading;
