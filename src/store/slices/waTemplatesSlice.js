// src/store/slices/waTemplatesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";

/* ================= API helpers (inside same slice file) ================= */

const getAvailableTemplatesApi = async () => {
  const { data } = await api.get("/wa-templates/templates/available/");
  return data;
};

const getTemplateDetailApi = async (templateId) => {
  const { data } = await api.get(`/wa-templates/templates/${templateId}/`);
  return data;
};

export const sendTemplateFromConversationApi = async ({
  conversation_id,
  template_id,
  body_parameters = [],
}) => {
  const { data } = await api.post("/wa-templates/send/conversation/", {
    conversation_id,
    template_id,
    body_parameters,  
  });
  return data;
};

const getTemplateJobStatusApi = async (jobId) => {
  const { data } = await api.get(`/wa-templates/jobs/${jobId}/`);
  return data;
};

const listAllTemplatesApi = async (params = {}) => {
  const { data } = await api.get("/wa-templates/templates/", { params });
  return data;
};

const syncTemplatesApi = async () => {
  const { data } = await api.post("/wa-templates/sync/", {});
  return data;
};

/* ================= Helpers ================= */

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message ||
  err?.response?.data?.detail ||
  err?.message ||
  fallback;

const normalizeButtonSummary = (buttons) => {
  if (!Array.isArray(buttons)) return [];
  return buttons.map((btn) => ({
    type: btn?.type || "",
    text: btn?.text || "",
    url: btn?.url ?? null,
    phone_number: btn?.phone_number ?? null,
  }));
};

const normalizeTemplateListItem = (item = {}) => ({
  id: item?.id ?? null,
  meta_template_id: item?.meta_template_id ?? "",
  name: item?.name ?? "",
  category: item?.category ?? "",
  language: item?.language ?? "",
  status: item?.status ?? "",
  quality_rating: item?.quality_rating ?? "",
  is_active: Boolean(item?.is_active),
  synced_at: item?.synced_at ?? null,
  button_summary: normalizeButtonSummary(item?.button_summary),
});

const normalizeTemplateDetail = (item = {}) => ({
  id: item?.id ?? null,
  meta_template_id: item?.meta_template_id ?? "",
  waba_id: item?.waba_id ?? "",
  name: item?.name ?? "",
  category: item?.category ?? "",
  language: item?.language ?? "",
  status: item?.status ?? "",
  quality_rating: item?.quality_rating ?? "",
  is_active: Boolean(item?.is_active),
  components_json: Array.isArray(item?.components_json)
    ? item.components_json
    : [],
  raw_json: item?.raw_json ?? null,
  synced_at: item?.synced_at ?? null,
  created_at: item?.created_at ?? null,
  updated_at: item?.updated_at ?? null,
});

/* ================= Thunks ================= */

// للـ picker داخل الشات
export const fetchAvailableTemplates = createAsyncThunk(
  "waTemplates/fetchAvailableTemplates",
  async (_, { rejectWithValue }) => {
    try {
      const res = await getAvailableTemplatesApi();
      const data = res?.data || {};
      const results = Array.isArray(data?.results) ? data.results : [];

      return {
        count: data?.count ?? results.length,
        results: results.map(normalizeTemplateListItem),
      };
    } catch (err) {
      return rejectWithValue(
        getErrorMessage(err, "فشل تحميل الـ templates المتاحة")
      );
    }
  }
);

// تفاصيل template للـ preview
export const fetchTemplateDetail = createAsyncThunk(
  "waTemplates/fetchTemplateDetail",
  async (templateId, { rejectWithValue }) => {
    try {
      const res = await getTemplateDetailApi(templateId);
      const data = res?.data || {};
      return normalizeTemplateDetail(data);
    } catch (err) {
      return rejectWithValue(
        getErrorMessage(err, "فشل تحميل تفاصيل الـ template")
      );
    }
  }
);

