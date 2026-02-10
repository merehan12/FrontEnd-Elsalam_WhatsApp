// src/store/slices/usersSlice.js
import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import api from "../../api/axios";

/* ===================== Helpers ===================== */
// نحوِّل أي is_active إلى active للحفاظ على اتساق الحالة داخل الستور
function normalizeUser(u) {
  if (!u || typeof u !== "object") return u;
  // لو السيرفر رجّع is_active فقط، خلّيه ينعكس على active (البوليني اللي بنعتمد عليه بالـ UI)
  if (Object.prototype.hasOwnProperty.call(u, "is_active") && !Object.prototype.hasOwnProperty.call(u, "active")) {
    return { ...u, active: !!u.is_active };
  }
  return u;
}

function normalizeArray(arr) {
  return Array.isArray(arr) ? arr.map(normalizeUser) : [];
}

/* ===================== Thunks ===================== */

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/auth/users/");
      console.log(res.data)
      return normalizeArray(res.data);
    } catch (err) {
      const msg = err.response?.data || err.message || "Failed to fetch users";
      
      return rejectWithValue(msg);
    }
  }
);

export const createUser = createAsyncThunk(
  "users/createUser",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/users/", payload);
      return normalizeUser(res.data);
    } catch (err) {
      const msg = err.response?.data || err.message || "Failed to create user";
      return rejectWithValue(msg);
    }
  }
);

