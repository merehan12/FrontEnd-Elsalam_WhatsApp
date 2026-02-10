// src/store/slices/messagesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api, { toApiUrl } from "../../api/axios";
const CAN_LS = false;
const LS_PREFIX = "chat-local-msgs:";
const lsKey = (convId) => `${LS_PREFIX}${String(convId)}`;

const lsLoad = () => {
  return []; // لا ترجع أي رسائل محلية
};
const lsSave = () => {
  // لا شيء
};
const lsUpsert = () => {
  // لا شيء
};
const lsRemoveById = () => {
  // لا شيء
};




// React لما تفتح ChatWebSocket سجّليه في window.__CHAT_SOCKETS__[convId]
const getChatSocket = (convId) => {
  if (typeof window === "undefined") return null;
  const map = window.__CHAT_SOCKETS__ || {};
  return map[String(convId)] || null;
};

/* ===================== Preview / inbound helpers ===================== */
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
  const kind = detectMediaType(m);
  if (kind === "image") return "[📷 صورة]";
  if (kind === "video") return "[🎥 فيديو]";
  if (kind === "audio") return "[🔊 صوت]";
  if (kind === "document") return "[📄 ملف]";
  return "";
};

/* ========================= text extract helpers ========================= */
const extractText = (m) => {
  if (!m) return "";
  const direct = [
    m?.text,
    m?.message,
    m?.content,
    m?.preview,
    m?.caption,
    m?.body, // may be string
    m?.body?.text,
    m?.body?.body,
    m?.body?.message,
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

  const arr =
    m?.messages ||
    m?.body?.messages ||
    m?.body?.raw?.messages ||
    m?.raw?.body?.raw?.messages;
  if (Array.isArray(arr) && arr.length) {
    const m0 = arr[0];
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

  // const quoted =
  //   m?.context?.quoted_message?.text?.body ||
  //   m?.context?.quoted_message?.caption;
  // if (typeof quoted === "string" && quoted.trim()) return quoted;
  // ✅ backend reply object
  // if (typeof m?.reply?.text === "string" && m.reply.text.trim()) {
  //   return m.reply.text;
  // }

  return "";
};

const previewTextOf = (m) => {
  const txt =
    extractText(m) ||
    (typeof m?.text === "string" ? m.text : "") ||
    (typeof m?.body === "string" ? m.body : "");
  if (txt && txt.trim()) return txt;
  const label = mediaLabel(m);
  return label || "";
};

const isInboundCustomer = (m = {}) => {
  const ev = String(m?.event || m?.type || "").toLowerCase();
  if (ev === "system" || ev === "auto_response") return false;
  const dir = String(m?.direction || "").toLowerCase();
  const snd = String(m?.sender || "").toLowerCase();
  if (dir === "out" || dir === "outbound") return false;
  if (dir === "in" || dir === "incoming") return true;
  if (["agent", "staff", "operator", "admin"].includes(snd)) return false;
  return true;
};

/* ========================= Inbound detector (normalizer) ========================= */
// const isInbound = (m) => {
//   const d = String(m?.direction || m?.dir || "").toLowerCase();
//   if (d.includes("in")) return true;
//   if (d.includes("out")) return false;

//   if (typeof m?.inbound === "boolean") return m.inbound;
//   if (typeof m?.outbound === "boolean") return !m.outbound;

//   const fromMe =
//     m?.from_me === true ||
//     m?.is_from_me === true ||
//     String(
//       m?.author || m?.sender || m?.sender_role || ""
//     ).toLowerCase() === "agent";
//   return !fromMe;
// };

const isInbound = (m = {}) => {
  const d = String(m?.direction || m?.dir || "").toLowerCase();
  if (d.includes("in")) return true;   // direction = in / inbound
  if (d.includes("out")) return false; // direction = out / outbound

  if (typeof m?.inbound === "boolean") return m.inbound;
  if (typeof m?.outbound === "boolean") return !m.outbound;

  // 👇 اعتبر كل الأدوار دي رسائل من عندنا (الـ Agent / Staff)
  const roleStr = String(
    m?.author || m?.sender || m?.sender_role || m?.role || ""
  ).toLowerCase();

  const fromMe =
    m?.from_me === true ||
    m?.is_from_me === true ||
    ["agent", "staff", "operator", "admin"].includes(roleStr);

  // لو منّـا → مش inbound
  return !fromMe;
};

/* ========================= Stable temp ID helpers ========================= */
const hash32 = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
};

const buildTempId = (m) => {
  const dir =
    m?.direction || (m?.sender === "agent" ? "out" : "in") || "in";
  const ts = m?.timestamp || m?.ts || m?.created_at || "";
  const text = extractText(m) || m?.text || "";
  return `temp:${dir}:${ts}:${hash32(text)}`;
};

/* ========================= Media helpers ========================= */
const ensureAbsUrl = (u) => toApiUrl(u);

const kindFromMime = (mime = "") => {
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "document";
  if (m.startsWith("application/") || m === "text/plain") return "document";
  return null;
};

const extractMediaObj = (m) => {
  const captionFromExtract = extractText(m) || "";

  // 1) WebSocket / WhatsApp: media_url على مستوى الروت أو في body
  const directUrl =
    m?.media_url ||
    m?.media_url_full ||
    m?.file_url ||
    m?.url ||
    m?.body?.media_url ||
    m?.body?.file_url ||
    m?.body?.url;

  // حاول نفهم النوع من type اللي جاي من الباك إند
  const rawType = String(
    m?.type || m?.body?.type || m?.raw?.body?.type || ""
  ).toLowerCase();

  const mime = m?.mime_type || m?.body?.mime_type || null;

  let kind = null;
  // لو الباك إند قال type=image/video/audio/document نصدّقه مباشرة
  if (["image", "video", "audio", "document"].includes(rawType)) {
    kind = rawType;
  }

  if (directUrl) {
    const url = ensureAbsUrl(directUrl);

    // لو لسه kind مش متحدد، استنتجه من الميديا نفسها
    if (!kind) {
      kind =
        detectMediaType(m) ||
        kindFromMime(mime) ||
        "document";
    }

    return {
      id: m?.media_id || m?.body?.media_id || m?.id || null,
      url,
      kind,
      mime_type: mime,
      filename: m?.filename || m?.body?.filename || null,
      size: m?.file_size || m?.size || m?.body?.file_size || null,
      caption:
        m?.caption ||
        m?.body?.caption ||
        captionFromExtract ||
        "",
    };
  }

  // 2) backend حاطط media ككائن كامل (لما بنجيب من الـ API)
  const top = m?.media;
  if (top && (top.file_url || top.link || top.url)) {
    const url = ensureAbsUrl(top.file_url || top.link || top.url);
    const mime2 = top.mime_type || mime;

    let kind2 = null;
    if (["image", "video", "audio", "document"].includes(rawType)) {
      kind2 = rawType;
    } else {
      kind2 =
        kindFromMime(mime2) ||
        detectMediaType(m) ||
        (top.type ? String(top.type).toLowerCase() : null) ||
        "document";
    }

    return {
      id: top.id ?? null,
      url,
      kind: kind2,
      mime_type: mime2 || null,
      filename: top.filename || null,
      size: top.file_size || null,
      caption:
        m?.body?.caption ||
        top.caption ||
        captionFromExtract ||
        "",
    };
  }

  // 3) body.image / body.video / body.audio / body.document
  const b = m?.body || {};
  const entry =
    b.image ||
    b.video ||
    b.audio ||
    b.document ||
    b.raw?.image ||
    b.raw?.video ||
    b.raw?.audio ||
    b.raw?.document;

  if (entry) {
    const link =
      entry.link || entry.url || entry.file_url || b.url || null;
    const url = link ? ensureAbsUrl(link) : null;
    const mime3 = entry.mime_type || mime;

    let kind3 = null;
    if (["image", "video", "audio", "document"].includes(rawType)) {
      kind3 = rawType;
    } else if (b.image || b.raw?.image) {
      kind3 = "image";
    } else if (b.video || b.raw?.video) {
      kind3 = "video";
    } else if (b.audio || b.raw?.audio) {
      kind3 = "audio";
    } else if (b.document || b.raw?.document) {
      kind3 = "document";
    } else {
      kind3 =
        kindFromMime(mime3) ||
        detectMediaType(m) ||
        "document";
    }

    return {
      id: entry.id || null,
      url,
      kind: kind3,
      mime_type: mime3,
      filename: entry.filename || null,
      size: entry.file_size || null,
      caption:
        entry.caption ||
        b.caption ||
        captionFromExtract ||
        "",
    };
  }

  // 4) شكل واتساب الخام body.raw.messages[0]
  const msg0 = m?.body?.raw?.messages?.[0];
  if (msg0) {
    const t = String(msg0.type || "").toLowerCase();
    const mediaNode =
      msg0.image ||
      msg0.video ||
      msg0.audio ||
      msg0.document ||
      msg0[t];

    if (mediaNode) {
      const link =
        mediaNode.link || mediaNode.url || mediaNode.file_url || null;
      const url = link ? ensureAbsUrl(link) : null;
      const mime4 = mediaNode.mime_type || null;

      let kind4 = null;
      if (["image", "video", "audio", "document"].includes(rawType)) {
        kind4 = rawType;
      } else if (msg0.image || t === "image") {
        kind4 = "image";
      } else if (msg0.video || t === "video") {
        kind4 = "video";
      } else if (msg0.audio || t === "audio" || t === "voice") {
        kind4 = "audio";
      } else if (msg0.document || t === "document") {
        kind4 = "document";
      } else {
        kind4 =
          kindFromMime(mime4) ||
          detectMediaType(m) ||
          "document";
      }

      return {
        id: mediaNode.id || null,
        url,
        kind: kind4,
        mime_type: mime4,
        filename: mediaNode.filename || null,
        size: mediaNode.file_size || null,
        caption:
          mediaNode.caption ||
          captionFromExtract ||
          "",
      };
    }
  }

  // 5) fallback بسيط
  if (b && b.url && b.type) {
    return {
      id: null,
      url: b.url,
      kind: String(b.type).toLowerCase(),
      mime_type: null,
      filename: null,
      size: null,
      caption: b.caption || captionFromExtract || "",
    };
  }

  return null;
};
const normalizeMessage = (m, convIdHint) => {
  if (!m) return null;
  const src = m?.data && m?.event ? m.data : m;
const rawText =
  extractText(m) ||
  m?.body?.raw?.text?.body ||   // ✅ ده المهم
  (typeof m?.body === "string" ? m.body : "") ||
  (typeof m?.message === "string" ? m.message : "") ||
  (typeof m?.text === "string" ? m.text : "");



  // التوقيت
  const ts =
    src?.ts ||
    src?.timestamp ||
    src?.body?.timestamp ||
    src?.created_at ||
    null;

  // اتجاه الرسالة
  const inbound = isInbound(src);
  const sender = inbound ? "customer" : "agent";

  // رقم المحادثة
  const convIdRaw =
    convIdHint ??
    src?.conversation ??
    src?.conversation_id ??
    src?.conv_id ??
    src?.raw?.conversation_id ??
    null;
  const convId = convIdRaw != null ? String(convIdRaw) : null;

  // ID
  const msgId =
    src?.id ??
    src?.message_id ??
    src?.meta_msg_id ??
    src?.client_msg_id ??
    buildTempId({ ...src, text: rawText });

  // بيانات الـ agent (لو متاحة)
  const author_id =
    src?.user?.id ?? src?.agent?.id ?? src?.sender_id ?? src?.agent_id ?? null;

  const author_username =
    src?.user?.username ||
    src?.user?.name ||
    src?.agent?.username ||
    src?.agent?.name ||
    src?.sender_name ||
    src?.agent_name ||
    null;

  // نوع الرسالة اللي جاي من الباك إند (image / video / audio / document / text)
  const rawTypeLower = String(src?.type || src?.body?.type || "").toLowerCase();

  // ---------- 1) استخرج كائن الـ media ----------
  let media = extractMediaObj(src);

  if (!media && (src?.media_url || src?.file_url || src?.url)) {
    const topUrl = src.media_url || src.file_url || src.url;
    media = {
      id: src.media_id || null,
      url: ensureAbsUrl(topUrl),
      kind: null,
      mime_type: src.mime_type || null,
      filename: src.filename || null,
      size: src.file_size || null,
      caption: src.caption || "",
    };
  }

  if (media) {
    if ((!media.kind || media.kind === "document") && rawTypeLower === "image") media.kind = "image";
    else if ((!media.kind || media.kind === "document") && rawTypeLower === "video") media.kind = "video";
    else if ((!media.kind || media.kind === "document") && (rawTypeLower === "audio" || rawTypeLower === "voice")) media.kind = "audio";
  }

  // ---------- 2) body المرسل للـ UI ----------
  let body = undefined;
  if (media && media.url) {
    const originalBody = src?.body && typeof src.body === "object" ? src.body : {};
    body = {
      ...originalBody,
      url: media.url,
      type: media.kind || originalBody.type || src?.type || "media",
      caption:
        media.caption && String(media.caption).trim() && media.caption !== "[IMAGE]"
          ? media.caption
          : originalBody.caption ||
            (src?.caption && src.caption !== "[IMAGE]" ? src.caption : undefined),
    };
  } else if (src?.body && typeof src.body === "object") {
    body = { ...src.body };
  }

  const finalType = body?.type || src?.type || src?.body?.type || (media ? "media" : "text");

  // ===================== ✅ Reply normalize (كل الحالات) =====================

  // A) reply_to ممكن يبقى رقم أو object (لما العميل يرد)
  const replyToRaw =
  src?.reply_to ??
  src?.replyTo ??
  src?.reply_id ??
  // ✅ API عندك: body.raw.context.id
  src?.body?.raw?.context?.id ??
  // ✅ لو جاي WS envelope
  src?.raw?.body?.raw?.context?.id ??
  // fallback قديم
  src?.context?.id ??
  src?.context?.message_id ??
  null;


  const reply_to_id =
  replyToRaw && typeof replyToRaw === "object"
    ? (replyToRaw.id ?? replyToRaw.message_id ?? null)
    : replyToRaw;


  // B) reply object ممكن يبقى في src.reply (agent reply) أو جوه reply_to object (customer reply)
  const replyRaw =
    src?.reply ||
    (replyToRaw && typeof replyToRaw === "object" ? replyToRaw : null) ||
    src?.context?.quoted_message ||
    null;

  const reply = replyRaw
    ? {
        id:
          replyRaw?.id ??
          replyRaw?.message_id ??
          reply_to_id ??
          null,
        author:
          replyRaw?.author ??
          replyRaw?.from ??
          replyRaw?.sender ??
          replyRaw?.agent_name ??
          replyRaw?.user ??
          null,
        type: String(replyRaw?.type || "text"),
        text:
          // ✅ أحيانًا النص بيكون reply.text
          (typeof replyRaw?.text === "string" && replyRaw.text) ||
          // ✅ وأحيانًا بيكون reply.body.text (زي اللي بعتّيه)
          (typeof replyRaw?.body?.text === "string" && replyRaw.body.text) ||
          // ✅ أو reply.body لو string
          (typeof replyRaw?.body === "string" && replyRaw.body) ||
          (typeof replyRaw?.caption === "string" && replyRaw.caption) ||
          "",
      }
    : null;

  return {
    id: msgId,
    conversation_id: convId,
    sender,
    text: typeof rawText === "string" ? rawText : "",
    timestamp: ts || new Date().toISOString(),
    status: src?.status ?? src?.delivery_status ?? null,
    type: finalType,
    direction: inbound ? "in" : "out",
    client_msg_id: src?.client_msg_id || null,
    raw: src,
    author_id,
    author_username,
    body,
    media,
    
  meta_msg_id: src?.meta_msg_id || null,
  server_id: src?.id ?? null,
    // ✅ هنا المهم
reply_to:
  reply_to_id == null
    ? null
    : (typeof reply_to_id === "number" || /^[0-9]+$/.test(String(reply_to_id)))
      ? Number(reply_to_id)
      : String(reply_to_id),
    reply,
  };
};



const sortMessages = (arr) =>
  arr.sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    if (ta !== tb) return ta - tb;
    const ai = Number.isFinite(+a.id) ? +a.id : 0;
    const bi = Number.isFinite(+b.id) ? +b.id : 0;
    return ai - bi;
  });

  const lsMergeWithServer = (convId, serverItems = []) => {
  return serverItems;
};

