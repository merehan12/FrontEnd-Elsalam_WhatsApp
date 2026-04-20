// src/components/chats/TemplatePickerModal.jsx
import React, { useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  X,
  Loader2,
  Search,
  MessageSquareText,
  Globe,
  Tag,
  Send,
  CornerDownRight,
  Link as LinkIcon,
  Phone,
} from "lucide-react";

import {
  closeTemplatePicker,
  setTemplateSearch,
  setSelectedTemplateId,
  fetchTemplateDetail,
  clearTemplateSelection,
  fetchAvailableTemplates,
  selectTemplatePickerOpen,
  selectTemplateSearch,
  selectAvailableTemplates,
  selectAvailableTemplatesLoading,
  selectAvailableTemplatesError,
  selectSelectedTemplateId,
  selectSelectedTemplateDetail,
  selectTemplateDetailLoading,
  selectTemplateDetailError,
} from "../../store/slices/waTemplatesSlice";

import {
  sendTemplateMessage,
  selectIsSendingByConv,
} from "../../store/slices/messagesSlice";

function getHeaderComponent(components) {
  if (!Array.isArray(components)) return null;
  return components.find(
    (c) => String(c?.type || "").toUpperCase() === "HEADER"
  );
}

function getBodyComponent(components) {
  if (!Array.isArray(components)) return null;
  return components.find(
    (c) => String(c?.type || "").toUpperCase() === "BODY"
  );
}

function getButtonsComponent(components) {
  if (!Array.isArray(components)) return null;
  return components.find(
    (c) => String(c?.type || "").toUpperCase() === "BUTTONS"
  );
}

function ButtonPreview({ button }) {
  const type = String(button?.type || "").toUpperCase();

  if (type === "QUICK_REPLY") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
        <CornerDownRight className="w-4 h-4 opacity-70" />
        <span>{button?.text || "Quick Reply"}</span>
      </div>
    );
  }

  if (type === "URL") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
        <LinkIcon className="w-4 h-4 opacity-70" />
        <span>{button?.text || "Open Link"}</span>
      </div>
    );
  }

  if (type === "PHONE_NUMBER") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
        <Phone className="w-4 h-4 opacity-70" />
        <span>{button?.text || button?.phone_number || "Call"}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
      <span>{button?.text || type || "Button"}</span>
    </div>
  );
}