export const fetchUserById = createAsyncThunk(
  "users/fetchUserById",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/auth/users/${id}/`);
      return normalizeUser(res.data);
    } catch (err) {
      const msg = err.response?.data || err.message || "Failed to fetch user";
      return rejectWithValue(msg);
    }
  }
);

// ✅ تحديث مستخدم (PATCH) — يدعم multipart
export const updateUser = createAsyncThunk(
  "users/updateUser",
  /**
   * args: { id, data, useMultipart?: boolean }
   * data: Object | { avatar: File, ... }
   */
  async ({ id, data, useMultipart = false }, { rejectWithValue }) => {
    try {
      let res;
      if (useMultipart) {
        const form = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, v);
        });
        res = await api.patch(`/auth/users/${id}/`, form);
      } else {
        res = await api.patch(`/auth/users/${id}/`, data);
      }
      // بعض الـ APIs بترجع 204 بدون جسم — نتعامل مع ده فوق في الـ fulfilled
      return res.data;
    } catch (err) {
      const msg = err.response?.data || err.message || "Failed to update user";
      return rejectWithValue(msg);
    }
  }
);

// (اختياري) Thunk مريح لتبديل حالة التفعيل
export const toggleUserActive = createAsyncThunk(
  "users/toggleUserActive",
  /**
   * args: { id, currentActive, field?: "active" | "is_active" }
   */
  async ({ id, currentActive, field = "active" }, { rejectWithValue }) => {
    try {
      const payload = field === "is_active"
        ? { is_active: !currentActive }
        : { active: !currentActive };
      const res = await api.patch(`/auth/users/${id}/`, payload);
      return normalizeUser(res.data ?? { id, ...payload });
    } catch (err) {
      const msg = err.response?.data || err.message || "Failed to toggle active";
      return rejectWithValue(msg);
    }
  }
);

/* ===================== Slice ===================== */

const initialState = {
  list: [],
  status: "idle",
  error: null,

  createStatus: "idle",
  createError: null,

  byId: {},
  byIdStatus: {},
  byIdError: {},

  updateStatusById: {},
  updateErrorById: {},
};

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      /* ------- fetchUsers ------- */
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = normalizeArray(action.payload);
        for (const u of state.list) {
          if (u?.id != null) state.byId[u.id] = u;
        }
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to fetch users";
      })

      /* ------- createUser ------- */
      .addCase(createUser.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.createStatus = "succeeded";
        const u = normalizeUser(action.payload);
        if (u && typeof u === "object") {
          state.list.unshift(u);
          if (u.id != null) state.byId[u.id] = u;
        }
      })
      .addCase(createUser.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.payload || "Failed to create user";
      })

      /* ------- fetchUserById ------- */
      .addCase(fetchUserById.pending, (state, action) => {
        const id = action.meta.arg;
        state.byIdStatus[id] = "loading";
        state.byIdError[id] = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        const u = normalizeUser(action.payload);
        if (u?.id != null) {
          state.byId[u.id] = u;
          state.byIdStatus[u.id] = "succeeded";
          // حافظ على تزامن list مع byId لو كان موجود
          const idx = state.list.findIndex((x) => x.id === u.id);
          if (idx !== -1) state.list[idx] = { ...state.list[idx], ...u };
        }
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        const id = action.meta.arg;
        state.byIdStatus[id] = "failed";
        state.byIdError[id] = action.payload || "Failed to fetch user";
      })

      /* ------- updateUser ------- */
      .addCase(updateUser.pending, (state, action) => {
        const id = action.meta.arg.id;
        state.updateStatusById[id] = "loading";
        state.updateErrorById[id] = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        // نعتبر العملية نجحت حتى مع 204/بدون جسم — نستخدم optimistic merge + أي داتا رجعت
        const id = action.meta.arg.id;
        const serverData = action.payload && typeof action.payload === "object" ? normalizeUser(action.payload) : {};
        let optimistic = action.meta.arg?.data || {};
        optimistic = normalizeUser(optimistic);

        const targetId = serverData.id ?? id;
        const changes = { ...optimistic, ...serverData };

        if (state.byId[targetId]) {
          state.byId[targetId] = { ...state.byId[targetId], ...changes };
        }
        const idx = state.list.findIndex((x) => x.id === targetId);
        if (idx !== -1) state.list[idx] = { ...state.list[idx], ...changes };

        state.updateStatusById[targetId] = "succeeded";
      })
      .addCase(updateUser.rejected, (state, action) => {
        const id = action.meta.arg.id;
        state.updateStatusById[id] = "failed";
        state.updateErrorById[id] = action.payload || "Failed to update user";
      })

      /* ------- toggleUserActive (اختياري) ------- */
      .addCase(toggleUserActive.pending, (state, action) => {
        const id = action.meta.arg.id;
        state.updateStatusById[id] = "loading";
        state.updateErrorById[id] = null;
      })
      .addCase(toggleUserActive.fulfilled, (state, action) => {
        const updated = normalizeUser(action.payload);
        const id = updated?.id ?? action.meta.arg.id;

        if (id != null) {
          // upsert in byId
          state.byId[id] = { ...(state.byId[id] || {}), ...updated };
          // upsert in list
          const idx = state.list.findIndex((x) => x.id === id);
          if (idx !== -1) state.list[idx] = { ...state.list[idx], ...updated };
        }
        state.updateStatusById[id] = "succeeded";
      })
      .addCase(toggleUserActive.rejected, (state, action) => {
        const id = action.meta.arg.id;
        state.updateStatusById[id] = "failed";
        state.updateErrorById[id] = action.payload || "Failed to toggle active";
      });
  },
});

export default usersSlice.reducer;

/* ===================== Selectors ===================== */
export const selectUsersState = (state) => state.users;
export const selectUsersRaw = (state) => state.users.list;

export const selectUserUpdateStatus = (state, id) =>
  state.users.updateStatusById[id] || "idle";
export const selectUserUpdateError = (state, id) =>
  state.users.updateErrorById[id] || null;

export const selectUserById = (state, id) => state.users.byId[id] || null;
export const selectUserByIdStatus = (state, id) =>
  state.users.byIdStatus[id] || "idle";
export const selectUserByIdError = (state, id) =>
  state.users.byIdError[id] || null;

// الإسقاط المستخدم في StaffManagement — يستند إلى active (بعد التطبيع)
export const selectUsersProjected = createSelector([selectUsersRaw], (users) =>
  users.map((u) => {
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    return {
      id: u.id,
      name: fullName || u.username || `User-${u.id}`,
      email: u.email || "",
      role: u.role || "staff",
      status: u.active ? "Active" : "Inactive",
      chats: u.chats_count ?? 0,
      joinDate: (u.date_joined || "").slice?.(0, 10) || u.date_joined || "-",
      phone: u.phone_e164 || "",
      locale: u.locale || null,
      username: u.username,
      _raw: u,
      active: !!u.active, // لو حبيتي تستخدمِه مباشرة (مثلاً للتوغل)
    };
  })
);

// إسقاط عنصر واحد
export const makeSelectProjectedUserById = () =>
  createSelector([(state, id) => selectUserById(state, id)], (u) => {
    if (!u) return null;
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    return {
      id: u.id,
      name: fullName || u.username || `User-${u.id}`,
      email: u.email || "",
      role: u.role || "staff",
      status: u.active ? "Active" : "Inactive",
      phone: u.phone_e164 || "",
      username: u.username,
      avatar: u.avatar || "",
      memberSince: u.member_since || u.date_joined || "",
      _raw: u,
      active: !!u.active,
    };
  });
