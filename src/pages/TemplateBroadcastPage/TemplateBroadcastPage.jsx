import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  Tag,
  Globe,
  Phone,
  Users,
  Send,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquareText,
  Link as LinkIcon,
  CornerDownRight,
  Check,
} from "lucide-react";

import api from "../../api/axios";
import {
  fetchAvailableTemplates,
  fetchTemplateDetail,
  setSelectedTemplateId,
  selectAvailableTemplates,
  selectAvailableTemplatesLoading,
  selectAvailableTemplatesError,
  selectSelectedTemplateId,
  selectSelectedTemplateDetail,
  selectTemplateDetailLoading,
  selectTemplateDetailError,
} from "../../store/slices/waTemplatesSlice";

import {
  fetchCustomers,
  selectCustomers,
  selectCustomersLoading,
} from "../../store/slices/customersSlice";

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
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CornerDownRight className="w-4 h-4 opacity-70" />
        <span>{button?.text || "Quick Reply"}</span>
      </div>
    );
  }

  if (type === "URL") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <LinkIcon className="w-4 h-4 opacity-70" />
        <span>{button?.text || "Open Link"}</span>
      </div>
    );
  }

  if (type === "PHONE_NUMBER") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <Phone className="w-4 h-4 opacity-70" />
        <span>{button?.text || button?.phone_number || "Call"}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <span>{button?.text || type || "Button"}</span>
    </div>
  );
}