function TemplateCard({ item, isActive, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition ${
        isActive
          ? "border-[#63bbb3] bg-[#63bbb3]/10"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {item?.name || "Template"}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              <Tag className="w-3 h-3" />
              {item?.category || "—"}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              <Globe className="w-3 h-3" />
              {item?.language || "—"}
            </span>
          </div>

          {!!item?.button_summary?.length && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
              {item.button_summary
                .map((b) => b?.text || b?.type)
                .filter(Boolean)
                .join(" • ")}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function TemplatePickerModal({
  conversationId,
  onSuccess,
  t,
  isRTL,
}) {
  const dispatch = useDispatch();
  const sendLockRef = useRef(false);

  const pickerOpen = useSelector(selectTemplatePickerOpen);
  const search = useSelector(selectTemplateSearch);
  const items = useSelector(selectAvailableTemplates);
  const availableLoading = useSelector(selectAvailableTemplatesLoading);
  const availableError = useSelector(selectAvailableTemplatesError);
  const selectedTemplateId = useSelector(selectSelectedTemplateId);
  const selectedTemplateDetail = useSelector(selectSelectedTemplateDetail);
  const detailLoading = useSelector(selectTemplateDetailLoading);
  const detailError = useSelector(selectTemplateDetailError);

  const sendLoading = useSelector((s) =>
    selectIsSendingByConv(s, conversationId)
  );

  const filteredItems = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return items || [];

    return (items || []).filter((item) => {
      const name = String(item?.name || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      const language = String(item?.language || "").toLowerCase();
      return name.includes(q) || category.includes(q) || language.includes(q);
    });
  }, [items, search]);

  if (!pickerOpen) return null;

  const components = selectedTemplateDetail?.components_json || [];
  const header = getHeaderComponent(components);
  const body = getBodyComponent(components);
  const buttonsBlock = getButtonsComponent(components);
  const buttons = buttonsBlock?.buttons || [];

  const handleClose = () => {
    dispatch(closeTemplatePicker());
    dispatch(clearTemplateSelection());
    dispatch(setTemplateSearch(""));
  };

  const handleRefresh = () => {
    dispatch(fetchAvailableTemplates());
  };

  const handleSelectTemplate = (template) => {
    if (!template?.id) return;
    dispatch(setSelectedTemplateId(template.id));
    dispatch(fetchTemplateDetail(template.id));
  };

  const handleSendTemplate = async () => {
    if (
      sendLockRef.current ||
      !conversationId ||
      !selectedTemplateDetail?.id ||
      sendLoading
    ) {
      return;
    }

    sendLockRef.current = true;

    try {
      const result = await dispatch(
        sendTemplateMessage({
          conversationId: String(conversationId),
          templateDetail: selectedTemplateDetail,
              body_parameters: ["طارق", "عنوان بريدك الإلكتروني"],

        })
      );

      if (sendTemplateMessage.fulfilled.match(result)) {
        handleClose();

        if (typeof onSuccess === "function") {
          onSuccess(result.payload);
        }
      }
    } finally {
      setTimeout(() => {
        sendLockRef.current = false;
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3">
      <div
        className={`w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 ${
          isRTL ? "text-right" : "text-left"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-white">
              {t?.("templates.title", "Templates")}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t?.(
                "templates.subtitle",
                "Choose a WhatsApp template and send it"
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t?.("close", "Close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 h-[75vh]">
          <div className="border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 opacity-60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => dispatch(setTemplateSearch(e.target.value))}
                  placeholder={t?.("templates.search", "Search templates...")}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {availableLoading ? (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : availableError ? (
                <div className="space-y-3">
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {availableError}
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-3 py-2 rounded-lg bg-[#63bbb3] text-white"
                  >
                    {t?.("retry", "Retry")}
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                  <MessageSquareText className="w-8 h-8 mb-2 opacity-60" />
                  <div className="text-sm">
                    {t?.("templates.empty", "No approved templates available")}
                  </div>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    isActive={String(selectedTemplateId) === String(item.id)}
                    onSelect={() => handleSelectTemplate(item)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedTemplateId ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                  <MessageSquareText className="w-8 h-8 mb-2 opacity-60" />
                  <div className="text-sm">
                    {t?.("templates.selectOne", "Select a template to preview")}
                  </div>
                </div>
              ) : detailLoading ? (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : detailError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {detailError}
                </div>
              ) : selectedTemplateDetail ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedTemplateDetail?.name || "Template"}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                        <Tag className="w-3 h-3" />
                        {selectedTemplateDetail?.category || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                        <Globe className="w-3 h-3" />
                        {selectedTemplateDetail?.language || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 space-y-4">
                    {header?.text && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          {t?.("templates.header", "Header")}
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {header.text}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {t?.("templates.body", "Body")}
                      </div>
                      <div className="text-sm leading-6 text-gray-900 dark:text-white whitespace-pre-wrap">
                        {body?.text || selectedTemplateDetail?.name || "—"}
                      </div>
                    </div>

                    {!!buttons.length && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t?.("templates.buttons", "Buttons")}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {buttons.map((button, idx) => (
                            <ButtonPreview key={idx} button={button} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                {t?.("cancel", "Cancel")}
              </button>

              <button
                type="button"
                onClick={handleSendTemplate}
                disabled={!selectedTemplateDetail?.id || sendLoading}
                className="px-4 py-2 rounded-xl bg-[#63bbb3] text-white disabled:opacity-60 flex items-center gap-2"
              >
                {sendLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{t?.("send", "Send")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}