// const lsMergeWithServer = (convId, serverItems = []) => {
//   const local = lsLoad(convId);
//   if (!local.length) return serverItems;

//   const byId = new Map(serverItems.map((m) => [String(m.id), m]));
//   const byClient = new Map(
//     serverItems
//       .filter((m) => m.client_msg_id)
//       .map((m) => [m.client_msg_id, m])
//   );

//   for (const lm of local) {
//     const fixed = lm.client_msg_id && byClient.get(lm.client_msg_id);
//     if (fixed) {
//       byId.set(String(fixed.id), { ...fixed });
//     } else {
//       const id = String(lm.id);
//       if (!byId.has(id)) byId.set(id, lm);
//     }
//   }
//   return Array.from(byId.values());
// };
const resolveReplyIdsInPlace = (items = []) => {
  const metaToId = new Map();
  for (const m of items) {
    const meta = m?.meta_msg_id;
    if (meta) metaToId.set(String(meta), String(m.id));
  }

  for (const m of items) {
    const ctxId = m?.body?.raw?.context?.id;
    if (ctxId && String(ctxId).startsWith("wamid.")) {
      const resolved = metaToId.get(String(ctxId));
      if (resolved) m.reply_to = String(resolved);
    }
  }

  return items;
};

/* ====================== Thunks: fetch ====================== */
export const fetchMessages = createAsyncThunk(
  "messages/fetchMessages",
  async (
    { id, limit = 100, before, after, opened = false },
    { rejectWithValue }
  ) => {
    try {
      const params = {};
      if (limit) params.limit = Math.min(Number(limit) || 100, 200);
      if (before) params.before = before;
      if (after) params.after = after;

      const { data } = await api.get(`/conversations/${id}/messages/`, {
        params,
      });

      let rawList = [];
      if (Array.isArray(data)) rawList = data;
      else if (Array.isArray(data?.results)) rawList = data.results;
      else if (Array.isArray(data?.messages)) rawList = data.messages;

      const normalized = rawList.map((m) => normalizeMessage(m, id));
     const items = sortMessages(normalized);

resolveReplyIdsInPlace(items);
return { id: String(id), items, opened: !!opened };

    
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load messages";
      return rejectWithValue({ id, error: msg });
    }
  }
);

