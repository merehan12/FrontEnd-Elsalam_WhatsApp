
// src/api/axios.js
import axios from "axios";

/* ================= Base ================= */
export const API_BASE =
  (process.env.REACT_APP_API_URL &&
    process.env.REACT_APP_API_URL.replace(/\/+$/, "")) ||
 "https://wh-alyaa-backend-23edk.ondigitalocean.app/api"; // <= backend /api

// أصل الدومين بدون /api (مثلاً https://chat-backend-.../ )
export const API_ORIGIN = API_BASE.replace(/\/+api\/?$/, "/");

// WebSocket base: من env أو تحويل https→wss على نفس الـorigin
export const WS_BASE =
  (process.env.REACT_APP_WS_BASE &&
    process.env.REACT_APP_WS_BASE.replace(/\/+$/, "")) ||
  API_ORIGIN.replace(/^http/i, "ws");

/* ================= Safe storage (browser only) ================= */
const CAN_STORAGE = typeof window !== "undefined";
const _session = CAN_STORAGE ? window.sessionStorage : null;
const _local = CAN_STORAGE ? window.localStorage : null;

const storage = {
  get(key) {
    try {
      if (_session && _session.getItem(key) != null)
        return _session.getItem(key);
      if (_local) return _local.getItem(key);
    } catch {}
    return null;
  },
  // اكتب في نفس المكان الموجود أصلاً (session أو local حسب ما هو متخزن)
  setInPlace(key, val) {
    try {
      if (_session && _session.getItem(key) != null) _session.setItem(key, val);
      else if (_local) _local.setItem(key, val);
    } catch {}
  },
  clearAll() {
    try {
      ["access", "refresh"].forEach((k) => {
        _session?.removeItem(k);
        _local?.removeItem(k);
      });
    } catch {}
  },
};

/* ================= Axios instances ================= */
export const api = axios.create({
  baseURL: API_BASE, // جميع REST تروح على /api
  headers: { "Content-Type": "application/json" },
});

// instance خام بدون interceptors (نستخدمه في /auth/refresh/)
const raw = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

/* ================= Build absolute URLs on backend ================= */
/**
 * يحوّل أي path لعنوان كامل على نفس الباك إند.
 * أمثلة:
 *  - "/api/messaging/media/339/"         → https://.../api/messaging/media/339/
 *  - "/messaging/media/339/"             → https://.../api/messaging/media/339/
 *  - "messaging/media/339/"              → https://.../api/messaging/media/339/
 *  - "https://other/..."                 → يتركه كما هو
 */
export function toApiUrl(u) {
  if (!u) return null;
  const s = String(u);

  // لو أصلاً absolute URL
  if (/^https?:\/\//i.test(s)) return s;

  // يبدأ بـ /api → استخدم نفس الـorigin
  if (s.startsWith("/api/")) return new URL(s, API_ORIGIN).toString();

  // يبدأ بـ / (من غير api) → نزود /api
  if (s.startsWith("/")) return new URL("/api" + s, API_ORIGIN).toString();

  // relative بدون slash → تحت base /api
  return new URL(s, API_BASE + "/").toString();
}

/* =============== Attach Authorization =============== */
api.interceptors.request.use((config) => {
  const token = storage.get("access");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* =============== Refresh Queue =============== */
let isRefreshing = false;
let pendingRequests = []; // [{resolve, reject}]

const processQueue = (error, newToken) => {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken);
  });
  pendingRequests = [];
};

const performRefresh = async () => {
  const refresh = storage.get("refresh");
  if (!refresh) throw new Error("No refresh token");

  const { data } = await raw.post("/auth/refresh/", { refresh });
  const { access: newAccess, refresh: newRefresh } = data || {};

  if (!newAccess) throw new Error("No new access token from refresh");

  storage.setInPlace("access", newAccess);
  if (newRefresh) storage.setInPlace("refresh", newRefresh);

  return { newAccess, newRefresh };
};

const isAuthPath = (url = "") => {
  const u = (url || "").toLowerCase();
  return (
    u.includes("/auth/login") ||
    u.includes("/auth/refresh") ||
    u.includes("/auth/logout")
  );
};

const shouldAttemptRefresh = (error, original) => {
  const status = error?.response?.status;
  if (!status) return false;
  if (isAuthPath(original?.url || "")) return false;

  if (status === 401) return true;

  if (status === 403) {
    const code = String(
      error?.response?.data?.code || error?.response?.data?.detail || ""
    ).toLowerCase();
    return code.includes("token");
  }

  if (status === 400) {
    const msg = String(
      error?.response?.data?.detail || ""
    ).toLowerCase();
    return msg.includes("token");
  }

  return false;
};

/* =============== Response Interceptor =============== */
export const setupAxiosInterceptors = (store) => {
  const { setTokens, logout } = require("../store/slices/authSlice");

  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config || {};

      // لو مش error بسبب التوكن، أو الريكوست ده اتعاد قبل كده
      if (!shouldAttemptRefresh(error, original) || original.__retry) {
        return Promise.reject(error);
      }

      // في حالة إن فيه refresh شغال حاليًا: نخزن الريكوست في الطابور
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token) => {
              try {
                original.__retry = true;
                original.headers = original.headers || {};
                original.headers.Authorization = `Bearer ${token}`;
                resolve(api(original));
              } catch (e) {
                reject(e);
              }
            },
            reject,
          });
        });
      }

      original.__retry = true;
      isRefreshing = true;

      try {
        const { newAccess, newRefresh } = await performRefresh();

        processQueue(null, newAccess);

        // حدّث الـ Redux state
        store.dispatch(
          setTokens({
            access: newAccess,
            refresh: newRefresh || storage.get("refresh") || null,
          })
        );

        // عدّل الهيدر وكرر الريكوست الأصلي
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        processQueue(e, null);
        storage.clearAll();
        try {
          store.dispatch(logout());
        } catch {}
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
  );
};

export default api;