// إرسال template من المحادثة الحالية
export const sendTemplateToConversation = createAsyncThunk(
  "waTemplates/sendTemplateToConversation",
  async ({ conversation_id, template_id }, { rejectWithValue }) => {
    try {
      const res = await sendTemplateFromConversationApi({
        conversation_id,
        template_id,
      });

      const data = res?.data || {};

      return {
        conversation_id: String(conversation_id),
        template_id,
        job_id: data?.job_id ?? null,
        message_id: data?.message_id ?? null,
        status: data?.status ?? "queued",
        meta_limit_note: data?.meta_limit_note ?? null,
      };
    } catch (err) {
      return rejectWithValue({
        conversation_id: String(conversation_id),
        error: getErrorMessage(err, "فشل إرسال الـ template"),
        code: err?.response?.data?.error?.code || null,
      });
    }
  }
);

// متابعة job status
export const fetchTemplateJobStatus = createAsyncThunk(
  "waTemplates/fetchTemplateJobStatus",
  async (jobId, { rejectWithValue }) => {
    try {
      const res = await getTemplateJobStatusApi(jobId);
      const data = res?.data || {};

      return {
        id: data?.id ?? jobId,
        template_name: data?.template_name ?? "",
        template_language: data?.template_language ?? "",
        target_mode: data?.target_mode ?? "",
        status: data?.status ?? "",
        total_recipients: data?.total_recipients ?? 0,
        sent_count: data?.sent_count ?? 0,
        delivered_count: data?.delivered_count ?? 0,
        read_count: data?.read_count ?? 0,
        failed_count: data?.failed_count ?? 0,
        requested_by_username: data?.requested_by_username ?? "",
        created_at: data?.created_at ?? null,
        updated_at: data?.updated_at ?? null,
        recipients: Array.isArray(data?.recipients) ? data.recipients : [],
      };
    } catch (err) {
      return rejectWithValue(
        getErrorMessage(err, "فشل تحميل حالة الـ template job")
      );
    }
  }
);

// شاشة admin لكل الـ templates
export const fetchAllTemplates = createAsyncThunk(
  "waTemplates/fetchAllTemplates",
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await listAllTemplatesApi(params);
      const data = res?.data || {};
      const results = Array.isArray(data?.results) ? data.results : [];

      return {
        count: data?.count ?? results.length,
        page: data?.page ?? 1,
        page_size: data?.page_size ?? 25,
        total_pages: data?.total_pages ?? 1,
        has_next: Boolean(data?.has_next),
        has_previous: Boolean(data?.has_previous),
        results: results.map(normalizeTemplateListItem),
      };
    } catch (err) {
      return rejectWithValue(
        getErrorMessage(err, "فشل تحميل كل الـ templates")
      );
    }
  }
);

// sync templates من Meta
export const syncTemplates = createAsyncThunk(
  "waTemplates/syncTemplates",
  async (_, { rejectWithValue }) => {
    try {
      const res = await syncTemplatesApi();
      const data = res?.data || {};

      return {
        synced: data?.synced ?? 0,
        created: data?.created ?? 0,
        updated: data?.updated ?? 0,
      };
    } catch (err) {
      return rejectWithValue(
        getErrorMessage(err, "فشل عمل Sync للـ templates")
      );
    }
  }
);

/* ================= Initial State ================= */

const initialState = {
  // picker داخل الشات
  availableItems: [],
  availableCount: 0,
  availableLoading: false,
  availableError: null,

  // selected template
  selectedTemplateId: null,
  selectedTemplateDetail: null,
  detailLoading: false,
  detailError: null,

  // UI state
  pickerOpen: false,
  search: "",

  // sending by conversation
  sendLoadingByConversation: {},
  sendErrorByConversation: {},
  activeJobIdByConversation: {},

  // jobs cache
  jobsById: {},
  jobsLoadingById: {},
  jobsErrorById: {},

  // admin list
  allItems: [],
  allCount: 0,
  allPage: 1,
  allPageSize: 25,
  allTotalPages: 1,
  allHasNext: false,
  allHasPrevious: false,
  allLoading: false,
  allError: null,

  // sync
  syncLoading: false,
  syncError: null,
  syncResult: null,
};

/* ================= Slice ================= */