export const fetchNewer = createAsyncThunk(
  "messages/fetchNewer",
  async (
    { id, limit = 50, afterISO, opened = false },
    { rejectWithValue }
  ) => {
    try {
      const params = {
        limit: Math.min(Number(limit) || 50, 200),
      };
      if (afterISO) params.after = afterISO;

      const { data } = await api.get(`/conversations/${id}/messages/`, {
        params,
      });

      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.messages)
        ? data.messages
        : [];

      const items = sortMessages(rawList.map((m) => normalizeMessage(m, id)));
            resolveReplyIdsInPlace(items);

      return { id: String(id), items, opened: !!opened };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load new messages";
      return rejectWithValue({ id, error: msg });
    }
  }
);

/* ================== Resolve media URL by ID (WS → no URL) ================== */
const _resolvingKeys = new Set();

const tryResolveMediaUrl = async (convId, mediaId) => {
  const paths = [`/messaging/media/${mediaId}/`];
  for (const p of paths) {
    try {
      const { data } = await api.get(p, { params: { id: mediaId } });
      const url = data?.url || data?.file_url || data?.link;
      if (url) {
        return {
          url,
          mime_type: data?.mime_type || null,
          filename: data?.filename || null,
          size: data?.file_size || null,
        };
      }
    } catch {}
  }
  return null;
};

