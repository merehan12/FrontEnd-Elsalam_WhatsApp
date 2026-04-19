export function buildChatUrl(conversationId, token, baseOverride) {
  const base =
    (baseOverride && baseOverride.replace(/\/+$/, "")) ||
    "wss:///wh-land-backend-goet3.ondigitalocean.app";
  const u = new URL(
    `${base}/ws/chat/${encodeURIComponent(conversationId)}/`
  );

  if (token) {
    u.searchParams.set("token", token);
    // للتوافق مع باك إند يستخدم access
    u.searchParams.set("access", token);
  }
  return u.toString();
}

export function buildHubUrl(token, baseOverride) {
  const base =
    (baseOverride && baseOverride.replace(/\/+$/, "")) ||
    "wss:///wh-land-backend-goet3.ondigitalocean.app";

  const u = new URL(`${base}/ws/agent/`);
  if (token) {
    u.searchParams.set("token", token);
    u.searchParams.set("access", token);
  }
  return u.toString();
}

/* ============================================
 *  Helpers
 * ============================================
 */

// jitter حول قيمة ms عشان ما نبقاش بنعمل reconnect في نفس اللحظة
const withJitter = (ms, ratio = 0.2) => {
  const j = ms * ratio;
  return Math.max(0, ms - j + Math.random() * (2 * j));
};

const nowIso = () => new Date().toISOString();

