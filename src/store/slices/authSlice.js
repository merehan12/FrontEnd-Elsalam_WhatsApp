// src/store/slices/authSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/axios";

/* ================= Storage (موحّد) ================= */
const storage = {
  get(key) {
    const s = sessionStorage.getItem(key);
    if (s != null) return s;
    return localStorage.getItem(key);
  },
  // اكتب في نفس المكان الموجود أصلاً
  setInPlace(key, val) {
    if (sessionStorage.getItem(key) != null) sessionStorage.setItem(key, val);
    else localStorage.setItem(key, val);
  },
  // امسح من الاثنين
  clearAll() {
    ["access", "refresh"].forEach((k) => {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    });
  },
  // اكتب في مخزن واحد فقط (remember? local : session)
  setExclusive(key, val, remember) {
    this.clearKey(key);
    (remember ? localStorage : sessionStorage).setItem(key, val);
  },
  clearKey(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  },
};

/* ================= JWT helpers ================= */
const parseJwt = (token) => {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
};
const isTokenValid = (token) => {
  const p = parseJwt(token);
  if (!p?.exp) return false;
  const now = Date.now() / 1000;
  return now < p.exp - 30;
};

/* تنظيف أولي للتوكنات القديمة في المخزونين */
(function purgeStaleTokens() {
  const accessS = sessionStorage.getItem("access");
  const refreshS = sessionStorage.getItem("refresh");
  const accessL = localStorage.getItem("access");
  const refreshL = localStorage.getItem("refresh");

  if (accessS && !isTokenValid(accessS)) sessionStorage.removeItem("access");
  if (accessL && !isTokenValid(accessL)) localStorage.removeItem("access");

  if (!refreshS || refreshS === "null" || refreshS === "undefined")
    sessionStorage.removeItem("refresh");
  if (!refreshL || refreshL === "null" || refreshL === "undefined")
    localStorage.removeItem("refresh");
})();

/* القيم الابتدائية */
const getInitialAccess = () => {
  const t = storage.get("access");
  return t && isTokenValid(t) ? t : null;
};
const getInitialRefresh = () => storage.get("refresh") || null;

/* ================= Thunks ================= */

// Login: نمسح أي توكنات قديمة ثم نكتب الجديدة في مخزن واحد
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (
    { email, password, remember = false },
    { dispatch, rejectWithValue }
  ) => {
    try {
      // مهم: امسح أي بواقي قبل اللوجين
      storage.clearAll();

      const payload = { username: email, password };
      const { data } = await api.post("/auth/login/", payload);
      const { access, refresh } = data || {};

      if (access) storage.setExclusive("access", access, remember);
      if (refresh) storage.setExclusive("refresh", refresh, remember);
 
      // بعدها نجيب بيانات المستخدم
      let user = null;
      try {
        user = await dispatch(fetchMe()).unwrap();
      } catch {
        user = null;
      }
      return { access: access || null, refresh: refresh || null, user };
    } catch (err) {
      storage.clearAll();
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "فشل تسجيل الدخول. تأكد من البيانات.";
      return rejectWithValue(msg);
    }
  }
);

// Me
export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/me/");
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "تعذر جلب بيانات المستخدم.";
      return rejectWithValue(msg);
    }
  }
);

// Refresh يدوي (يُستخدم فقط بواسطة الـ interceptor أو عند الحاجة)
export const refreshTokensThunk = createAsyncThunk(
  "auth/refreshTokens",
  async (_, { dispatch, rejectWithValue, getState }) => {
    try {
      const refresh = storage.get("refresh");
      if (!refresh) throw new Error("لا يوجد refresh token");
      const { data } = await api.post("/auth/refresh/", { refresh });
      const { access: newAccess, refresh: newRefresh } = data || {};
      if (newAccess) storage.setInPlace("access", newAccess);
      if (newRefresh) storage.setInPlace("refresh", newRefresh);

      dispatch(
        setTokens({ access: newAccess, refresh: newRefresh || refresh || null })
      );
      return {
        access: newAccess || null,
        refresh: newRefresh || refresh || null,
      };
    } catch (err) {
      // لو الجلسة منتهية فعلاً: نظف واطلع
      storage.clearAll();
      dispatch(logout());
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "تعذر تحديث الجلسة.";
      return rejectWithValue(msg);
    }
  }
);