export const resolveMediaUrl = createAsyncThunk(
  "messages/resolveMediaUrl",
  async (
    { conversationId, messageId, client_msg_id, mediaId },
    { rejectWithValue }
  ) => {
    try {
      const conv = String(conversationId);
      const key = `${conv}:${mediaId}`;
      if (_resolvingKeys.has(key))
        return { conversationId: conv, messageId, client_msg_id }; // dedupe
      _resolvingKeys.add(key);

      const resolved = await tryResolveMediaUrl(conv, mediaId);
      _resolvingKeys.delete(key);

      if (!resolved?.url) throw new Error("URL not ready");
      return {
        conversationId: conv,
        messageId,
        client_msg_id,
        media: { id: mediaId, kind: null, ...resolved },
      };
    } catch (err) {
      return rejectWithValue({
        conversationId,
        messageId,
        client_msg_id,
        error: err?.message || "resolve failed",
      });
    }
  }
);

/* ============= WhatsApp media constraints & validation ============= */
const MAX_SIZE = {
  image: 5 * 1024 * 1024, // 5MB
  document: 100 * 1024 * 1024, // 100MB
  audio: 16 * 1024 * 1024, // 16MB
  video: 16 * 1024 * 1024, // 16MB
};

const ALLOWED = {
  image: ["image/jpeg", "image/png", "image/webp"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
  audio: [
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/amr",
    "audio/ogg",
    "audio/opus",
  ],
  video: ["video/mp4", "video/3gpp"],
};

const guessTypeFromMime = (mime = "") => {
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("application/") || m === "text/plain") return "document";
  return null;
};

// NEW: طبّع الـ MIME للصوت (مثلاً audio/ogg;codecs=opus → audio/ogg)
const normalizeAudioMime = (mime = "") => {
  const m = String(mime || "").toLowerCase().replace(/\s+/g, "");
  if (m.startsWith("audio/ogg")) return "audio/ogg";
  if (m.startsWith("audio/mp4")) return "audio/mp4";
  if (m.startsWith("audio/aac")) return "audio/aac";
  if (m.startsWith("audio/mpeg")) return "audio/mpeg";
  if (m.startsWith("audio/amr")) return "audio/amr";
  if (m.startsWith("audio/opus")) return "audio/opus";
  return mime || "audio/ogg";
};

const validateFileForWhatsApp = (file, explicitType) => {
  if (!file) return "No file selected";
  const type =
    explicitType ||
    guessTypeFromMime(file.type) ||
    "document";
  const allowed = ALLOWED[type] || [];
  const max = MAX_SIZE[type] || MAX_SIZE.document;

  if (
    file.type === "video/webm" ||
    file.name?.toLowerCase().endsWith(".webm")
  ) {
    return "WEBM غير مدعوم من WhatsApp. حوّل الفيديو إلى MP4 قبل الإرسال.";
  }
  if (
    type === "audio" &&
    (file.type === "audio/webm" ||
      file.name?.toLowerCase().endsWith(".webm"))
  ) {
    return "WEBM/WEBMAudio غير مدعوم. استخدم OGG/OPUS أو MP3/AAC.";
  }

  const checkType =
    type === "audio" ? normalizeAudioMime(file.type) : file.type;
  if (allowed.length && !allowed.includes(checkType)) {
    return `نوع الملف ${file.type || "(unknown)"} غير مدعوم لهذا النوع ${type}.`;
  }
  if (file.size > max) {
    return `حجم الملف أكبر من الحد (${Math.round(
      max / (1024 * 1024)
    )}MB) للنوع ${type}.`;
  }
  return null;
};