const safeParse = (data) => {
  if (data == null) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

// لتقليل الـ logging في production
const IS_PROD =
  typeof process !== "undefined" &&
  process.env &&
  process.env.NODE_ENV === "production";

/** نضمن وجود conversation_id داخل الـ payload حتى لو السيرفر ما بعتهوش صريح */
function ensureConversationId(payload, conversationId) {
  if (!payload) return payload;
  const ev = payload?.event || "system";
  const data = payload?.data ?? payload ?? {};
  const cid =
    data?.conversation_id ??
    data?.conversation ??
    payload?.conversation_id ??
    conversationId ??
    null;
  return { event: ev, data: { ...data, conversation_id: cid } };
}

/** تطبيع موحد للرسالة: يرجّع {event, data, raw} */
function normalizePayload(parsed, conversationIdIfAny) {
  const ev = parsed?.event || "system";
  const dataRaw = parsed?.data ?? parsed ?? {};
  const cid =
    conversationIdIfAny ??
    dataRaw?.conversation_id ??
    dataRaw?.conversation ??
    parsed?.conversation_id ??
    null;
  const data = cid == null ? dataRaw : { ...dataRaw, conversation_id: cid };
  return { event: ev, data, raw: parsed };
}

const makeClientMsgId = () =>
  `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;


/* ============================================
 *  Base Reconnecting WS
 * ============================================
 */
class ReconnectingWS {
  /**
   * @param {Object} opts
   * @param {Function} opts.urlBuilder - (...urlArgs, base) => string
   * @param {Array}    opts.urlArgs
   * @param {Function} [opts.onOpen]
   * @param {Function} [opts.onClose]
   * @param {Function} [opts.onError]
   * @param {Function} [opts.onRaw]
   * @param {number}   [opts.heartbeatMs=25000]
   * @param {string}   [opts.base]
   * @param {Function} [opts.onFatalClose] - called when close code is fatal (e.g., 4401)
   */
  constructor({
    urlBuilder,
    urlArgs = [],
    onOpen,
    onClose,
    onError,
    onRaw,
    heartbeatMs = 25000,
    base,
    onFatalClose,
  }) {
    this._urlBuilder = urlBuilder;
    this._urlArgs = urlArgs;
    this._onOpen = onOpen;
    this._onClose = onClose;
    this._onError = onError;
    this._onRaw = onRaw;
    this._onFatalClose = onFatalClose;
    this._heartbeatMs = heartbeatMs;
    this._base = base;

    this.ws = null;
    this._closing = false;

    // Reconnect strategy
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // ⬅️ نحاول بلا حدود
    this.maxBackoff = 30000; // سقف 30s
    this._lastDelay = 1000; // start at 1s decorrelated jitter

    // Heartbeat / inactivity
    this._heartbeatTimer = null;
    this._reconnectTimer = null;
    this._lastRxTs = Date.now();
    this._inactivityMs = Math.max(heartbeatMs * 1.8, 45000); // يعتبر ميت لو لا Rx خلال ~1.8× heartbeat

    // Outbox (bounded)
    this._outbox = [];
    this._outboxMax = 200;

    // Rate limiting
    this._minSendGapMs = 40; // ~25 msg/sec
    this._lastSendTs = 0;

    // Browser awareness
    if (typeof window !== "undefined") {
      this._onOnline = () => {
        if (!this.isOpen()) this._scheduleReconnect(250);
      };

      window.addEventListener("online", this._onOnline);

      this._onVisibility = () => {
        if (document.visibilityState === "visible") {
          this._startHeartbeat();
          if (!this.isOpen()) this._scheduleReconnect(250);
        } else {
          this._clearHeartbeatOnly();
        }
      };
      document.addEventListener("visibilitychange", this._onVisibility);
    }
  }

  /* ---------- public helpers ---------- */
  setUrlArgs(nextArgs) {
    this._urlArgs = Array.isArray(nextArgs) ? nextArgs.slice() : [nextArgs];
  }

  setBase(nextBase) {
    this._base = nextBase;
  }

  async awaitUntilOpen(timeoutMs = 5000) {
    if (this.isOpen()) return;
    await new Promise((res, rej) => {
      const start = Date.now();
      const t = setInterval(() => {
        if (this.isOpen()) {
          clearInterval(t);
          res();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          rej(new Error("WS open timeout"));
        }
      }, 50);
    });
  }

  isOpen() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /* ---------- internals ---------- */
  _clearHeartbeatOnly() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _clearTimers() {
    this._clearHeartbeatOnly();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _startHeartbeat() {
    if (!this._heartbeatMs) return;
    this._clearHeartbeatOnly();
    this._heartbeatTimer = setInterval(() => {
      // Send ping
      this.sendJson({ event: "ping", data: { ts: nowIso() } });
      // Force reconnect if no inbound traffic for too long
      if (Date.now() - this._lastRxTs > this._inactivityMs) {
        if (!IS_PROD) {
          // في production مش محتاجين noise في الـ console
          // لكن في dev مهم للتشخيص
          // eslint-disable-next-line no-console
          console.warn("[WS] No activity, forcing reconnect…");
        }
        try {
          this.ws && this.ws.close();
        } catch {
          /* ignore */
        }
      }
    }, this._heartbeatMs);
  }

  _scheduleReconnect(baseDelayMs) {
    if (this._closing) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.warn("[WS] Reconnect limit reached — giving up.");
      }
      return;
    }

    // Decorrelated jitter backoff
    const max = this.maxBackoff;
    const rawBase =
      baseDelayMs != null ? baseDelayMs : Math.min(max, this._lastDelay * 3);

    // نتأكد إن baseDelay مش أقل من 1s عشان المعادلة تفضل سليمة
    const safeBase = Math.max(1000, rawBase);
    const d = Math.floor(withJitter(safeBase, 0.3));
    this._lastDelay = d;

    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (!IS_PROD) {
      // eslint-disable-next-line no-console
      console.info(
        `[WS] Reconnecting in ~${Math.round(
          d
        )}ms (attempt ${this.reconnectAttempts + 1})`
      );
    }
    this._reconnectTimer = setTimeout(() => this.connect(), d);
  }

  connect() {
    this._closing = false;
    this._clearTimers();

    let wsUrl;
    try {
      wsUrl = this._urlBuilder(...this._urlArgs, this._base);
    } catch (e) {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.error("[WS] URL build error:", e);
      }
      return;
    }
    if (!IS_PROD) {
      // eslint-disable-next-line no-console
      console.info("[WS] Connecting to:", wsUrl);
    }

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.error("[WS] Constructor error:", e);
      }
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._lastDelay = 1000; // reset delay بعد successful open
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.log(
          "%c[WS] Connected ✓",
          "color:#22c55e;font-weight:700"
        );
      }
      this._lastRxTs = Date.now();
      this._startHeartbeat();

      if (this._outbox.length) {
        for (const msg of this._outbox) {
          try {
            this.ws.send(msg);
          } catch {
            /* ignore */
          }
        }
        this._outbox = [];
      }

      this._onOpen && this._onOpen();
    };

    this.ws.onmessage = (ev) => {
      this._lastRxTs = Date.now();
      this._onRaw && this._onRaw(ev.data);
    };

    this.ws.onerror = (e) => {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.error("[WS] Error:", e);
      }
      this._onError && this._onError(e);
    };

    this.ws.onclose = (e) => {
      if (!IS_PROD) {
        // eslint-disable-next-line no-console
        console.warn(
          `[WS] Closed (code=${e.code}, reason="${e.reason || ""}")`
        );
      }
      const FATAL_CLOSE_CODES = new Set([
        1002,
        1003,
        1007,
        1008,
        1011,
        1015,
        4401, // 4401: Unauthorized (custom)
      ]);

      this._onClose && this._onClose(e);

      // Fatal? don't retry
      if (FATAL_CLOSE_CODES.has(e.code)) {
        this._onFatalClose && this._onFatalClose(e);
        return;
      }

      if (this._closing) return;

      this.reconnectAttempts += 1;
      this._clearTimers();
      this._scheduleReconnect();
    };
  }

  sendRaw(str) {
    if (!str) return;

    const trySend = () => {
      this._lastSendTs = Date.now();
      try {
        this.ws.send(str);
      } catch {
        /* ignore */
      }
    };

    if (this.isOpen()) {
      const now = Date.now();
      const delta = now - this._lastSendTs;
      if (delta >= this._minSendGapMs) {
        trySend();
      } else {
        setTimeout(() => {
          if (this.isOpen()) trySend();
          else {
            // fallback to outbox if closed in the meantime
            if (this._outbox.length >= this._outboxMax) this._outbox.shift();
            this._outbox.push(str);
          }
        }, this._minSendGapMs - delta);
      }
    } else {
      if (this._outbox.length >= this._outboxMax) this._outbox.shift();
      this._outbox.push(str);
    }
  }

  sendJson(obj) {
    try {
      const s = JSON.stringify(obj);
      this.sendRaw(s);
    } catch {
      /* ignore */
    }
  }

  disconnect() {
    this._closing = true;
    this._clearTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  destroy() {
    this.disconnect();
    if (typeof window !== "undefined") {
      if (this._onOnline) window.removeEventListener("online", this._onOnline);
      if (this._onVisibility) {
        document.removeEventListener(
          "visibilitychange",
          this._onVisibility
        );
      }
    }
  }
}

/* ============================================
 *  Chat Room WS (/ws/chat/<id>/)
 * ============================================
 */
export class ChatWebSocket {
  /**
   * @param {string|number} conversationId
   * @param {string} accessToken
   * @param {Object} [opts]
   * @param {(evName:string, payload:any)=>void} [opts.onEvent]
   * @param {Function} [opts.onOpen]
   * @param {Function} [opts.onClose]
   * @param {Function} [opts.onError]
   * @param {Function} [opts.onAuthExpired] - called if server closes with auth-related fatal code
   * @param {string}   [opts.base]
   * @param {number}   [opts.heartbeatMs=25000]
   */
  constructor(
    conversationId,
    accessToken,
    {
      onEvent,
      onOpen,
      onClose,
      onError,
      onAuthExpired,
      base,
      heartbeatMs = 25000,
    } = {}
  ) {
    this.conversationId = conversationId;
    this.accessToken = accessToken;
    this.base = base;

    const onFatalClose = (e) => {
      if (typeof onAuthExpired === "function") onAuthExpired(e);
    };

    this._core = new ReconnectingWS({
      urlBuilder: (id, token, baseOverride) =>
        buildChatUrl(id, token, baseOverride),
      urlArgs: [this.conversationId, this.accessToken],
      onOpen,
      onClose,
      onError,
      onRaw: (raw) => {
        const parsed = safeParse(raw);
        if (!parsed) return;
        // نضمن conversation_id + تطبيع موحّد
        const ensured = ensureConversationId(parsed, this.conversationId);
        const normalized = normalizePayload(ensured, this.conversationId);
        const evName = normalized.event || "system";
        // Backward-compatible signature: (eventName, payloadObject)
        onEvent && onEvent(evName, normalized);
      },
      heartbeatMs,
      base: this.base,
      onFatalClose,
    });
  }

  /* ---------- lifecycle ---------- */
  connect() {
    this._core.connect();
  }

  disconnect() {
    this._core.disconnect();
  }

  destroy() {
    this._core.destroy();
  }

  isOpen() {
    return this._core.isOpen();
  }

  /* ---------- dynamic config ---------- */
  setToken(newToken) {
    this.accessToken = newToken;
    this._core.setUrlArgs([this.conversationId, this.accessToken]);
    if (!this.isOpen()) this._core.connect();
  }

  setBase(newBase) {
    this.base = newBase;
    this._core.setBase(newBase);
    if (this.isOpen()) {
      this._core.disconnect();
      this._core.connect();
    }
  }

    /**
   * إرسال رسالة نصية عبر WS
   * @param {string} text
   * @param {Object} [opts]
   * @param {number} [opts.reply_to]  - message id to reply to
   * @param {string} [opts.client_msg_id] - optional client-generated id
   */
  async sendText(text, opts = {}) {
    try {
      await this._core.awaitUntilOpen(2000);
    } catch {
      // outbox هيتعامل لو متفتحش
    }

    const cleanText =
      typeof text === "string" ? text : String(text ?? "");

    const payload = {
      event: "message:send",
      data: {
        type: "text",
        body: { text: cleanText }, // ✅ مطابق للباك
        client_msg_id: opts.client_msg_id || makeClientMsgId(), // ✅ مهم للمطابقة
        reply_to: opts.reply_to ?? undefined, // ✅ reply support
      },
    };

    this._core.sendRaw(JSON.stringify(payload));

    // مفيد ترجع client_msg_id للفرونت عشان optimistic UI
    return payload.data.client_msg_id;
  }


  /**
   * إرسال ميديا عبر WS
   * @param {Object} payload
   * @param {number} payload.media_id
   * @param {"image"|"video"|"audio"|"doc"|"document"} payload.type
   * @param {string} [payload.caption]
   * @param {number} [payload.id] - optional
   * @param {number} [payload.reply_to]
   * @param {string} [payload.client_msg_id]
   */
  async sendMedia({ media_id, type, caption, id, reply_to, client_msg_id }) {
    try {
      await this._core.awaitUntilOpen(2000);
    } catch {
      // outbox هيهندل لو متفتحش
    }

    let wsType = type;
    switch (type) {
      case "document":
      case "doc":
        wsType = "doc";
        break;
      default:
        wsType = type;
    }

    const payload = {
      event: "media:send",
      data: {
        id: id ?? 0,
        media_id,
        type: wsType,
        caption: caption ?? undefined,
        client_msg_id: client_msg_id || makeClientMsgId(), // ✅
        reply_to: reply_to ?? undefined, // ✅
      },
    };

    this._core.sendRaw(JSON.stringify(payload));
    return payload.data.client_msg_id;
  }


  sendJson(obj) {
    this._core.sendJson(obj);
  }
}

/* ============================================
 *  Hub WS (/ws/agent/)
 * ============================================
 */
export class ConversationsHubWS {
  /**
   * @param {string} accessToken
   * @param {Object} [opts]
   * @param {(evName:string, payload:any)=>void} [opts.onEvent]
   * @param {Function} [opts.onOpen]
   * @param {Function} [opts.onClose]
   * @param {Function} [opts.onError]
   * @param {Function} [opts.onAuthExpired]
   * @param {string}   [opts.base]
   * @param {number}   [opts.heartbeatMs=25000]
   */
  constructor(
    accessToken,
    {
      onEvent,
      onOpen,
      onClose,
      onError,
      onAuthExpired,
      base,
      heartbeatMs = 25000,
    } = {}
  ) {
    this.accessToken = accessToken;
    this.base = base;

    const onFatalClose = (e) => {
      if (typeof onAuthExpired === "function") onAuthExpired(e);
    };

    this._core = new ReconnectingWS({
      urlBuilder: (token, baseOverride) => buildHubUrl(token, baseOverride),
      urlArgs: [this.accessToken],
      onOpen,
      onClose,
      onError,
      onRaw: (raw) => {
        const parsed = safeParse(raw);
        if (!parsed) return;
        // ما بنفرضش conversation_id هنا، بس بنرجّع normalized موحد
        const normalized = normalizePayload(parsed, null);
        const evName = normalized.event || "system";
        onEvent && onEvent(evName, normalized);
      },
      heartbeatMs,
      base: this.base,
      onFatalClose,
    });
  }

  /* ---------- lifecycle ---------- */
  connect() {
    this._core.connect();
  }

  disconnect() {
    this._core.disconnect();
  }

  destroy() {
    this._core.destroy();
  }

  isOpen() {
    return this._core.isOpen();
  }

  /* ---------- dynamic config ---------- */
  setToken(newToken) {
    this.accessToken = newToken;
    this._core.setUrlArgs([this.accessToken]);
    if (!this.isOpen()) this._core.connect();
  }

  setBase(newBase) {
    this.base = newBase;
    this._core.setBase(newBase);
    if (this.isOpen()) {
      this._core.disconnect();
      this._core.connect();
    }
  }

  /* ---------- sending ---------- */
  sendJson(obj) {
    this._core.sendJson(obj);
  }
}

/* -------- توافق الاسم القديم -------- */
export { ChatWebSocket as ChatSocket };
