// src/store/slices/customersSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";
const normalizePhone = (raw = "") => {
  // ننضف المدخلات ونسيب + والأرقام فقط
  const t = String(raw).trim();
  if (!t) return "";
  // لو المستخدم كتب مسافات/شرطات
  const cleaned = t.replace(/[^\d+]/g, "");
  // من غير فرض أي منطق دولة—نكتفي بالإرسال كما هو
  return cleaned;
};

/* ============ Thunks ============ */
// قائمة العملاء (المعتادة) مع بحث عام من /customers/
export const fetchCustomers = createAsyncThunk(
  "customers/fetchCustomers",
  async ({ page = 1, page_size = 25, search = "" } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/customers/", {
        params: { page, page_size, search: search || undefined },
      });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "فشل تحميل العملاء";
      return rejectWithValue(msg);
    }
  }
);

// بحث مباشر بالهاتف: يضرب /conversations/by-id/<phone>
// ويُرجّع { customer, conversation }
export const searchCustomerByPhone = createAsyncThunk(
  "customers/searchCustomerByPhone",
  async (phoneRaw, { rejectWithValue }) => {
    try {
      const phone = normalizePhone(phoneRaw);
      if (!phone) throw new Error("رقم الهاتف غير صالح");
      const url = `/conversations/by-id/${encodeURIComponent(phone)}`;
      const { data } = await api.get(url);
      const customer = data?.customer || null;
      return {
        query: phone,
        customer,
        conversation: data ?? null,
      };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "فشل البحث برقم الهاتف";
      return rejectWithValue(msg);
    }
  }
);

/* ============ Slice ============ */

const customersSlice = createSlice({
  name: "customers",
  initialState: {
    items: [],
    count: 0,
    page: 1,
    page_size: 25,
    loading: false,
    error: null,
    search: "",

    // بحث بالهاتف
    byPhoneLoading: false,
    byPhoneError: null,
    byPhoneResult: null, // { query, customer, conversation }
  },
  reducers: {
    setCustomersPage(state, action) {
      state.page = action.payload || 1;
    },
    setCustomersPageSize(state, action) {
      state.page_size = action.payload || 25;
    },
    setCustomersSearch(state, action) {
      state.search = action.payload || "";
      state.page = 1;
    },
    clearCustomerPhoneSearch(state) {
      state.byPhoneLoading = false;
      state.byPhoneError = null;
      state.byPhoneResult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // قائمة العملاء
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload?.results || [];
        state.count = action.payload?.count || 0;
        state.page = action.payload?.page || 1;
        state.page_size = action.payload?.page_size || state.page_size;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // بحث بالهاتف
      .addCase(searchCustomerByPhone.pending, (state) => {
        state.byPhoneLoading = true;
        state.byPhoneError = null;
        // نسيب آخر نتيجة كما هي لحد ما نجيب الجديدة
      })
      .addCase(searchCustomerByPhone.fulfilled, (state, action) => {
        state.byPhoneLoading = false;
        state.byPhoneResult = action.payload; // { query, customer, conversation }
      })
      .addCase(searchCustomerByPhone.rejected, (state, action) => {
        state.byPhoneLoading = false;
        state.byPhoneError = action.payload;
      });
  },
});

/* ============ Exports ============ */

export const {
  setCustomersPage,
  setCustomersPageSize,
  setCustomersSearch,
  clearCustomerPhoneSearch,
} = customersSlice.actions;

export const selectCustomers = (s) => s.customers.items;
export const selectCustomersLoading = (s) => s.customers.loading;
export const selectCustomersError = (s) => s.customers.error;
export const selectCustomersCount = (s) => s.customers.count;
export const selectCustomersPage = (s) => s.customers.page;
export const selectCustomersPageSize = (s) => s.customers.page_size;
export const selectCustomersSearch = (s) => s.customers.search;

// Selectors لنتيجة البحث بالهاتف
export const selectCustomerByPhoneLoading = (s) => s.customers.byPhoneLoading;
export const selectCustomerByPhoneError = (s) => s.customers.byPhoneError;
export const selectCustomerByPhoneResult = (s) => s.customers.byPhoneResult;
export const selectCustomerByPhone = (s) => s.customers.byPhoneResult?.customer || null;
export const selectConversationByPhone = (s) => s.customers.byPhoneResult?.conversation || null;
export const selectCustomerPhoneQuery = (s) => s.customers.byPhoneResult?.query || "";

export default customersSlice.reducer;