export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async (
    { conversationId, text, type="text", reply_to=null, reply=null },
    { rejectWithValue }
  ) => {
    const id = String(conversationId);
    try {
      const ws = getChatSocket(id);
      if (!ws || typeof ws.sendText !== "function") {
        throw new Error("WebSocket غير متصل لهذه المحادثة (sendText غير متاح)");
      }

      const rt = reply_to != null ? Number(reply_to) : NaN;

     const payload = {
  event: "message:send",
  data: {
    type: "text",
    body: { text },
    reply_to: reply_to != null ? Number(reply_to) : undefined,
  },
};


      if (typeof ws.sendJson === "function") ws.sendJson(payload);
      else await ws.sendText(payload);

      return { conversationId: id };
    } catch (err) {
      return rejectWithValue({
        error: err?.message || "Failed to send message via WebSocket",
        conversationId: id,
      });
    }
  },
  {
   getPendingMeta: ({ arg, requestId }) => {
  const meId = arg?.meId ?? null;
  const meUsername = arg?.meUsername ?? null;

  return {
    temp: {
      id: `local-${requestId}`,
      client_msg_id: `c_${requestId}`,
      conversation_id: String(arg.conversationId),
      conversation: String(arg.conversationId),
      sender: "agent",
      direction: "out",
      text: arg.text,
      type: arg.type || "text",
      status: "sending",
      timestamp: new Date().toISOString(),
      user: meId ? { id: meId, username: meUsername } : undefined,
      author_id: meId || null,
      author_username: meUsername || null,

      // ✅ reply linkage
    reply_to: arg.reply_to != null ? String(arg.reply_to) : null,
reply: arg.reply ?? null,

    },
  };
},

  }
);


