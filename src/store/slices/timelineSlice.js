import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";

/* ====================== Timeline (BY CONVERSATION ID) ====================== */

export const fetchTimelineAll = createAsyncThunk(
  "timeline/fetchAll",
  async ({ conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/timeline/${conversationId}/`);
      return { id: String(conversationId), data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);

export const fetchTimelineStatus = createAsyncThunk(
  "timeline/fetchStatus",
  async ({ conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/timeline/status/${conversationId}/`);
      return { id: String(conversationId), data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);
export const fetchTimelineStaff = createAsyncThunk(
  "timeline/fetchStaff",
  async ({ customerId, conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/timeline/staff/customer/${customerId}/`);
      // ✅ نخزن على conversationId عشان tl بتتجاب بـ selectedChat
      return { id: String(conversationId), data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);


export const fetchTimelineMessages = createAsyncThunk(
  "timeline/fetchMessages",
  async ({ conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/timeline/messages/${conversationId}/`);
      return { id: String(conversationId), data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);

/* ====================== Comments (BY CUSTOMER ID) ====================== */

export const fetchComments = createAsyncThunk(
  "timeline/fetchComments",
  async ({ customerId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/timeline/comments/${customerId}/`);
      return { id: String(customerId), data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);

export const createComment = createAsyncThunk(
  "timeline/createComment",
  async (
    { customerId, content, comment_type = "internal", visibility = "staff" },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await api.post(`/timeline/comments/${customerId}/`, {
        content,
        comment_type,
        visibility,
      });
      return { id: String(customerId), item: data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);

export const editComment = createAsyncThunk(
  "timeline/editComment",
  async ({ commentId, content }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/timeline/comments/edit/${commentId}/`, {
        content,
      });
      return { commentId, item: data };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);

export const deleteComment = createAsyncThunk(
  "timeline/deleteComment",
  async ({ commentId }, { rejectWithValue }) => {
    try {
      await api.delete(`/timeline/comments/delete/${commentId}/`);
      return { commentId };
    } catch (e) {
      return rejectWithValue(e?.response?.data || String(e));
    }
  }
);

/* ====================== Slice ====================== */

const timelineSlice = createSlice({
  name: "timeline",
  initialState: {
    byId: {},
  },
  reducers: {
    clearTimelineFor: (st, { payload }) => {
      delete st.byId[String(payload)];
    },
  },
  extraReducers: (builder) => {
    const ensure = (st, id) => {
      const k = String(id);
      if (!st.byId[k])
        st.byId[k] = { comments: [], loading: false, error: null };
      return k;
    };

    const start = (st, id) => {
      const k = ensure(st, id);
      st.byId[k].loading = true;
      st.byId[k].error = null;
    };

    const fail = (st, id, err) => {
      const k = ensure(st, id);
      st.byId[k].loading = false;
      st.byId[k].error = err;
    };

    // Timeline
    builder
      .addCase(fetchTimelineAll.pending, (st, a) =>
        start(st, a.meta.arg.conversationId)
      )
      .addCase(fetchTimelineAll.fulfilled, (st, a) => {
        const { id, data } = a.payload;
        const k = ensure(st, id);
        st.byId[k].loading = false;
        st.byId[k].error = null;
        st.byId[k].all = data;
      })
      .addCase(fetchTimelineAll.rejected, (st, a) =>
        fail(st, a.meta.arg.conversationId, a.payload || a.error.message)
      )

      .addCase(fetchTimelineStatus.pending, (st, a) =>
        start(st, a.meta.arg.conversationId)
      )
      .addCase(fetchTimelineStatus.fulfilled, (st, a) => {
        const { id, data } = a.payload;
        const k = ensure(st, id);
        st.byId[k].loading = false;
        st.byId[k].status = data;
      })
      .addCase(fetchTimelineStatus.rejected, (st, a) =>
        fail(st, a.meta.arg.conversationId, a.payload || a.error.message)
      )
.addCase(fetchTimelineStaff.pending, (st, a) =>
  start(st, a.meta.arg.conversationId)
)
.addCase(fetchTimelineStaff.fulfilled, (st, a) => {
  const { id, data } = a.payload;
  const k = ensure(st, id);
  st.byId[k].loading = false;
  st.byId[k].staff = data;
})
.addCase(fetchTimelineStaff.rejected, (st, a) =>
  fail(st, a.meta.arg.conversationId, a.payload || a.error.message)
)



      .addCase(fetchTimelineMessages.pending, (st, a) =>
        start(st, a.meta.arg.conversationId)
      )
      .addCase(fetchTimelineMessages.fulfilled, (st, a) => {
        const { id, data } = a.payload;
        const k = ensure(st, id);
        st.byId[k].loading = false;
        st.byId[k].msgActivity = data;
      })
      .addCase(fetchTimelineMessages.rejected, (st, a) =>
        fail(st, a.meta.arg.conversationId, a.payload || a.error.message)
      );

    // Comments (customerId)
    builder
      .addCase(fetchComments.pending, (st, a) =>
        start(st, a.meta.arg.customerId)
      )
      .addCase(fetchComments.fulfilled, (st, a) => {
        const { id, data } = a.payload;
        const k = ensure(st, id);
        st.byId[k].loading = false;
        st.byId[k].error = null;
        st.byId[k].comments = Array.isArray(data) ? data : data?.comments || [];
      })
      .addCase(fetchComments.rejected, (st, a) =>
        fail(st, a.meta.arg.customerId, a.payload || a.error.message)
      )

      .addCase(createComment.fulfilled, (st, a) => {
        const { id, item } = a.payload;
        const k = ensure(st, id);
        st.byId[k].comments = [item, ...(st.byId[k].comments || [])];
      })
      .addCase(editComment.fulfilled, (st, a) => {
        const { commentId, item } = a.payload;
        for (const k of Object.keys(st.byId)) {
          const arr = st.byId[k]?.comments;
          if (!Array.isArray(arr)) continue;
          const idx = arr.findIndex((c) => String(c.id) === String(commentId));
          if (idx !== -1) arr[idx] = item;
        }
      })
      .addCase(deleteComment.fulfilled, (st, a) => {
        const { commentId } = a.payload;
        for (const k of Object.keys(st.byId)) {
          const arr = st.byId[k]?.comments;
          if (!Array.isArray(arr)) continue;
          st.byId[k].comments = arr.filter(
            (c) => String(c.id) !== String(commentId)
          );
        }
      });
  },
});

export const selectTimelineState = (s, id) =>
  s.timeline?.byId?.[String(id)] || { comments: [], loading: false, error: null };

export const { clearTimelineFor } = timelineSlice.actions;
export default timelineSlice.reducer;