// Logout
export const serverLogout = createAsyncThunk(
  "auth/serverLogout",
  async (_arg, { dispatch, rejectWithValue }) => {
    const refresh = storage.get("refresh");
    try {
      await api.post("/auth/logout/", { refresh });
      return true;
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "حدث خطأ أثناء تسجيل الخروج من السيرفر.";
      return rejectWithValue(msg);
    } finally {
      storage.clearAll();
      dispatch(logout());
    }
  }
);

/* ================= Slice ================= */
// const initialState = {
//   user: null,
//   access: getInitialAccess(),
//   refresh: getInitialRefresh(),

//   // نعتبر إن فيه جلسة “محتملة” لو فيه access أو refresh
//   isAuthenticated: !!getInitialAccess() || !!getInitialRefresh(),

//   loading: false,
//   loginError: null,
//   sessionError: null,
//   logoutError: null,
// };

const initialState = {
  user: null,
  access: getInitialAccess(),
  refresh: getInitialRefresh(),
  // ✅ الجديد: اعتبره داخل بس لو عنده access صالح
  isAuthenticated: !!getInitialAccess(),

  loading: false,
  loginError: null,
  sessionError: null,
  logoutError: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setTokens(state, action) {
      const { access, refresh } = action.payload || {};
      state.access = access || null;
      state.refresh = refresh || null;
      state.isAuthenticated = !!access;
    },
    setUser(state, action) {
      state.user = action.payload || null;
    },
    clearErrors(state) {
      state.loginError = null;
      state.sessionError = null;
    },
    logout(state) {
      state.user = null;
      state.access = null;
      state.refresh = null;
      state.isAuthenticated = false;
      state.loginError = null;
      state.sessionError = null;
      sessionStorage.removeItem("access");
      sessionStorage.removeItem("refresh");
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.loginError = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = !!action.payload.access;
        state.access = action.payload.access;
        state.refresh = action.payload.refresh || null;
        state.user = action.payload.user || null;
        state.loginError = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.access = null;
        state.refresh = null;
        state.user = null;
        state.loginError = action.payload || "Login failed.";
      })

      // Me
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload || null;
      })

      // Refresh
      .addCase(refreshTokensThunk.fulfilled, (state, action) => {
        state.access = action.payload.access || null;
        state.refresh = action.payload.refresh || null;
        state.isAuthenticated = !!action.payload.access; // ✅ خليه كده
        state.sessionError = null;
      })
      .addCase(refreshTokensThunk.rejected, (state, action) => {
        // لا تزعّلي شاشة اللوجين برسالة ريفرش
        if (state.isAuthenticated) state.sessionError = action.payload || null;
      })

      // Logout
      .addCase(serverLogout.pending, (state) => {
        state.loading = true;
        state.logoutError = null;
      })
      .addCase(serverLogout.fulfilled, (state) => {
        state.loading = false;
        state.logoutError = null;
      })
      .addCase(serverLogout.rejected, (state, action) => {
        state.loading = false;
        state.logoutError = action.payload || null;
      });
  },
});

export const { logout, setUser, setTokens, clearErrors } = authSlice.actions;

/* ================= Selectors ================= */
export const selectAccessToken = (s) => s.auth.access;
export const selectRefreshToken = (s) => s.auth.refresh;
export const selectCurrentUser = (s) => s.auth.user;
export const selectIsAuthenticated = (s) => s.auth.isAuthenticated;
export const selectLoginError = (s) => s.auth.loginError;
export const selectSessionError = (s) => s.auth.sessionError;
export const selectCurrentUserId = (s) => s.auth?.user?.id ?? null;

export default authSlice.reducer;