function TemplateCard({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition ${
        active
          ? "border-[#63bbb3] bg-[#63bbb3]/10"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/70"
      }`}
    >
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
    </button>
  );
}

const normalizePhone = (value = "") => {
  return String(value).trim().replace(/[^\d+]/g, "");
};

export default function TemplateBroadcastPage() {
  const dispatch = useDispatch();

  const availableTemplates = useSelector(selectAvailableTemplates);
  const availableLoading = useSelector(selectAvailableTemplatesLoading);
  const availableError = useSelector(selectAvailableTemplatesError);

  const selectedTemplateId = useSelector(selectSelectedTemplateId);
  const selectedTemplateDetail = useSelector(selectSelectedTemplateDetail);
  const detailLoading = useSelector(selectTemplateDetailLoading);
  const detailError = useSelector(selectTemplateDetailError);

  const customers = useSelector(selectCustomers);
  const customersLoading = useSelector(selectCustomersLoading);

  const [search, setSearch] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const [recipientMode, setRecipientMode] = useState("phone"); // phone | customer
  const [customerSearch, setCustomerSearch] = useState("");

  const [recipients, setRecipients] = useState([]);

  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState(null);

  const [jobLoading, setJobLoading] = useState(false);
  const [jobData, setJobData] = useState(null);
  const [jobError, setJobError] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
const [syncMessage, setSyncMessage] = useState("");
const [syncError, setSyncError] = useState("");
const getCustomerPhone = (customer = {}) => {
  return (
    customer?.phone ||
    customer?.phone_number ||
    customer?.mobile ||
    customer?.mobile_number ||
    customer?.whatsapp_number ||
    customer?.wa_id ||
    customer?.customer_phone ||
    customer?.customer_mobile ||
    customer?.conversation_id ||
    ""
  );
};


const handleSyncTemplates = async () => {
  try {
    setSyncLoading(true);
    setSyncError("");
    setSyncMessage("");

    const { data } = await api.post("/wa-templates/sync/", {});

    const synced = data?.data?.synced ?? 0;
    const created = data?.data?.created ?? 0;
    const updated = data?.data?.updated ?? 0;

    setSyncMessage(
      `Templates synced successfully • Synced: ${synced} • Created: ${created} • Updated: ${updated}`
    );

    await dispatch(fetchAvailableTemplates());
  } catch (err) {
    setSyncError(
      err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to sync templates"
    );
  } finally {
    setSyncLoading(false);
  }
};
const getCustomerName = (customer = {}) => {
  return (
    customer?.name ||
    customer?.full_name ||
    customer?.customer_name ||
    `Customer #${customer?.id ?? ""}`
  );
};
  useEffect(() => {
    dispatch(fetchAvailableTemplates());
    dispatch(fetchCustomers({ page: 1, page_size: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (!sendResult?.job_id) return;

    let timer = null;
    let stopped = false;

    const loadJob = async () => {
      try {
        setJobLoading(true);
        setJobError("");

        const { data } = await api.get(
          `/wa-templates/jobs/${sendResult.job_id}/`
        );
        const payload = data?.data || null;

        if (!stopped) {
          setJobData(payload);
        }

        const status = String(payload?.status || "").toLowerCase();
        const done =
          status === "completed" ||
          status === "partially_completed" ||
          status === "failed";

        if (!done && !stopped) {
          timer = setTimeout(loadJob, 4000);
        }
      } catch (err) {
        if (!stopped) {
          setJobError(
            err?.response?.data?.message ||
              err?.response?.data?.detail ||
              err?.message ||
              "Failed to fetch job status"
          );
        }
      } finally {
        if (!stopped) {
          setJobLoading(false);
        }
      }
    };

    loadJob();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [sendResult]);

  const filteredTemplates = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return availableTemplates || [];

    return (availableTemplates || []).filter((item) => {
      const name = String(item?.name || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      const language = String(item?.language || "").toLowerCase();

      return (
        name.includes(q) ||
        category.includes(q) ||
        language.includes(q)
      );
    });
  }, [availableTemplates, search]);

  const filteredCustomers = useMemo(() => {
    const q = String(customerSearch || "").trim().toLowerCase();
    if (!q) return customers || [];

    return (customers || []).filter((c) => {
      const name = String(getCustomerName(c)).toLowerCase();
const phone = String(getCustomerPhone(c)).toLowerCase();

      return name.includes(q) || phone.includes(q);
    });
  }, [customers, customerSearch]);

  const components = selectedTemplateDetail?.components_json || [];
  const header = getHeaderComponent(components);
  const body = getBodyComponent(components);
  const buttonsBlock = getButtonsComponent(components);
  const buttons = buttonsBlock?.buttons || [];

  const handleSelectTemplate = (template) => {
    if (!template?.id) return;
    dispatch(setSelectedTemplateId(template.id));
    dispatch(fetchTemplateDetail(template.id));
  };

  const addPhoneRecipient = () => {
    const value = normalizePhone(phoneInput);
    if (!value) return;

    const exists = recipients.some(
      (r) => normalizePhone(r?.phone_number || "") === value
    );
    if (exists) {
      setPhoneInput("");
      return;
    }

    setRecipients((prev) => [
      ...prev,
      {
        type: "phone",
        phone_number: value,
        label: value,
      },
    ]);
    setPhoneInput("");
  };

  const toggleCustomerRecipient = (customer) => {
    if (!customer?.id) return;

    const customerId = Number(customer.id);
  const phone = getCustomerPhone(customer);
const label = normalizePhone(phone) || getCustomerName(customer);

    const exists = recipients.some(
      (r) => Number(r?.customer_id) === customerId
    );

    if (exists) {
      setRecipients((prev) =>
        prev.filter((r) => Number(r?.customer_id) !== customerId)
      );
      return;
    }

    setRecipients((prev) => [
      ...prev,
      {
        type: "customer",
        customer_id: customerId,
        phone_number: normalizePhone(phone),
        label,
      },
    ]);
  };

  const removeRecipient = (idx) => {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!selectedTemplateDetail?.id || recipients.length === 0 || sendLoading) {
      return;
    }

    try {
      setSendLoading(true);
      setSendError("");
      setSendResult(null);
      setJobData(null);
      setJobError("");

      const payload = {
        template_id: selectedTemplateDetail.id,
        recipients: recipients.map((r) => {
          if (r?.customer_id) {
            return { customer_id: r.customer_id };
          }
          return { phone_number: r.phone_number };
        }),
      };

      const { data } = await api.post("/wa-templates/send/list/", payload);

      setSendResult(data?.data || null);
    } catch (err) {
      setSendError(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to send template"
      );
    } finally {
      setSendLoading(false);
    }
  };

  const totalRecipients =
    sendResult?.total_recipients ?? recipients.length ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 md:p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Send WhatsApp Templates</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Send one template to one recipient or multiple recipients from
                one page.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#63bbb3]/10 text-[#2c8f88] dark:text-[#8be0d9] border border-[#63bbb3]/20">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                {recipients.length} recipient
                {recipients.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)_380px] gap-6">
          {/* Templates list */}
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
           <div className="p-4 border-b border-gray-200 dark:border-gray-800">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-lg font-semibold">Templates</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Choose a template first
      </div>
    </div>

    <button
      type="button"
      onClick={handleSyncTemplates}
      disabled={syncLoading}
      className="px-3 py-2 rounded-xl border border-[#63bbb3]/30 bg-[#63bbb3]/10 text-[#63bbb3] hover:bg-[#63bbb3]/20 disabled:opacity-60 text-sm flex items-center gap-2"
    >
      {syncLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span>↻</span>
      )}
      <span>Sync</span>
    </button>
  </div>

  {(syncMessage || syncError) && (
    <div
      className={`mt-3 text-xs rounded-xl px-3 py-2 border ${
        syncError
          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
      }`}
    >
      {syncError || syncMessage}
    </div>
  )}

  <div className="relative mt-4">
    <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 opacity-60" />
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search templates..."
      className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
    />
  </div>
