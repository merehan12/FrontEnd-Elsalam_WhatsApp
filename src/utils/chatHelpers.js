// src/utils/chatHelpers.js
export function toDateFromAny(ts) {
  if (!ts) return null;
  if (typeof ts === "string" && /^\d+$/.test(ts)) {
    const n = Number(ts);
    if (!Number.isNaN(n)) return new Date(n * 1000);
  }
  if (typeof ts === "number") {
    return new Date(ts < 1e12 ? ts * 1000 : ts);
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(ts) {
  const d = toDateFromAny(ts);
  if (!d) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function asTextSafe(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (v.body) return asTextSafe(v.body);
    if (v.text) return asTextSafe(v.text);
    if (v.value) return asTextSafe(v.value);
    if (v.raw) return asTextSafe(v.raw);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export const inlineText = (v) =>
  typeof v === "string" || typeof v === "number"
    ? String(v)
    : asTextSafe(
        v?.username ?? v?.name ?? v?.title ?? v?.label ?? v?.value ?? v ?? "—"
      );

/* ===== extractText (نفس المنطق) ===== */
export function extractText(m) {
  if (!m) return "";
  const direct = [
    m?.text, m?.message, m?.content, m?.preview, m?.caption, m?.body,
    m?.body?.text, m?.body?.body, m?.body?.message,
    m?.raw?.text, m?.raw?.message, m?.payload?.text, m?.payload?.message,
    m?.last_message_text,
  ];
  for (const v of direct) {
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "object" && typeof v?.body === "string" && v.body.trim())
      return v.body;
  }

  const wa1 =
    m?.body?.raw?.text?.body ||
    m?.body?.raw?.text ||
    m?.body?.raw?.message?.text?.body ||
    m?.body?.raw?.messages?.[0]?.text?.body ||
    m?.body?.raw?.caption ||
    m?.body?.caption ||
    m?.caption ||
    m?.image?.caption ||
    m?.video?.caption ||
    m?.document?.caption;
  if (typeof wa1 === "string" && wa1.trim()) return wa1;

  const interactiveTitle =
    m?.body?.raw?.interactive?.button_reply?.title ||
    m?.body?.raw?.interactive?.list_reply?.title ||
    m?.interactive?.button_reply?.title ||
    m?.interactive?.list_reply?.title;
  if (typeof interactiveTitle === "string" && interactiveTitle.trim())
    return interactiveTitle;

  const templateComps =
    m?.body?.raw?.template?.components || m?.template?.components;
  if (Array.isArray(templateComps)) {
    for (const c of templateComps) {
      const ps = c?.parameters;
      if (Array.isArray(ps)) {
        const texts = ps
          .map((p) => p?.text || p?.payload || p?.body)
          .filter((x) => typeof x === "string" && x.trim());
        if (texts.length) return texts.join(" ");
      }
    }
  }

  const arr =
    m?.messages ||
    m?.body?.messages ||
    m?.body?.raw?.messages ||
    m?.raw?.body?.raw?.messages;
  if (Array.isArray(arr) && arr.length) {
    const m0 = arr[0];
    const fromArray =
      m0?.text?.body || m0?.text || m0?.caption || m0?.message || m0?.body;
    if (typeof fromArray === "string" && fromArray.trim()) return fromArray;
  }

  const entryMsg =
    m?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ||
    m?.raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (entryMsg) {
    const t =
      entryMsg?.text?.body ||
      entryMsg?.button?.text ||
      entryMsg?.interactive?.button_reply?.title ||
      entryMsg?.interactive?.list_reply?.title ||
      entryMsg?.image?.caption ||
      entryMsg?.video?.caption ||
      entryMsg?.document?.caption ||
      entryMsg?.audio?.caption;
    if (typeof t === "string" && t.trim()) return t;
  }

  const quoted =
    m?.context?.quoted_message?.text?.body ||
    m?.context?.quoted_message?.caption;
  if (typeof quoted === "string" && quoted.trim()) return quoted;

  return "";
}

export const asNumericIdOrNull = (v) => {
  if (v == null) return null;
  const s = String(v);
  return /^\d+$/.test(s) ? s : null;
};

/* ---------- رقم العميل ---------- */
export const pickNumberOnly = (obj = {}) =>
  obj?.customer?.phone_e164 ??
  obj?.customer?.wa_id ??
  obj?.wa_id ??
  obj?.customer_phone ??
  obj?.phone ??
  obj?.msisdn ??
  obj?.number ??
  null;

export const isIdOrUnknown = (name, id) => {
  const n = String(name ?? "").trim();
  const key = String(id ?? "").trim();
  if (!n) return true;
  if (n.toLowerCase() === "unknown") return true;
  if (n === key) return true;
  return false;
};

export function isInboundFromCustomer(msg = {}) {
  const dir = String(msg.direction || msg.dir || "").toLowerCase();
  const snd = String(msg.sender || msg.from || "").toLowerCase();
  const ev = String(msg.type || msg.event || "").toLowerCase();

  if (ev === "auto_response" || ev === "system") return false;
  if (dir === "out" || dir === "outbound") return false;
  if (dir === "in" || dir === "incoming") return true;

  if (["agent", "staff", "operator", "admin"].includes(snd)) return false;
  if (["customer", "client", "user"].includes(snd)) return true;

  return true;
}

/* ---------- ترتيب بالتاريخ الأحدث ---------- */
export function tsNum(x) {
  if (!x) return 0;
  const n = typeof x === "number" ? x : new Date(x).getTime();
  return Number.isFinite(n) ? n : 0;
}
export function sortByLatestDesc(list) {
  return [...list].sort((a, b) => tsNum(b._updated_at) - tsNum(a._updated_at));
}

/* ---------- Map conversation ---------- */
export function mapConversationApiToUI(c) {
  const numRaw = pickNumberOnly(c);
  const num = numRaw ? String(numRaw).trim() : "";
  const lastMsgText =
    extractText(c?.last_message) || c?.last_message_text || c?.preview || "";

  const lastMsgTime =
    c?.last_message_at ||
    c?.last_message?.created_at ||
    c?.last_message?.timestamp ||
    c?.updated_at ||
    c?.created_at ||
    null;

  const unread = c?.unread_count ?? c?.unread ?? 0;
  const assignedTo =
    c?.assigned_to?.username ?? c?.assigned_to?.name ?? c?.assigned_to ?? null;
  const status = c?.status || c?.customer_status || "offline";

  return {
    id: String(c?.id),
    name: num || "Unknown",
    last_message: c?.last_message
      ? { ...c.last_message }
      : lastMsgText
      ? { text: lastMsgText, timestamp: lastMsgTime }
      : undefined,
    last_message_text: c?.last_message_text ?? lastMsgText ?? "",
    unread_count: unread,
    unread: unread,
    time: formatTime(lastMsgTime),
    avatar: (num || `C${c?.id}`).slice(-2).toUpperCase(),
    status,
    assigned_to: assignedTo,
    wsKey: String(c?.id),
    _updated_at: lastMsgTime || c?.updated_at || c?.created_at || Date.now(),
  };
}

/* ---------- دمج + الحفاظ على unread ---------- */
export function mergeListsKeepUnread(prevList = [], incomingList = [], openId = null) {
  const openKey = openId != null ? String(openId) : null;
  const map = new Map();
  prevList.forEach((x) => map.set(String(x.id), { ...x, id: String(x.id) }));

  for (const item of incomingList) {
    const key = String(item.id);
    if (!key) continue;
    const old = map.get(key);
    const incoming = { ...item, id: key };

    if (!old) { map.set(key, incoming); continue; }

    const mergedName = isIdOrUnknown(incoming.name, key)
      ? old.name || incoming.name
      : incoming.name;

    if (openKey !== key) {
      const bestUnread = Math.max(
        Number(old.unread || 0),
        Number(incoming.unread || 0)
      );
      incoming.unread = bestUnread;
    } else {
      incoming.unread = 0;
    }

    const mergedAssigned =
      incoming.assigned_to != null && incoming.assigned_to !== ""
        ? incoming.assigned_to
        : old.assigned_to;

    const chosenMsg = incoming.lastMessage?.trim()
      ? incoming.lastMessage
      : old.lastMessage;
    const chosenTime = incoming.time?.trim() ? incoming.time : old.time;
    const chosenUpdated = incoming._updated_at || old._updated_at || Date.now();

    map.set(key, {
      ...old,
      ...incoming,
      name: mergedName,
      assigned_to: mergedAssigned,
      lastMessage: chosenMsg || "",
      time: chosenTime || "",
      _updated_at: chosenUpdated,
    });
  }

  return sortByLatestDesc([...map.values()]);
}

/* ---------- حرك لأعلى ---------- */
export function bumpConv(list, cid, patch = (c) => c) {
  const key = String(cid);
  const idx = list.findIndex((c) => String(c.id) === key);
  if (idx === -1) return list;
  const next = [...list];
  next[idx] = patch(next[idx]);
  const [item] = next.splice(idx, 1);
  return [item, ...next];
}

/* ---------- Preview آمن ---------- */
export function previewTextFromChat(chat) {
  if (typeof chat?.lastMessage === "string" && chat.lastMessage.trim()) {
    return chat.lastMessage;
  }
  if (
    typeof chat?.last_message_text === "string" &&
    chat.last_message_text.trim()
  ) {
    return chat.last_message_text;
  }
  if (chat?.last_message) {
    const v = extractText(chat.last_message);
    if (v && v.trim()) return v;
  }
  return "";
}

/* ---------- شكل رقم ---------- */
export function looksLikePhone(s = "") {
  return /^[+\d][\d\s\-()]*$/.test(String(s).trim());
}