/* ====================== Thunks: media upload + send via WebSocket ====================== */
export const sendMedia = createAsyncThunk(
  "messages/sendMedia",
  async (args, { rejectWithValue }) => {
    const {
      conversationId,
      file,
      type: explicitType, // image | video | audio | document
      caption,
      description,
      metaId: givenMetaId, // Meta/Media id من الباك إند (لو جاهز)
      asVoice,
    } = args || {};
    const id = String(conversationId);

    try {
      // mediaRowId: الـ media_id الداخلي في الداتابيز (اللي الباك إند متوقعه في media:send)
      // metaId: الـ Meta/WhatsApp id لو رجع من الـ upload
      let mediaRowId = givenMetaId || null;
      let metaId = null;

      let mediaType =
        (explicitType ||
          (file ? guessTypeFromMime(file.type) : "document") ||
          "document"
        ).toLowerCase();

      // 1) رفع الملف (لسه بـ HTTP عادي)
      if (file) {
        const validationError = validateFileForWhatsApp(
          file,
          mediaType
        );
        if (validationError) {
          return rejectWithValue({
            error: validationError,
            conversationId: id,
          });
        }

        const form = new FormData();
        form.append("file", file);
        form.append("media_type", mediaType);
        if (mediaType === "audio") {
          form.append("force_mime", normalizeAudioMime(file.type));
        }
        if (caption && caption.trim() && mediaType !== "audio") {
          form.append("caption", caption.trim());
        }
        if (description && String(description).trim()) {
          form.append("description", String(description).trim());
        }

        const upRes = await api.post(
          `/messaging/${id}/media/upload/`,
          form,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        const d = upRes?.data || {};

        // media_id اللي ظهر في Postman (483, 484, ...)
        mediaRowId = d?.media_id ?? d?.id ?? mediaRowId;

        // Meta / WhatsApp id لو رجع
        metaId =
          d?.Meta_id ||
          d?.meta_id ||
          d?.metaId ||
          metaId ||
          null;

        if (!mediaRowId) {
          throw new Error("Upload succeeded but media_id not returned");
        }
      }

      // fallback بسيط: لو مفيش upload والجهاز مديّنا ID جاهز
      if (!mediaRowId && givenMetaId) {
        mediaRowId = givenMetaId;
      }

      // 2) إرسال عبر WebSocket: media:send
      const ws = getChatSocket(id);
      if (!ws || typeof ws.sendMedia !== "function") {
        throw new Error(
          "WebSocket غير متصل لهذه المحادثة (sendMedia غير متاح)"
        );
      }

      // WebSocket بيستخدم type "doc" بدل "document" (زي ما في Postman)
      let wsType = mediaType;
      if (wsType === "document" || wsType === "doc") {
        wsType = "doc";
      }

      const payload = {
        media_id: mediaRowId,
        type: wsType,
        caption,
      };

      // (اختياري) تقدرِ تعملي console.log هنا لو حابة تتأكدي
      // console.log("WS sendMedia PAYLOAD >>>", payload);

      ws.sendMedia(payload);

      // الرسالة نفسها هتوصل بعد كده من الهَب كـ message:new
      return {
        conversationId: id,
        mediaType: wsType,
        mediaId: mediaRowId,
        metaId,
      };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send media via WebSocket";
      return rejectWithValue({ error: msg, conversationId: id });
    }
  },
  {
    // Pending محلي للمعاينة السريعة
    getPendingMeta: ({ arg, requestId }) => {
      const {
        conversationId,
        file,
        type,
        caption,
        meId,
        meUsername,
      } = arg || {};
      let localUrl = null;
      try {
        if (
          file &&
          typeof URL !== "undefined" &&
          URL.createObjectURL
        ) {
          localUrl = URL.createObjectURL(file);
        }
      } catch {}
      const kind = (
        type ||
        (file ? guessTypeFromMime(file.type) : "document") ||
        "document"
      ).toLowerCase();
      return {
        temp: {
          id: `local-${requestId}`,
          client_msg_id: `c_${requestId}`,
          conversation_id: String(conversationId),
          conversation: String(conversationId),
          sender: "agent",
          direction: "out",
          text:
            kind === "audio"
              ? ""
              : caption || "",
          type: kind, // text | image | video | audio | document
          status: "sending",
          timestamp: new Date().toISOString(),
          user: meId
            ? { id: meId, username: meUsername }
            : undefined,
          author_id: meId || null,
          author_username: meUsername || null,
          body: {
            type: kind,
            url: localUrl,
            caption:
              kind === "audio"
                ? ""
                : caption || "",
          },
        },
      };
    },
  }
);

/* ====================== Upsert helper (مهم للميديا) ====================== */
// function upsertMessageInState(state, convId, partialRaw) {
//   const cid = String(convId);
//   if (!state.byConv[cid]) state.byConv[cid] = [];

//   const norm = normalizeMessage(partialRaw, cid);

//   const arr = state.byConv[cid];
//   const byId = String(norm.id);
//   let idx = arr.findIndex((m) => String(m.id) === byId);
//   if (idx === -1 && norm.client_msg_id) {
//     idx = arr.findIndex((m) => m.client_msg_id === norm.client_msg_id);
//   }

//   if (idx === -1) {
//     arr.push(norm);
//   } else {
//     const prev = arr[idx] || {};
//     arr[idx] = {
//       ...prev,
//       ...norm,
//       body: norm.body
//         ? { ...(prev.body || {}), ...norm.body }
//         : prev.body,
//       media: norm.media
//         ? { ...(prev.media || {}), ...norm.media }
//         : prev.media,
//       text:
//         typeof norm.text === "string" && norm.text.length
//           ? norm.text
//           : prev.text,
//       status: norm.status || prev.status,
//     };
//   }

//   sortMessages(state.byConv[cid]);
//   const last = state.byConv[cid][state.byConv[cid].length - 1];
//   if (last?.timestamp)
//     state.lastTsByConv[cid] = new Date(last.timestamp).toISOString();
//   state.lastTextByConv[cid] = previewTextOf(last);
// }

function upsertMessageInState(state, convId, partialRaw) {
  const cid = String(convId);
  if (!state.byConv[cid]) state.byConv[cid] = [];

  const norm = normalizeMessage(partialRaw, cid);

  const arr = state.byConv[cid];
  const byId = String(norm.id);
  let idx = arr.findIndex((m) => String(m.id) === byId);
  if (idx === -1 && norm.client_msg_id) {
    idx = arr.findIndex((m) => m.client_msg_id === norm.client_msg_id);
  }

  if (idx === -1) {
    // رسالة جديدة
    arr.push(norm);
  } else {
    // تحديث رسالة قديمة
    const prev = arr[idx] || {};
    arr[idx] = {
      ...prev,
      ...norm,
      body: norm.body
        ? { ...(prev.body || {}), ...norm.body }
        : prev.body,
      media: norm.media
        ? { ...(prev.media || {}), ...norm.media }
        : prev.media,
      text:
        typeof norm.text === "string" && norm.text.length
          ? norm.text
          : prev.text,
      status: norm.status || prev.status,
    };
  }

  sortMessages(state.byConv[cid]);

  const last = state.byConv[cid][state.byConv[cid].length - 1];
  if (last?.timestamp) {
    state.lastTsByConv[cid] = new Date(
      last.timestamp
    ).toISOString();
  }
  state.lastTextByConv[cid] = previewTextOf(last);
}



/* ====================== Slice ====================== */
const messagesSlice = createSlice({
  name: "messages",
  initialState: {
    byConv: {},
    loading: {}, // لتحميل الجلب فقط
    sendingByConv: {}, // حالة إرسال منفصلة لكل محادثة
    error: {},
    lastTsByConv: {},
    lastTextByConv: {},
    unreadByConv: {},
  },

  reducers: {

  wsMessageReceived(state, action) {
    
  const { message: raw, isActive } = action.payload || {};
  if (!raw) return;
  const convId = String(raw.conversation_id ?? raw.conversation ?? "");
  if (!convId) return;

  if (!state.byConv[convId]) state.byConv[convId] = [];

  const incoming = normalizeMessage(raw, convId);
  if (!incoming) return;

  const list = state.byConv[convId];

  // 1) حاول نطابق بـ id أو client_msg_id
  let idx = list.findIndex((m) => String(m.id) === String(incoming.id));
  if (idx === -1 && incoming.client_msg_id) {
    idx = list.findIndex((m) => m.client_msg_id === incoming.client_msg_id);
  }

  // 2) لو الرسالة جاية من الباك وفيه local-* بنفس client_msg_id → شيل الـ local
  if (idx === -1 && incoming.client_msg_id) {
    const localIdx = list.findIndex(
      (m) =>
        String(m.id).startsWith("local-") &&
        m.client_msg_id === incoming.client_msg_id
    );
    if (localIdx !== -1) idx = localIdx;
  }

  if (idx === -1) {
    list.push(incoming);
  } else {
    const prev = list[idx] || {};
    list[idx] = {
      ...prev,
      ...incoming,
      body: incoming.body ? { ...(prev.body || {}), ...incoming.body } : prev.body,
      media: incoming.media ? { ...(prev.media || {}), ...incoming.media } : prev.media,
  // ✅ لو السيرفر مبعتش reply fields، خديها من المحلي
  reply_to: incoming.reply_to ?? prev.reply_to ?? null,
  reply: incoming.reply ?? prev.reply ?? null,

      text: incoming.text || prev.text || "",
      status: incoming.status || prev.status,
    };
  }

  sortMessages(list);

  const last = list[list.length - 1];
  if (last?.timestamp) state.lastTsByConv[convId] = new Date(last.timestamp).toISOString();
  state.lastTextByConv[convId] = previewTextOf(last);

  // unread (لو مش مفتوح والرسالة inbound)
  if (!isActive && isInboundCustomer(last)) {
    state.unreadByConv[convId] = Number(state.unreadByConv[convId] || 0) + 1;
  }
}
,
    wsMessageStatusUpdated(state, action) {
      const {
        message_id,
        client_msg_id,
        status,
        conversation_id,
        conversation,
      } = action.payload || {};
 
      const convId = String(conversation_id ?? conversation ?? "");
            if (!convId) {
        // fallback: search all conversations
        for (const cid of Object.keys(state.byConv || {})) {
          const list = state.byConv[cid] || [];
          for (const m of list) {
            const sameById =
              message_id != null && String(m.id) === String(message_id);
            const sameByClient =
              client_msg_id && m.client_msg_id === client_msg_id;
            if (sameById || sameByClient) {
              if (status) m.status = status;
              return;
            }
          }
        }
        return;
      }

      if (!convId || !state.byConv?.[convId]) return;

      const list = state.byConv[convId];

      for (const m of list) {
        const sameById =
          message_id != null &&
          m.id != null &&
          String(m.id) === String(message_id);
        const sameByClient =
          client_msg_id &&
          m.client_msg_id &&
          String(m.client_msg_id) === String(client_msg_id);

        if (sameById || sameByClient) {
          if (status) m.status = status;
        }
      }
    },


    zeroUnread(state, action) {
      const cid = String(action.payload);
      state.unreadByConv[cid] = 0;
    },

    setLastPreview(state, action) {
      const { id, text, ts } = action.payload || {};
      const cid = String(id || "");
      if (!cid) return;
      if (typeof text === "string") state.lastTextByConv[cid] = text;
      if (ts)
        state.lastTsByConv[cid] =
          new Date(ts).toISOString?.() || ts;
    },

    setUnreadCount(state, action) {
      const { id, count } = action.payload || {};
      const cid = String(id || "");
      if (!cid) return;
      state.unreadByConv[cid] = Math.max(
        0,
        Number(count || 0)
      );
    },

    // مهم: باتش رسالة (مثلاً وصول media.url بعد ثانية)
    messagePatched(state, action) {
      const {
        conversationId,
        messageId,
        client_msg_id,
        media,
        text,
        status,
      } = action.payload || {};
      const cid = String(conversationId || "");
      if (!cid || !state.byConv[cid]) return;

      let msg = null;
      if (messageId != null) {
        msg = state.byConv[cid].find(
          (m) => String(m.id) === String(messageId)
        );
      }
      if (!msg && client_msg_id) {
        msg = state.byConv[cid].find(
          (m) => m.client_msg_id === client_msg_id
        );
      }
      if (!msg) return;

      if (media) {
        msg.media = { ...(msg.media || {}), ...media };
        if (media.url) {
          msg.body = {
            ...(msg.body || {}),
            url: media.url,
            type: media.kind || msg.body?.type,
          };
        }
        if (media.caption && !msg.text) msg.text = media.caption;
      }
      if (typeof text === "string") msg.text = text;
      if (status) msg.status = status;
    },
  },

  extraReducers: (builder) => {
    builder
      /* fetchMessages */
      .addCase(fetchMessages.pending, (state, action) => {
        const { id } = action.meta.arg;
        const key = String(id);
        state.loading[key] = true;
        state.error[key] = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const {
          id,
          items = [],
          opened = false,
        } = action.payload || {};
        const key = String(id);
        state.loading[key] = false;
        state.byConv[key] = items;

        const last = items[items.length - 1];
        if (last?.timestamp)
          state.lastTsByConv[key] = new Date(
            last.timestamp
          ).toISOString();
        state.lastTextByConv[key] = previewTextOf(last);

        if (opened) state.unreadByConv[key] = 0;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const { id, error } = action.payload || {};
        const key = String(id);
        state.loading[key] = false;
        state.error[key] = error || "Failed to load messages";
        const local = lsLoad(key);
        if (local.length) {
          const current = state.byConv[key] || [];
          const merged = lsMergeWithServer(key, current);
          state.byConv[key] = sortMessages(merged);
          const last =
            state.byConv[key][state.byConv[key].length - 1];
          state.lastTextByConv[key] = previewTextOf(last);
        }
      })

      /* fetchNewer */
      .addCase(fetchNewer.fulfilled, (state, action) => {
        const {
          id,
          items = [],
          opened = false,
        } = action.payload || {};
        const key = String(id);
        if (!items.length) return;

        if (!state.byConv[key]) state.byConv[key] = [];
        const have = new Set(
          state.byConv[key].map((m) => String(m.id))
        );

        let addedInbound = 0;
        for (const m of items) {
          if (!have.has(String(m.id))) {
            state.byConv[key].push(m);
            if (m.direction === "in" || isInbound(m.raw))
              addedInbound += 1;
          }
        }
        sortMessages(state.byConv[key]);

        const last =
          state.byConv[key][state.byConv[key].length - 1];
        if (last?.timestamp)
          state.lastTsByConv[key] = new Date(
            last.timestamp
          ).toISOString();
        state.lastTextByConv[key] = previewTextOf(last);

        if (opened) {
          state.unreadByConv[key] = 0;
        } else if (addedInbound > 0) {
          const old = Number(state.unreadByConv[key] || 0);
          state.unreadByConv[key] = old + addedInbound;
        }
      })

      /* sendMessage عبر WebSocket */
      .addCase(sendMessage.pending, (state, action) => {
        const temp = action.meta?.temp;
        if (!temp) return;
        const key = String(temp.conversation_id);
        if (!state.byConv[key]) state.byConv[key] = [];

        const normTemp = normalizeMessage(temp, key);
        state.byConv[key].push(normTemp);
        sortMessages(state.byConv[key]);

        lsUpsert(key, normTemp);

        state.sendingByConv[key] = true;
        state.error[key] = null;

        state.lastTextByConv[key] = previewTextOf(normTemp);
        state.lastTsByConv[key] = new Date(
          normTemp.timestamp
        ).toISOString();
      })


      .addCase(sendMessage.fulfilled, (state, action) => {
        const { conversationId } = action.payload || {};
        const key = String(conversationId);
        state.sendingByConv[key] = false;

        // لو الباك إند ما بعتش message:new / status لسه،
        // نعدّل آخر local-* من "sending" إلى "sent" مؤقتاً
        const arr = state.byConv[key] || [];
        for (let i = arr.length - 1; i >= 0; i--) {
          const m = arr[i];
          if (
            String(m.id).startsWith("local-") &&
            (m.status === "sending" || !m.status)
          ) {
            m.status = "sent";
            lsUpsert(key, m);
            break;
          }
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        const convKey =
          action.meta?.arg?.conversationId != null
            ? String(action.meta.arg.conversationId)
            : Object.keys(state.byConv).find((k) =>
                (state.byConv[k] || []).some((m) =>
                  String(m.id).startsWith("local-")
                )
              );

        if (convKey) {
          const arr = state.byConv[convKey] || [];
          for (let i = arr.length - 1; i >= 0; i--) {
            if (String(arr[i].id).startsWith("local-")) {
              arr[i].status = "failed";
              lsUpsert(convKey, arr[i]);
              break;
            }
          }
          state.byConv[convKey] = arr;
          state.sendingByConv[convKey] = false;
          state.error[convKey] =
            action.payload?.error || "Failed to send message";
        }
      })
      .addCase(sendMedia.pending, (state, action) => {
        const temp = action.meta?.temp;
        const hasFile = !!action.meta?.arg?.file;
        if (!temp && !hasFile) {
          // لو مفيش ملف ومفيش pending (إرسال بواسطة metaId فقط)
          return;
        }
        const key = String(
          temp?.conversation_id || action.meta?.arg?.conversationId
        );
        if (!state.byConv[key]) state.byConv[key] = [];

        const normTemp = normalizeMessage(temp, key);
        state.byConv[key].push(normTemp);
        sortMessages(state.byConv[key]);
        lsUpsert(key, normTemp);

        state.sendingByConv[key] = true;
        state.error[key] = null;
        state.lastTextByConv[key] = previewTextOf(normTemp);
        state.lastTsByConv[key] = new Date(
          normTemp.timestamp
        ).toISOString();
      })
      .addCase(sendMedia.fulfilled, (state, action) => {
        const { conversationId } = action.payload || {};
        const key = String(conversationId);
        state.sendingByConv[key] = false;
        const arr = state.byConv[key] || [];
        for (let i = arr.length - 1; i >= 0; i--) {
          const m = arr[i];
          if (
            String(m.id).startsWith("local-") &&
            (m.status === "sending" || !m.status)
          ) {
            m.status = "sent";
            lsUpsert(key, m);
            break;
          }
        }
      })
      .addCase(sendMedia.rejected, (state, action) => {
        const convKey =
          action.meta?.arg?.conversationId != null
            ? String(action.meta.arg.conversationId)
            : Object.keys(state.byConv).find((k) =>
                (state.byConv[k] || []).some((m) =>
                  String(m.id).startsWith("local-")
                )
              );
        if (convKey) {
          const arr = state.byConv[convKey] || [];
          for (let i = arr.length - 1; i >= 0; i--) {
            if (String(arr[i].id).startsWith("local-")) {
              arr[i].status = "failed";
              lsUpsert(convKey, arr[i]);
              break;
            }
          }
          state.byConv[convKey] = arr;
          state.sendingByConv[convKey] = false;
          state.error[convKey] =
            action.payload?.error || "Failed to send media";
        }
      })

      /* resolveMediaUrl → لما الـURL يبقى جاهز */
      .addCase(resolveMediaUrl.fulfilled, (state, action) => {
        const {
          conversationId,
          messageId,
          client_msg_id,
          media,
        } = action.payload || {};
        const cid = String(conversationId || "");
        if (!cid || !state.byConv[cid]) return;
        let msg = null;
        if (messageId != null)
          msg = state.byConv[cid].find(
            (m) => String(m.id) === String(messageId)
          );
        if (!msg && client_msg_id)
          msg = state.byConv[cid].find(
            (m) => m.client_msg_id === client_msg_id
          );
        if (!msg) return;
        msg.media = { ...(msg.media || {}), ...media };
        if (media?.url) {
          msg.body = {
            ...(msg.body || {}),
            url: media.url,
            type: msg.media?.kind || msg.body?.type,
          };
        }
      });
  },
});

export const {
  wsMessageReceived,
  wsMessageStatusUpdated,
  zeroUnread,
  setLastPreview,
  setUnreadCount,
  messagePatched,
} = messagesSlice.actions;

export default messagesSlice.reducer;

// /* ====================== Selectors ====================== */
// export const selectMessagesByConv = (s, id) => {
//   const arr = s.messages.byConv[String(id)] || [];
//   return arr.slice(); // مرجع جديد لتأكيد إعادة الرندر عند تغيّر media.url
// };
// export const selectMessagesLoading = (s, id) =>
//   !!s.messages.loading[String(id)];
// export const selectMessagesError = (s, id) =>
//   s.messages.error[String(id)] || null;
// export const selectLastTsByConv = (s, id) =>
//   s.messages.lastTsByConv[String(id)] || null;
// export const selectLastTextByConv = (s, id) =>
//   s.messages.lastTextByConv[String(id)] || "";
// export const selectUnreadCountByConv = (s, id) =>
//   s.messages.unreadByConv[String(id)] ?? 0;
// export const selectUnreadMap = (s) =>
//   s.messages.unreadByConv || {};
// export const selectIsSendingByConv = (s, id) =>
//   !!s.messages.sendingByConv[String(id)];

/* ====================== Selectors ====================== */
export const selectMessagesByConv = (s, id) =>
  s.messages.byConv[String(id)] || [];
// 💡 كده بنرجّع نفس المرجع لو مفيش تغييرات في الـ state
// ولو حصل تعديل في الرسائل أو media.url → Immer بيرجع آراي جديدة فيرجّع هنا مرجع جديد ⇒ re-render واحد بس وقت التغيير الفعلي

export const selectMessagesLoading = (s, id) =>
  !!s.messages.loading[String(id)];

export const selectMessagesError = (s, id) =>
  s.messages.error[String(id)] || null;

export const selectLastTsByConv = (s, id) =>
  s.messages.lastTsByConv[String(id)] || null;

export const selectLastTextByConv = (s, id) =>
  s.messages.lastTextByConv[String(id)] || "";

export const selectUnreadCountByConv = (s, id) =>
  s.messages.unreadByConv[String(id)] ?? 0;

export const selectUnreadMap = (s) =>
  s.messages.unreadByConv || {};

export const selectIsSendingByConv = (s, id) =>
  !!s.messages.sendingByConv[String(id)];