</div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {availableLoading ? (
                <div className="py-10 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : availableError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {availableError}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  No templates found
                </div>
              ) : (
                filteredTemplates.map((item) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    active={String(selectedTemplateId) === String(item.id)}
                    onClick={() => handleSelectTemplate(item)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="text-lg font-semibold">Preview</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Review the selected template before sending
              </div>
            </div>

            <div className="p-5 min-h-[500px]">
              {!selectedTemplateId ? (
                <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                  <MessageSquareText className="w-10 h-10 mb-3 opacity-60" />
                  <div>Select a template to preview</div>
                </div>
              ) : detailLoading ? (
                <div className="h-full min-h-[420px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : detailError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {detailError}
                </div>
              ) : selectedTemplateDetail ? (
                <div className="space-y-5">
                  <div>
                    <div className="text-xl font-semibold">
                      {selectedTemplateDetail?.name || "Template"}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
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

                  <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-[#63bbb3]/10 p-5 space-y-4">
                    {header?.text && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Header
                        </div>
                        <div className="font-semibold">{header.text}</div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Body
                      </div>
                      <div className="whitespace-pre-wrap leading-7">
                        {body?.text || selectedTemplateDetail?.name || "—"}
                      </div>
                    </div>

                    {!!buttons.length && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Buttons
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
          </div>

          {/* Recipients + send */}
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="text-lg font-semibold">Recipients</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add phone numbers manually or choose from customers
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Switch */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientMode("phone")}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                    recipientMode === "phone"
                      ? "bg-[#63bbb3] text-white border-[#63bbb3]"
                      : "bg-gray-50 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                  }`}
                >
                  Phone Numbers
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientMode("customer")}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                    recipientMode === "customer"
                      ? "bg-[#63bbb3] text-white border-[#63bbb3]"
                      : "bg-gray-50 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                  }`}
                >
                  Customers
                </button>
              </div>

              {/* Phone mode */}
              {recipientMode === "phone" && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 opacity-60" />
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPhoneRecipient();
                        }
                      }}
                      placeholder="+201149943382"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addPhoneRecipient}
                    className="px-4 py-2.5 rounded-xl bg-[#63bbb3] text-white hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Customer mode */}
              {recipientMode === "customer" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 opacity-60" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by customer name or phone..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="max-h-[220px] overflow-y-auto">
                      {customersLoading ? (
                        <div className="px-4 py-8 flex items-center justify-center text-gray-500 dark:text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400">
                          No customers found
                        </div>
                      ) : (
                        filteredCustomers.map((customer) => {
                          const customerId = Number(customer?.id);
                        const phone = getCustomerPhone(customer);
const name = getCustomerName(customer);

                          const selected = recipients.some(
                            (r) => Number(r?.customer_id) === customerId
                          );

                          return (
                            <button
                              key={customerId}
                              type="button"
                              onClick={() => toggleCustomerRecipient(customer)}
                              className={`w-full px-4 py-3 border-b last:border-b-0 border-gray-200 dark:border-gray-800 text-left flex items-center justify-between gap-3 transition ${
                                selected
                                  ? "bg-[#63bbb3]/10"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800/70"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {phone || "No phone"}
                                </div>
                              </div>

                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  selected
                                    ? "bg-[#63bbb3] border-[#63bbb3] text-white"
                                    : "border-gray-300 dark:border-gray-600"
                                }`}
                              >
                                {selected && <Check className="w-3 h-3" />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Added recipients */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 text-sm font-medium">
                  Added recipients
                </div>

                <div className="max-h-[260px] overflow-y-auto">
                  {recipients.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400">
                      No recipients added yet
                    </div>
                  ) : (
                    recipients.map((recipient, idx) => (
                      <div
                        key={`${recipient.phone_number || recipient.customer_id}-${idx}`}
                        className="px-4 py-3 border-b last:border-b-0 border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 text-sm">
                          <span className="truncate block">
                            {recipient?.label ||
                              recipient?.phone_number ||
                              `Customer #${recipient?.customer_id}`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRecipient(idx)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Send panel */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Total recipients
                  </span>
                  <span className="font-semibold">{totalRecipients}</span>
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    !selectedTemplateDetail?.id ||
                    recipients.length === 0 ||
                    sendLoading
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-[#63bbb3] text-white disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {sendLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Send Template</span>
                </button>

                {sendError && (
                  <div className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <span>{sendError}</span>
                  </div>
                )}

                {sendResult && (
                  <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Template queued successfully</span>
                    </div>

                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <div>Job ID: {sendResult?.job_id || "—"}</div>
                      <div>Status: {sendResult?.status || "—"}</div>
                      <div>
                        Total recipients: {sendResult?.total_recipients ?? "—"}
                      </div>
                    </div>
                  </div>
                )}

                {(jobLoading || jobData || jobError) && (
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
                    <div className="font-medium text-sm">Job status</div>

                    {jobLoading && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking status...</span>
                      </div>
                    )}

                    {jobError && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        {jobError}
                      </div>
                    )}

                    {jobData && (
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <div>Status: {jobData?.status || "—"}</div>
                        <div>
                          Total recipients: {jobData?.total_recipients ?? "—"}
                        </div>
                        <div>Sent count: {jobData?.sent_count ?? "—"}</div>
                        <div>
                          Delivered count: {jobData?.delivered_count ?? "—"}
                        </div>
                        <div>Read count: {jobData?.read_count ?? "—"}</div>
                        <div>Failed count: {jobData?.failed_count ?? "—"}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}