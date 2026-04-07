
// src/components/chats/Composer.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Paperclip,
  Mic,
  X,
  FileIcon,
  ImageIcon,
  VideoIcon,
  Music2,
  Trash2,
  Check,
} from "lucide-react";
import { useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { sendMedia, sendMessage } from "../../store/slices/messagesSlice";

export default function Composer({
  t,
  isRTL,
  draft,
  setDraft,
  isSending,
  conversationId, // optional (we also fallback to route)
  meId,
  meUsername,
  // 👇 جديد: هنستخدمه للنصوص لو حابة WS فقط
  onSend,

  // ✅ Reply props
  replyTarget,
  onCancelReply,
  onSent,
}) {
  const dispatch = useDispatch();
  const { id: routeConvId } = useParams();
  const effectiveConvId = conversationId ?? routeConvId ?? null;

  const [attachments, setAttachments] = useState([]);
  const [uiError, setUiError] = useState(null);
  const fileInputRef = useRef(null);

  /* ===== التسجيل الصوتي ===== */
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recIntervalRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recMimeRef = useRef(null);
  const recExtRef = useRef(null);

  const ensureAbsUrl = (u) => {
    if (!u) return null;
    const s = String(u);
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("blob:") || s.startsWith("data:")) return s;
    if (s.startsWith("/")) return s;
    return `/${s.replace(/^\/+/, "")}`;
  };

  // WhatsApp limits
  const MAX_SIZE = {
    image: 5 * 1024 * 1024,
    document: 100 * 1024 * 1024,
    audio: 16 * 1024 * 1024,
    video: 16 * 1024 * 1024,
  };
  const ALLOWED = {
    image: ["image/jpeg", "image/png", "image/webp"],
    document: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/csv",
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
    if (m.startsWith("application/") || m === "text/plain" || m === "text/csv")
      return "document";
    return "document";
  };

  const normalizeAudioMime = (mime = "") => {
    const m = String(mime || "").toLowerCase().replace(/\s+/g, "");
    if (m.startsWith("audio/ogg")) return "audio/ogg";
    if (m.startsWith("audio/mp4")) return "audio/mp4";
    if (m.startsWith("audio/aac")) return "audio/aac";
    if (m.startsWith("audio/mpeg")) return "audio/mpeg";
    if (m.startsWith("audio/opus")) return "audio/opus";
    if (m.startsWith("audio/amr")) return "audio/amr";
    return mime;
  };

  const validateFileForWhatsApp = (file, explicitType) => {
    if (!file) return "No file selected";
    const type = explicitType || guessTypeFromMime(file.type) || "document";
    const allowed = ALLOWED[type] || [];
    const max = MAX_SIZE[type] || MAX_SIZE.document;

    const lowerName = (file.name || "").toLowerCase();

    // امنع WEBM تمامًا (واتساب لا يدعمه)
    if (file.type === "video/webm" || lowerName.endsWith(".webm")) {
      return "WEBM غير مدعوم من WhatsApp. حوّل الفيديو إلى MP4 قبل الإرسال.";
    }
    if (type === "audio" && (file.type === "audio/webm" || lowerName.endsWith(".webm"))) {
      return "WEBM Audio غير مدعوم. استخدم OGG/OPUS أو M4A/AAC أو MP3.";
    }

    const checkType = type === "audio" ? normalizeAudioMime(file.type) : file.type;
    if (allowed.length && !allowed.includes(checkType)) {
      return `نوع الملف ${file.type || "(unknown)"} غير مدعوم لهذا النوع ${type}.`;
    }
    if (file.size > max) {
      return `حجم الملف أكبر من الحد (${Math.round(max / (1024 * 1024))}MB) للنوع ${type}.`;
    }
    return null;
  };

  function openPicker() {
    fileInputRef.current?.click();
  }

  function onPickFiles(e) {
    setUiError(null);
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = files.map((f) => ({
      file: f,
      url:
        f.type.startsWith("image/") ||
        f.type.startsWith("video/") ||
        f.type.startsWith("audio/")
          ? URL.createObjectURL(f)
          : null,
      kind: f.type,
      name: f.name || "file",
      size: f.size || 0,
    }));
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function removeAttachment(idx) {
    setAttachments((prev) => {
      const it = prev[idx];
      if (it?.url) URL.revokeObjectURL(it.url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  useEffect(() => {
    return () => {
      attachments.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      clearInterval(recIntervalRef.current);
      try {
        mediaRecorderRef.current?.stop?.();
      } catch {}
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (uiError && effectiveConvId) setUiError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveConvId]);

  const pickRecordingMime = () => {
    const CANDIDATES = [
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
      { mime: "audio/ogg", ext: "ogg" },
      { mime: "audio/mp4", ext: "m4a" },
      { mime: "audio/aac", ext: "aac" },
      { mime: "audio/mpeg", ext: "mp3" },
    ];
    for (const c of CANDIDATES) {
      try {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported?.(c.mime))
          return c;
      } catch {}
    }
    return null;
  };

  async function startRecordingUI() {
    if (isRecording) return;
    setUiError(null);

    const choice = pickRecordingMime();
    if (!choice) {
      setUiError(
        "التسجيل غير مدعوم بصيغة متوافقة مع واتساب على هذا المتصفح (يدعم WEBM فقط). استخدم Firefox (OGG) أو Safari (M4A)."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      recMimeRef.current = choice.mime;
      recExtRef.current = choice.ext;

      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: choice.mime });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (ev) => {
        if (ev?.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onerror = () => setUiError("تعذر بدء التسجيل الصوتي.");

      mr.start(250);
      setIsRecording(true);
      setRecSeconds(0);
      recIntervalRef.current = setInterval(
        () => setRecSeconds((s) => s + 1),
        1000
      );
    } catch {
      setUiError("تم رفض إذن الميكروفون أو تعذر الوصول إليه.");
    }
  }

  function stopRecordingUI() {
    try {
      mediaRecorderRef.current?.stop?.();
    } catch {}
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    clearInterval(recIntervalRef.current);
    recIntervalRef.current = null;
  }

  function cancelRecordingUI() {
    stopRecordingUI();
    chunksRef.current = [];
    setRecSeconds(0);
  }

  async function saveRecordingAsVoiceNote() {
    if (isRecording) stopRecordingUI();

    try {
      const mime = recMimeRef.current || "audio/ogg";
      const ext = recExtRef.current || "ogg";
      const blob = new Blob(chunksRef.current, { type: mime });

      if (!blob || blob.size === 0 || recSeconds < 1 || blob.size < 1200) {
        setUiError("التسجيل قصير جدًا.");
        return;
      }
      const ts = Date.now();
      const fakeName = `voice_${ts}.${ext}`;
      const file = new File([blob], fakeName, { type: mime });

      const err = validateFileForWhatsApp(file, "audio");
      if (err) {
        setUiError(err);
        return;
      }

      const url = URL.createObjectURL(file);
      const normMime = normalizeAudioMime(mime);
      const isOggVoice = /^audio\/ogg/i.test(normMime);

      setAttachments((prev) => [
        ...prev,
        { file, url, kind: file.type, name: fakeName, size: file.size, isVoice: isOggVoice },
      ]);

      chunksRef.current = [];
      setRecSeconds(0);
    } catch {
      setUiError("تعذر حفظ التسجيل الصوتي.");
    }
  }

  const recMM = String(Math.floor(recSeconds / 60)).padStart(2, "0");
  const recSS = String(recSeconds % 60).padStart(2, "0");

  // 👇 دي الدالة الأساسية اللي بتتندَه لما نعمل Send
  const handleSendClick = async () => {
    setUiError(null);

    const hasText = !!draft?.trim();
    const hasFiles = attachments.length > 0;

    // ===== أولاً: لو في مرفقات نستخدم الـ API (sendMedia) =====
    if (hasFiles) {
      if (!effectiveConvId) {
        setUiError("اختر محادثة أولاً قبل إرسال الوسائط.");
        return;
      }

      const caption = attachments.length === 1 && hasText ? draft.trim() : "";

      for (const a of attachments) {
        const explicitType = guessTypeFromMime(a.kind);
        const validationError = validateFileForWhatsApp(a.file, explicitType);
        if (validationError) {
          setUiError(validationError);
          return;
        }
      }

      const toSend = attachments.map((a) => ({ ...a }));
      attachments.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      setAttachments([]);
      if (caption) setDraft("");

      try {
        for (const a of toSend) {
          const explicitType = guessTypeFromMime(a.kind);
          await dispatch(
            sendMedia({
              conversationId: String(effectiveConvId),
              file: a.file,
              type: explicitType, // image | video | audio | document
              caption: explicitType === "audio" ? "" : caption,
              asVoice: false,
              meId,
              meUsername,
            })
          ).unwrap();
        }
      } catch (e) {
        setUiError(
          typeof e?.message === "string"
            ? e.message
            : "تعذر إرسال الوسائط، حاول مرة أخرى."
        );
      }
      return;
    }

    // ===== ثانياً: الرسالة النصية =====
    if (hasText) {
      if (!effectiveConvId) {
        setUiError("اختر محادثة أولاً قبل إرسال الرسالة.");
        return;
      }
      const text = draft.trim();
      const replyTo = replyTarget?.id ? String(replyTarget.id) : null;

      // 👈 لو الأب بعِت onSend → نستخدمه (هنا نفضّل الـ WebSocket)
      if (typeof onSend === "function") {
        setDraft("");
        try {
          // ✅ نمرّر reply_to كـ arg إضافي (JS يسمح) والـ parent يستقبله لو مضاف
          await onSend(text, { reply_to: replyTo, reply: replyTarget || null });
          onSent?.();
        } catch (e) {
          setUiError(
            typeof e?.message === "string"
              ? e.message
              : "تعذر إرسال الرسالة، حاول مرة أخرى."
          );
          // نرجّع النص عشان ما يضيعش
          setDraft(text);
        }
      } else {
        // Fallback: نفس السلوك القديم (API)
        setDraft("");
        try {
       dispatch(
  sendMessage({
    conversationId,
    text: draft,
    type: "text",
    reply_to: replyTarget?.id ?? null,

    // ✅ ده للـ UI فورًا
    reply: replyTarget
      ? {
          id: replyTarget.id,
          author: replyTarget.author,
          type: replyTarget.type,
          text: replyTarget.text,
        }
      : null,

    meId,
    meUsername,
  })
);

          onSent?.();
        } catch (e) {
          setUiError(
            typeof e?.message === "string"
              ? e.message
              : "تعذر إرسال الرسالة، حاول مرة أخرى."
          );
          setDraft(text);
        }
      }
    }
  };

  const disabledSend =
    isSending ||
    (!draft.trim() && attachments.length === 0) ||
    (!effectiveConvId && attachments.length > 0);

  return (
    <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pb-[env(safe-area-inset-bottom)]">
      {uiError && (
        <div className="mb-2 text-xs rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200 px-3 py-2 border border-red-200 dark:border-red-800">
          {uiError}
        </div>
      )}

      {/* ✅ Reply Bar */}
      {replyTarget?.id && (
        <div
          className={`mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
            isRTL ? "text-right" : ""
          } bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700`}
        >
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">
              {isRTL ? "رد على:" : "Reply to:"} {replyTarget.author || (isRTL ? "رسالة" : "Message")}
            </div>
            <div className="text-[12px] text-gray-600 dark:text-gray-300 truncate">
              {replyTarget.text || (isRTL ? "رسالة" : "Message")}
            </div>
          </div>

          <button
            type="button"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => onCancelReply?.()}
            title={isRTL ? "إلغاء الرد" : "Cancel reply"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a, i) => {
              const isImg = (a.kind || "").startsWith("image/");
              const isVid = (a.kind || "").startsWith("video/");
              const isAud = (a.kind || "").startsWith("audio/");
              return (
                <div
                  key={i}
                  className="group flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                >
                  {isImg ? (
                    <div className="w-10 h-10 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-600">
                      {a.url ? (
                        <img
                          src={ensureAbsUrl(a.url)}
                          alt={a.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 m-2 opacity-70" />
                      )}
                    </div>
                  ) : isVid ? (
                    <div className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-200 dark:bg-gray-600">
                      <VideoIcon className="w-5 h-5 opacity-70" />
                    </div>
                  ) : isAud ? (
                    <div className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-200 dark:bg-gray-600">
                      <Music2 className="w-5 h-5 opacity-70" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-200 dark:bg-gray-600">
                      <FileIcon className="w-5 h-5 opacity-70" />
                    </div>
                  )}

                  <div className="max-w-[160px]">
                    <div className="text-xs font-medium truncate">
                      {a.name || "attachment"}
                    </div>
                    <div className="text-[10px] opacity-70 truncate">
                      {isImg
                        ? "Image"
                        : isVid
                        ? "Video"
                        : isAud
                        ? "Voice/Audio"
                        : "File"}
                    </div>
                  </div>

                  <button
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    onClick={() => removeAttachment(i)}
                    title={t?.("remove", "Remove")}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] mb-2 opacity-70">
            {t?.(
              "limits.hint",
              "WhatsApp limits: Images up to 5MB, Audio/Video up to 16MB, Documents up to 100MB. WEBM is not supported."
            )}
          </div>
        </>
      )}

      {/* شريط التسجيل */}
      {isRecording && (
        <div className="mb-2 flex items-center justify-between px-3 py-2 rounded-lg border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <span className="text-sm font-medium">
              {String(recMM)}:{String(recSS)}
            </span>
            <span className="text-xs opacity-80">Recording…</span>
          </div>
          <div
            className={
              isRTL
                ? "space-x-reverse space-x-2 flex items-center"
                : "space-x-2 flex items-center"
            }
          >
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white"
              onClick={cancelRecordingUI}
              title={t?.("cancel", "Cancel")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-green-600 text-white"
              onClick={saveRecordingAsVoiceNote}
              title={t?.("save", "Save")}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div
        className={
          isRTL
            ? "space-x-reverse space-x-2 flex items-center"
            : "space-x-2 flex items-center"
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          className="hidden"
          onChange={onPickFiles}
        />

        <button
          type="button"
          onClick={openPicker}
          className="p-2 rounded-lg border bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white hover:opacity-90"
          title={t?.("attach", "Attach")}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t?.("chats.type", "Type your message...")}
          className={`flex-1 px-4 py-2 rounded-lg border bg-gray-50 border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white ${
            isRTL ? "text-right" : ""
          }`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendClick();
            }
          }}
        />

        {!isRecording ? (
          <button
            type="button"
            onClick={startRecordingUI}
            className="p-2 rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 hover:opacity-90"
            title={t?.("record", "Record")}
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecordingUI}
            className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            title={t?.("stop", "Stop")}
          >
            {t?.("stop", "Stop")}
          </button>
        )}

        <button
          onClick={handleSendClick}
          className="px-4 py-2 bg-[#952D8C] text-white rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center gap-2 shadow-sm active:scale-[0.99] transition"
          disabled={disabledSend}
          title={t?.("send", "Send")}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