const waTemplatesSlice = createSlice({
  name: "waTemplates",
  initialState,
  reducers: {
    openTemplatePicker(state) {
      state.pickerOpen = true;
    },
    closeTemplatePicker(state) {
      state.pickerOpen = false;
    },

    setTemplateSearch(state, action) {
      state.search = action.payload || "";
    },

    clearTemplateSelection(state) {
      state.selectedTemplateId = null;
      state.selectedTemplateDetail = null;
      state.detailLoading = false;
      state.detailError = null;
    },

    setSelectedTemplateId(state, action) {
      state.selectedTemplateId =
        action.payload != null ? Number(action.payload) : null;
    },

    clearTemplateSendError(state, action) {
      const convId = String(action.payload || "");
      if (!convId) return;
      delete state.sendErrorByConversation[convId];
    },

    clearTemplateJob(state, action) {
      const jobId = String(action.payload || "");
      if (!jobId) return;
      delete state.jobsById[jobId];
      delete state.jobsLoadingById[jobId];
      delete state.jobsErrorById[jobId];
    },

    clearTemplateSyncResult(state) {
      state.syncResult = null;
      state.syncError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      /* fetchAvailableTemplates */
      .addCase(fetchAvailableTemplates.pending, (state) => {
        state.availableLoading = true;
        state.availableError = null;
      })
      .addCase(fetchAvailableTemplates.fulfilled, (state, action) => {
        state.availableLoading = false;
        state.availableItems = action.payload?.results || [];
        state.availableCount = action.payload?.count || 0;
      })
      .addCase(fetchAvailableTemplates.rejected, (state, action) => {
        state.availableLoading = false;
        state.availableError =
          action.payload || "فشل تحميل الـ templates المتاحة";
      })

      /* fetchTemplateDetail */
      .addCase(fetchTemplateDetail.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchTemplateDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selectedTemplateDetail = action.payload || null;
        state.selectedTemplateId = action.payload?.id ?? null;
      })
      .addCase(fetchTemplateDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError =
          action.payload || "فشل تحميل تفاصيل الـ template";
      })

      /* sendTemplateToConversation */
      .addCase(sendTemplateToConversation.pending, (state, action) => {
        const convId = String(action.meta?.arg?.conversation_id || "");
        if (!convId) return;
        state.sendLoadingByConversation[convId] = true;
        state.sendErrorByConversation[convId] = null;
      })
      .addCase(sendTemplateToConversation.fulfilled, (state, action) => {
        const convId = String(action.payload?.conversation_id || "");
        if (!convId) return;

        state.sendLoadingByConversation[convId] = false;

        if (action.payload?.job_id) {
          state.activeJobIdByConversation[convId] = action.payload.job_id;
        }
      })
      .addCase(sendTemplateToConversation.rejected, (state, action) => {
        const convId = String(
          action.payload?.conversation_id ||
            action.meta?.arg?.conversation_id ||
            ""
        );
        if (!convId) return;

        state.sendLoadingByConversation[convId] = false;
        state.sendErrorByConversation[convId] =
          action.payload?.error || "فشل إرسال الـ template";
      })

      /* fetchTemplateJobStatus */
      .addCase(fetchTemplateJobStatus.pending, (state, action) => {
        const jobId = String(action.meta?.arg || "");
        if (!jobId) return;
        state.jobsLoadingById[jobId] = true;
        state.jobsErrorById[jobId] = null;
      })
      .addCase(fetchTemplateJobStatus.fulfilled, (state, action) => {
        const jobId = String(action.payload?.id || "");
        if (!jobId) return;

        state.jobsLoadingById[jobId] = false;
        state.jobsById[jobId] = action.payload;
      })
      .addCase(fetchTemplateJobStatus.rejected, (state, action) => {
        const jobId = String(action.meta?.arg || "");
        if (!jobId) return;

        state.jobsLoadingById[jobId] = false;
        state.jobsErrorById[jobId] =
          action.payload || "فشل تحميل حالة الـ job";
      })

      /* fetchAllTemplates */
      .addCase(fetchAllTemplates.pending, (state) => {
        state.allLoading = true;
        state.allError = null;
      })
      .addCase(fetchAllTemplates.fulfilled, (state, action) => {
        state.allLoading = false;
        state.allItems = action.payload?.results || [];
        state.allCount = action.payload?.count || 0;
        state.allPage = action.payload?.page || 1;
        state.allPageSize = action.payload?.page_size || 25;
        state.allTotalPages = action.payload?.total_pages || 1;
        state.allHasNext = !!action.payload?.has_next;
        state.allHasPrevious = !!action.payload?.has_previous;
      })
      .addCase(fetchAllTemplates.rejected, (state, action) => {
        state.allLoading = false;
        state.allError = action.payload || "فشل تحميل كل الـ templates";
      })

      /* syncTemplates */
      .addCase(syncTemplates.pending, (state) => {
        state.syncLoading = true;
        state.syncError = null;
      })
      .addCase(syncTemplates.fulfilled, (state, action) => {
        state.syncLoading = false;
        state.syncResult = action.payload || null;
      })
      .addCase(syncTemplates.rejected, (state, action) => {
        state.syncLoading = false;
        state.syncError = action.payload || "فشل عمل Sync";
      });
  },
});

