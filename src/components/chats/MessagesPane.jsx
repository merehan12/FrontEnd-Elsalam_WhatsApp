

// src/components/chats/MessagesPane.jsx
import React, { useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { asTextSafe, extractText } from "../../utils/chatHelpers";
import SmartMedia from "./SmartMedia";
import { useDispatch } from "react-redux";
import { resolveMediaUrl } from "../../store/slices/messagesSlice";
import DateChip from "./DateChip";
import {
  pickMessageDate,
  formatDateHeader,
  formatTimeOnly,
} from "../../utils/datetime";
import { toApiUrl } from "../../api/axios";

/* ========== Helpers moved outside component ========== */

const labelForKind = (kind) => {
  if (kind === "image") return "[📷 صورة]";
  if (kind === "video") return "[🎥 فيديو]";
  if (kind === "audio") return "[🔊 مقطع صوتي]";
  if (kind === "document") return "[📄 ملف]";
  return "[رسالة بدون نص]";
};

const iconForKind = (kind) => {
  if (kind === "image") return "📷";
  if (kind === "video") return "🎥";
  if (kind === "audio") return "🔊";
  if (kind === "document") return "📄";
  return "💬";
};

const isPlaceholderText = (txt) => {
  if (!txt || typeof txt !== "string") return false;
  const t = txt.trim().toLowerCase();
  return (
    t === "[image]" ||
    t === "[صورة]" ||
    t === "[صوره]" ||
    t === "open image" ||
    t === "open file" ||
    t === "open document"
  );
};

const ensureAbsUrl = (u) => {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (/^(https?:|blob:|data:)/i.test(s)) return s;
  return toApiUrl(s);
};

const isPending = (m) => {
  const s = String(m?.status || "").toLowerCase();
  return s === "sending" || s === "queued";
};

const isFailed = (m) => String(m?.status || "").toLowerCase() === "failed";

const tryExtractMediaId = (msg) => {
  if (!msg) return null;
  if (msg.media_id) return msg.media_id;
  if (msg.body?.media_id) return msg.body.media_id;
  if (msg.media && msg.media.id) return msg.media.id;

  const urlCandidate =
    msg.media_url || msg.media?.url || msg.body?.media_url || msg.body?.url;
  if (urlCandidate && typeof urlCandidate === "string") {
    const m = urlCandidate.match(/\/media\/(\d+)\/?/);
    if (m) return m[1];
  }
  return null;
};

const getMediaFromMsg = (msg) => {
  if (!msg) return null;

  const textMarker = String(
    msg.text ||
      (typeof msg.body === "string" ? msg.body : "") ||
      (typeof msg.raw?.body === "string" ? msg.raw.body : "")
  ).toUpperCase();

  const isImageMarker =
    textMarker.includes("[IMAGE]") || textMarker.includes("[صورة]");

  const baseMedia = msg.media || {};
  let url =
    baseMedia.url ||
    baseMedia.file_url ||
    (typeof baseMedia.link === "string" ? baseMedia.link : null) ||
    msg.media_url ||
    msg.mediaUrl ||
    msg.file_url ||
    msg.url ||
    msg.body?.media_url ||
    msg.body?.file_url ||
    msg.body?.url ||
    null;

  if (url && typeof url !== "string") url = null;
  if (!url) return null;

  const safeUrl = ensureAbsUrl(url);

  let kind = String(
    baseMedia.kind || baseMedia.type || msg.type || msg.body?.type || ""
  ).toLowerCase();

  if (
    !["image", "video", "audio", "document"].includes(kind) ||
    ((!kind || kind === "document") && isImageMarker)
  ) {
    if (isImageMarker) kind = "image";
    else kind = "document";
  }

  return {
    ...baseMedia,
    link:
      typeof baseMedia.link === "string" ? ensureAbsUrl(baseMedia.link) : null,
    url: safeUrl,
    kind,
    caption: baseMedia.caption || msg.caption || msg.body?.caption || "",
    filename: baseMedia.filename || msg.filename || msg.body?.filename || null,
    mime_type:
      baseMedia.mime_type || msg.mime_type || msg.body?.mime_type || null,
  };
};

function MessagesPane({
  t,
  isRTL = false,
  messagesError,
  messagesLoading,
  visibleMessages,
  messagesWrapRef,
  messagesEndRef,
  onRetrySend,
  onReply,
}) {
  const dispatch = useDispatch();
  const requestedRef = useRef(new Set());

  // ✅ خريطة سريعة للرسائل (للـ reply lookup)
  const msgById = useMemo(() => {
    const m = new Map();
    (visibleMessages || []).forEach((x) => {
      if (x?.id != null) m.set(String(x.id), x);
    });
    return m;
  }, [visibleMessages]);

  useEffect(() => {
    (visibleMessages || []).forEach((m) => {
      const mediaFromMsg = getMediaFromMsg(m);
      const mid = tryExtractMediaId(m);
      const conv =
        m?.conversation_id || m?.conversation || m?.raw?.conversation_id;

      if (mid && conv && (!mediaFromMsg || !mediaFromMsg.url)) {
        const key = `${String(conv)}:${String(mid)}`;
        if (!requestedRef.current.has(key)) {
          requestedRef.current.add(key);
          dispatch(
            resolveMediaUrl({
              conversationId: String(conv),
              messageId: m.id,
              client_msg_id: m.client_msg_id,
              mediaId: mid,
            })
          );
        }
      }
    });
  }, [visibleMessages, dispatch]);

  const STICK_THRESH = 120;
  const stickToBottomRef = useRef(true);
  const debounceTimerRef = useRef(null);

  const isNearBottom = () => {
    const wrap = messagesWrapRef?.current;
    if (!wrap) return true;
    const distance = wrap.scrollHeight - wrap.clientHeight - wrap.scrollTop;
    return distance <= STICK_THRESH;
  };

  const updateStickFlag = () => {
    stickToBottomRef.current = isNearBottom();
  };

  const onScroll = () => {
    updateStickFlag();
  };

  useEffect(() => {
    const wrap = messagesWrapRef?.current;
    if (!wrap) return;
    wrap.addEventListener("scroll", onScroll, { passive: true });
    updateStickFlag();
    return () => {
      wrap.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToEnd = (smooth = true) => {
    const wrap = messagesWrapRef?.current;
    if (wrap && typeof wrap.scrollTo === "function") {
      const top = wrap.scrollHeight;
      try {
        wrap.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      } catch {
        wrap.scrollTop = top;
      }
      return;
    }
    const end = messagesEndRef?.current;
    if (end && end.scrollIntoView) {
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

  const scheduleScrollIfSticky = (smooth = true) => {
    if (!stickToBottomRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    requestAnimationFrame(() => {
      debounceTimerRef.current = setTimeout(() => {
        scrollToEnd(smooth);
        debounceTimerRef.current = null;
      }, 80);
    });
  };

  useLayoutEffect(() => {
    if (!messagesLoading) {
      if (isNearBottom()) scrollToEnd(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messagesLoading) return;
    const last = (visibleMessages || [])[visibleMessages.length - 1];
    const isOutgoing =
      last &&
      (String(last?.direction || "").toLowerCase() === "out" ||
        String(last?.sender || "").toLowerCase() === "agent");

    if (stickToBottomRef.current || isOutgoing) {
      scheduleScrollIfSticky(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLoading, visibleMessages?.length]);

  const grouped = useMemo(() => {
    const map = new Map();
    (visibleMessages || []).forEach((m) => {
      const d = pickMessageDate(m);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ m, d });
    });
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, arr]) => {
        arr.sort((a, b) => +a.d - +b.d);
        return { key: k, arr };
      });
  }, [visibleMessages]);

  return (
    <div
      ref={messagesWrapRef}
      className="flex-1 overflow-y-auto overscroll-contain no-scrollbar p-3 bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {messagesError && !messagesLoading && (
        <div className="sticky top-2 z-10 mx-auto w-max px-2 py-1 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 shadow">
          {t?.("chats.err_refresh", "Couldn't refresh messages")}
        </div>
      )}

      {messagesLoading && (!visibleMessages || visibleMessages.length === 0) && (
        <div className="p-4 text-sm text-gray-500">Loading…</div>
      )}

      {!messagesLoading &&
        grouped.map(({ key, arr }) => {
          const header = formatDateHeader(arr[0].d, isRTL);
          return (
            <React.Fragment key={key}>
              <DateChip label={header} />

              {arr.map(({ m, d }) => {
                const bubbleFromAgent =
                  m?.sender === "agent" || m?.direction === "out";

                const media = getMediaFromMsg(m);
                const hasMedia = !!media?.url;

                let extracted =
                  extractText(m) ||
                  asTextSafe(
                    m?.body?.raw?.message?.text?.body ||
                      m?.body?.raw?.messages?.[0]?.text?.body ||
                      m?.body?.raw?.text?.body ||
                      m?.text
                  );

                if (isPlaceholderText(extracted)) extracted = "";

                const caption =
                  media?.caption && String(media.caption).trim()
                    ? media.caption
                    : "";

                let bodyText = "";
                if (hasMedia)
                  bodyText =
                    caption && !isPlaceholderText(caption) ? caption : "";
                else
                  bodyText =
                    extracted && !isPlaceholderText(extracted) ? extracted : "";

                if (!hasMedia && !bodyText) return null;

                const pending = isPending(m);
                const failed = isFailed(m);
                const statusLower = String(m?.status || "").toLowerCase();

                const statusNode = (() => {
                  if (failed) {
                    return (
                      <span className="text-[10px] flex items-center gap-2">
                        {t?.("failed", "failed")}
                        <button
                          className="underline underline-offset-2"
                          onClick={() => onRetrySend?.(m)}
                          title={t?.("retry", "Retry")}
                        >
                          {t?.("retry", "Retry")}
                        </button>
                      </span>
                    );
                  }
                  if (pending) {
                    return (
                      <span className="text-[10px] opacity-80 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t?.("sending", "sending…")}
                      </span>
                    );
                  }
                  if (["sent", "delivered", "read"].includes(statusLower)) {
                    return (
                      <span className="text-[10px] opacity-70">{statusLower}</span>
                    );
                  }
                  return m?.status ? (
                    <span className="text-[10px] opacity-70">
                      {String(m.status)}
                    </span>
                  ) : null;
                })();

                const timeLabel = formatTimeOnly(
                  d,
                  isRTL ? "ar-EG" : "en-US"
                );
              const replyId =
  (typeof m?.reply_to === "object" ? m.reply_to?.id : m?.reply_to) ??
  m?.replyTo ??
  m?.reply_id ??
  m?.raw?.reply_to ??
  (typeof m?.raw?.reply_to === "object" ? m.raw.reply_to?.id : null) ??
  null;

const replyObj =
  (m?.reply && typeof m.reply === "object" ? m.reply : null) ||
  (typeof m?.reply_to === "object" ? m.reply_to : null) || // 👈 مهم لحالتك
  (m?.raw?.reply && typeof m.raw.reply === "object" ? m.raw.reply : null) ||
  null;

                const targetMsg =
                  !replyObj && replyId != null
                    ? msgById.get(String(replyId)) || null
                    : null;

                const replyMedia =
                  targetMsg ? getMediaFromMsg(targetMsg) : null;

                const computedReplyType = (() => {
                  if (replyObj?.type) return String(replyObj.type);
                  if (replyMedia?.url) return replyMedia.kind || "document";
                  return targetMsg ? "text" : "text";
                })();

                const computedReplyAuthor = (() => {
                  if (replyObj?.author) return String(replyObj.author);
                  if (targetMsg) {
                    return (
                      targetMsg?.author_username ||
                      targetMsg?.raw?.agent_name ||
                      (targetMsg?.sender === "agent" ? "You" : "Customer")
                    );
                  }
                  return isRTL ? "رسالة" : "Message";
                })();

                const computedReplyText = (() => {
                  const fromObj =
                    replyObj?.text && String(replyObj.text).trim()
                      ? String(replyObj.text)
                      : "";

                  if (fromObj) return fromObj;
                  if (replyObj?.text) return String(replyObj.text);
if (replyObj?.body?.text) return String(replyObj.body.text);


                  if (targetMsg) {
                    if (replyMedia?.url) return labelForKind(replyMedia.kind);
                    const txt =
                      extractText(targetMsg) ||
                      asTextSafe(targetMsg?.text) ||
                      "";
                    return txt || (isRTL ? "رسالة" : "Message");
                  }

                  return "";
                })();

                const hasReply =
                  !!replyId && (Boolean(replyObj) || Boolean(targetMsg));

                // RTL border: يمين في العربي، شمال في الإنجليزي
                const replyBorderSide = isRTL ? "border-r-4" : "border-l-4";
                const replyBorderColor = bubbleFromAgent
                  ? "border-white/70"
                  : "border-[#63bbb3]";

                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={`flex ${
                      bubbleFromAgent ? "justify-end" : "justify-start"
                    } mb-2`}
                  >
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-lg shadow-sm ${
                        bubbleFromAgent
                          ? "bg-[#63bbb3] text-white"
                          : "bg-white border border-gray-200 text-gray-900 dark:bg-gray-700 dark:border-transparent dark:text-white"
                      }`}
                    >
                      {bubbleFromAgent && (m.author_username || m.author_id) && (
                        <div className="text-[11px] mb-1 text-white/80">
                          {m.author_username || `Agent #${m.author_id}`}
                        </div>
                      )}

                      {hasReply && (
                        <div
                          className={[
                            "mb-2 rounded-md px-2 py-1 cursor-pointer",
                            replyBorderSide,
                            replyBorderColor,
                            bubbleFromAgent
                              ? "bg-white/15"
                              : "bg-gray-50 dark:bg-gray-800/50",
                          ].join(" ")}
                          onClick={() => {
                            if (!replyId) return;
                            const el = document.getElementById(`msg-${replyId}`);
                            if (el)
                              el.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }}
                          title={isRTL ? "انتقال للرسالة" : "Jump to message"}
                        >
                          <div
                            className={`text-[11px] font-semibold truncate ${
                              bubbleFromAgent
                                ? "text-white/90"
                                : "text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {computedReplyAuthor}
                          </div>

                          <div
                            className={`text-[12px] truncate flex items-center gap-1 ${
                              bubbleFromAgent
                                ? "text-white/85"
                                : "text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {computedReplyType !== "text" && (
                              <span className="shrink-0">
                                {iconForKind(computedReplyType)}
                              </span>
                            )}
                            <span className="truncate">
                              {computedReplyText || (isRTL ? "رسالة" : "Message")}
                            </span>
                          </div>
                        </div>
                      )}

                      {hasMedia && (
                        <SmartMedia
                          media={media}
                          caption={caption}
                          name={media?.filename || labelForKind(media?.kind)}
                          status={m?.status}
                          onLoaded={() => scheduleScrollIfSticky(true)}
                        />
                      )}

                      {bodyText && (
                        <p className="text-sm break-words">{asTextSafe(bodyText)}</p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-2">
                        {/* ✅ لون الوقت عند العميل كان باهت جدًا */}
                        <p
                          className={`text-[11px] ${
                            bubbleFromAgent
                              ? "text-white/80"
                              : "text-gray-500 dark:text-gray-300"
                          }`}
                        >
                          {timeLabel}
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`text-[11px] underline underline-offset-2 ${
                              bubbleFromAgent ? "text-white/85" : "text-gray-500"
                            } hover:opacity-100 opacity-80`}
                            onClick={() => onReply?.(m)}
                            title={isRTL ? "رد" : "Reply"}
                          >
                            {isRTL ? "رد" : "Reply"}
                          </button>

                          {statusNode}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

      <div ref={messagesEndRef} />

      {!messagesLoading && (!visibleMessages || visibleMessages.length === 0) && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          {t?.("no_messages", "No messages yet")}
        </div>
      )}
    </div>
  );
}

export default React.memo(MessagesPane);
