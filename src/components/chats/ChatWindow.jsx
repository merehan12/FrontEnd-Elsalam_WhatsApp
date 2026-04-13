
// src/components/chats/ChatWindow.jsx
import React from "react";
import { ArrowLeft, Loader2, MoreVertical, MessageSquare } from "lucide-react";
import { useSelector } from "react-redux";
import { selectIsSendingByConv } from "../../store/slices/messagesSlice";
import MessagesPane from "./MessagesPane";
import Composer from "./Composer";

function ChatWindow({
  isRTL,
  t,
  selectedChat,
  selectedChatData,
  statusLabel,
  closeOpenBtn,
  isUpdatingThis,
  onToggleStatus,
  menuOpen,
  setMenuOpen,
  onOpenComments,
  onOpenAssign,
  onOpenTimeline,
  closeMenuOpen,
  subMenuRef,
  subStatusesLoading,
  subStatusesError,
  subStatusesClosed,
  selectedSubStatusId,
  setSelectedSubStatusId,
  setCloseMenuOpen,
  messagesError,
  messagesLoading,
  visibleMessages,
  messagesWrapRef,
  messagesEndRef,
  onRetrySend,
  draft,
  setDraft,
  onSend,
  isSending,
  onBackToList,
  meId,
  meUsername,

  // ✅ reply state جاية من الأب (زي ما عندك)
  replyTarget,
  setReplyTarget,
}) {
  // حالة الإرسال الخاصة بالمحادثة الحالية من الـ Redux
  const isSendingByConv = useSelector((s) =>
    selectedChat ? selectIsSendingByConv(s, selectedChat) : false
  );

  // لو فيه حالة من السلايس نستخدمها، لو لأ نرجع للحالة اللي جاية من الأب
  const composerIsSending =
    typeof isSendingByConv === "boolean" ? isSendingByConv : !!isSending;

  // ✅ Reset reply عندما نغيّر المحادثة (مع Guard)
  React.useEffect(() => {
    if (typeof setReplyTarget === "function") setReplyTarget(null);
  }, [selectedChat, setReplyTarget]);

  // حساب تاريخ بداية المحادثة (أول رسالة ظاهرة)
  const conversationStart = React.useMemo(() => {
    if (!Array.isArray(visibleMessages) || visibleMessages.length === 0)
      return null;
    const first = visibleMessages[0];
    const d = new Date(
      first?.ts ||
        first?.timestamp ||
        first?.time ||
        first?.created_at ||
        Date.now()
    );
    return isNaN(+d) ? null : d;
  }, [visibleMessages]);

  const convStartLabel = conversationStart
    ? isRTL
      ? conversationStart.toLocaleDateString("ar-EG", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : conversationStart.toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
    : null;

  // ====== إغلاق المنيو عند الضغط خارجها / زر ESC ======
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    const handleOutside = (e) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    document.addEventListener("keydown", handleEsc, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
      document.removeEventListener("keydown", handleEsc, true);
    };
  }, [menuOpen, setMenuOpen]);

  if (!selectedChat) {
    return (
      <div className="flex-1 hidden md:flex items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-center">
          <MessageSquare className="w-20 h-20 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        selectedChat ? "flex" : "hidden"
      } flex-1 flex-col min-h-0 bg-white dark:bg-gray-800 md:flex`}
    >
      {selectedChatData && (
        <>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between relative sticky top-0 z-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-800/70">
            <div
              className={`flex items-center ${
                isRTL ? "space-x-reverse space-x-3" : "space-x-3"
              }`}
            >
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={onBackToList}
                title={t?.("back", "Back")}
              >
                <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <div className="w-10 h-10 bg-[#63bbb3] rounded-full flex items-center justify-center">
                <span className="text-white font-medium">
                  {selectedChatData.avatar}
                </span>
              </div>
              <div className={isRTL ? "text-right" : ""}>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {selectedChatData.name}
                </h3>

                {convStartLabel && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isRTL ? "تاريخ بدء المحادثة: " : "Conversation started: "}
                    {convStartLabel}
                  </p>
                )}
              </div>
            </div>

            <div
              className={`flex items-center ${
                isRTL ? "space-x-reverse space-x-2" : "space-x-2"
              } text-gray-600 dark:text-gray-300 relative`}
            >
              <button
                type="button"
                className={`${closeOpenBtn.className} flex items-center gap-2 disabled:opacity-60`}
                onClick={onToggleStatus}
                disabled={isUpdatingThis}
                title={closeOpenBtn.label}
              >
                {isUpdatingThis && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{closeOpenBtn.label}</span>
              </button>

              {/* زر القائمة */}
              <button
                className="relative p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setMenuOpen((v) => !v)}
                title={t?.("more", "More")}
                aria-haspopup="menu"
                aria-expanded={menuOpen ? "true" : "false"}
              >
                <MoreVertical className="w-5 h-5 cursor-pointer" />
              </button>

              {/* القائمة */}
              {menuOpen && (
                <div
                  ref={menuRef}
                  className={`absolute z-50 mt-2 w-56 rounded-xl shadow-xl border bg-white dark:bg-gray-800 dark:border-gray-700 ${
                    isRTL ? "left-4" : "right-4"
                  } top-14`}
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ul className="py-1 text-sm text-gray-800 dark:text-gray-200">
                    <li>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenComments();
                        }}
                        role="menuitem"
                      >
                        {t?.("comments", "Comments")}
                      </button>
                    </li>
                    <li>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenAssign();
                        }}
                        role="menuitem"
                      >
                        Assign
                      </button>
                    </li>
                    <li>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenTimeline();
                        }}
                        role="menuitem"
                      >
                        {t?.("timeline", "Timeline")}
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Sub-Status menu (when closing) */}
            {closeMenuOpen && (
              <div
                ref={subMenuRef}
                className={`absolute z-30 mt-2 p-3 w-72 rounded-xl shadow-xl border 
                  bg-white dark:bg-gray-800 
                  border-gray-200 dark:border-gray-700 
                  ${isRTL ? "left-0" : "right-0"} top-12`}
              >
                <h4 className="text-sm font-medium mb-2 text-gray-800 dark:text-white">
                  اختر سبب/حالة الإغلاق
                </h4>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {subStatusesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري التحميل...
                    </div>
                  ) : subStatusesError ? (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {String(subStatusesError)}
                    </div>
                  ) : (subStatusesClosed || []).length > 0 ? (
                    subStatusesClosed.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg 
                          hover:bg-gray-100 dark:hover:bg-gray-700 
                          text-sm cursor-pointer text-gray-800 dark:text-white"
                      >
                        <div className="truncate">
                          {s.name || s.title || `Sub #${s.id}`}
                        </div>
                        <input
                          type="radio"
                          name="subStatus"
                          value={s.id}
                          checked={Number(selectedSubStatusId) === Number(s.id)}
                          onChange={() => setSelectedSubStatusId(s.id)}
                          className="ml-2"
                        />
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      لا توجد Sub-Statuses متاحة
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 
                      text-gray-800 dark:text-white hover:opacity-90"
                    onClick={() => setCloseMenuOpen(false)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg bg-red-600 text-white 
                      hover:bg-red-700 disabled:opacity-60"
                    disabled={!selectedSubStatusId || isUpdatingThis}
                    onClick={onToggleStatus}
                  >
                    تأكيد الإغلاق
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <MessagesPane
            t={t}
            isRTL={isRTL}
            messagesError={messagesError}
            messagesLoading={messagesLoading}
            visibleMessages={visibleMessages}
            messagesWrapRef={messagesWrapRef}
            messagesEndRef={messagesEndRef}
            onRetrySend={onRetrySend}
            onReply={(msg) => {
              if (!msg?.id || typeof setReplyTarget !== "function") return;

              // ✅ preview صح: من الرسالة نفسها
              const selfText =
                (typeof msg?.text === "string" && msg.text.trim()) ||
                (typeof msg?.body?.text === "string" && msg.body.text.trim()) ||
                (typeof msg?.body?.caption === "string" &&
                  msg.body.caption.trim()) ||
                "";

              // ✅ لو ميديا ومافيش نص: حطي label
              const mediaKind =
                msg?.media?.kind ||
                (msg?.body?.type &&
                ["image", "video", "audio", "document"].includes(msg.body.type)
                  ? msg.body.type
                  : null);

              const label =
                mediaKind === "image"
                  ? "[📷 صورة]"
                  : mediaKind === "video"
                  ? "[🎥 فيديو]"
                  : mediaKind === "audio"
                  ? "[🔊 صوت]"
                  : mediaKind === "document"
                  ? "[📄 ملف]"
                  : "";

              const preview = selfText || label || (isRTL ? "رسالة" : "Message");

              setReplyTarget({
                id: msg.id,
                author:
                  msg?.author_username ||
                  msg?.raw?.agent_name ||
                  msg?.raw?.author ||
                  (msg?.sender === "agent" || msg?.direction === "out"
                    ? "You"
                    : "Customer"),
                type: mediaKind || msg?.type || msg?.raw?.type || "text",
                text: preview,
              });
            }}
          />

          {/* Composer */}
          <Composer
            key={selectedChat} // يعيد ضبط الحالة عند تبديل المحادثة
            t={t}
            isRTL={isRTL}
            draft={draft}
            setDraft={setDraft}
            onSend={onSend}
            isSending={composerIsSending}
            conversationId={selectedChat} // مهم جدًا لإرسال الميديا
            meId={meId}
            meUsername={meUsername}
            replyTarget={replyTarget}
            onCancelReply={() =>
              typeof setReplyTarget === "function" && setReplyTarget(null)
            }
            onSent={() =>
              typeof setReplyTarget === "function" && setReplyTarget(null)
            }
          />
        </>
      )}
    </div>
  );
}

export default React.memo(ChatWindow);