export const {
  openTemplatePicker,
  closeTemplatePicker,
  setTemplateSearch,
  clearTemplateSelection,
  setSelectedTemplateId,
  clearTemplateSendError,
  clearTemplateJob,
  clearTemplateSyncResult,
} = waTemplatesSlice.actions;

export default waTemplatesSlice.reducer;

/* ================= Selectors ================= */

export const selectTemplatePickerOpen = (s) => s.waTemplates?.pickerOpen ?? false;
export const selectTemplateSearch = (s) => s.waTemplates?.search ?? "";

export const selectAvailableTemplates = (s) =>
  s.waTemplates?.availableItems || [];
export const selectAvailableTemplatesCount = (s) =>
  s.waTemplates?.availableCount || 0;
export const selectAvailableTemplatesLoading = (s) =>
  !!s.waTemplates?.availableLoading;
export const selectAvailableTemplatesError = (s) =>
  s.waTemplates?.availableError || null;

export const selectSelectedTemplateId = (s) =>
  s.waTemplates?.selectedTemplateId ?? null;
export const selectSelectedTemplateDetail = (s) =>
  s.waTemplates?.selectedTemplateDetail || null;
export const selectTemplateDetailLoading = (s) =>
  !!s.waTemplates?.detailLoading;
export const selectTemplateDetailError = (s) =>
  s.waTemplates?.detailError || null;

export const selectTemplateSendLoadingByConversation = (s, conversationId) =>
  !!s.waTemplates?.sendLoadingByConversation?.[String(conversationId)];

export const selectTemplateSendErrorByConversation = (s, conversationId) =>
  s.waTemplates?.sendErrorByConversation?.[String(conversationId)] || null;

export const selectTemplateActiveJobIdByConversation = (s, conversationId) =>
  s.waTemplates?.activeJobIdByConversation?.[String(conversationId)] || null;

export const selectTemplateJobById = (s, jobId) =>
  s.waTemplates?.jobsById?.[String(jobId)] || null;

export const selectTemplateJobLoadingById = (s, jobId) =>
  !!s.waTemplates?.jobsLoadingById?.[String(jobId)];

export const selectTemplateJobErrorById = (s, jobId) =>
  s.waTemplates?.jobsErrorById?.[String(jobId)] || null;

export const selectAllTemplates = (s) => s.waTemplates?.allItems || [];
export const selectAllTemplatesCount = (s) =>
  s.waTemplates?.allCount || 0;
export const selectAllTemplatesLoading = (s) =>
  !!s.waTemplates?.allLoading;
export const selectAllTemplatesError = (s) =>
  s.waTemplates?.allError || null;

export const selectTemplateSyncLoading = (s) =>
  !!s.waTemplates?.syncLoading;
export const selectTemplateSyncError = (s) =>
  s.waTemplates?.syncError || null;
export const selectTemplateSyncResult = (s) =>
  s.waTemplates?.syncResult || null;