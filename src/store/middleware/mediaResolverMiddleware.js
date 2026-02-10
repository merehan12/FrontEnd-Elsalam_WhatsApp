import api from "../../api/axios";
import { wsMessageReceived, messagePatched } from "../slices/messagesSlice";

// نحاول أكثر من مسار حسب الباك إند عندك
async function resolveMediaUrl(convId, mediaId) {
  const paths = [
    `/messaging/${convId}/media/url/`,
    `/messaging/${convId}/media/resolve/`,
    `/messaging/media/url/`,
  ];
  for (const p of paths) {
    try {
      const { data } = await api.get(p, { params: { id: mediaId } });
      const url = data?.url || data?.file_url || data?.link;
      if (url) {
        return {
          url,
          mime_type: data?.mime_type || null,
          filename: data?.filename || null,
          size: data?.file_size || null,
        };
      }
    } catch { /* جرب Path تاني */ }
  }
  return null;
}

export const mediaResolverMiddleware = store => next => async action => {
  const result = next(action);

  // نشتغل فقط على رسائل WS الواردة
  if (action.type === wsMessageReceived.type) {
    const payload = action.payload && action.payload.message ? action.payload.message : action.payload;
    const convId = String(
      payload?.conversation ?? payload?.conversation_id ?? payload?.conv_id ?? ""
    );
    if (!convId) return result;

    // حاول تقتنص الـ media id من هيكل واتساب
    const raw = payload?.body?.raw || payload?.raw || payload;
    const msg0 =
      raw?.messages?.[0] ||
      raw?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ||
      payload?.body?.raw?.messages?.[0];

    if (!msg0) return result;

    const t = String(msg0?.type || "").toLowerCase();
    const node = msg0?.image || msg0?.video || msg0?.audio || msg0?.document || msg0?.[t];
    const mediaId = node?.id;

    // لو معندناش URL ومعانا ID، حلّه فورًا
    const noUrlInPayload = !node?.link && !node?.url && !payload?.media?.file_url && !payload?.body?.url;
    if (mediaId && noUrlInPayload) {
      try {
        const resolved = await resolveMediaUrl(convId, mediaId);
        if (resolved?.url) {
          store.dispatch(
            messagePatched({
              conversationId: convId,
              messageId: payload?.id || payload?.message_id || null,
              media: {
                id: mediaId,
                kind: t === "voice" ? "audio" : t || "document",
                caption:
                  node?.caption ||
                  payload?.caption ||
                  payload?.body?.caption ||
                  "",
                ...resolved,
              },
            })
          );
        }
      } catch {
        // تجاهل — هتظهر بعد الـ fetch الدوري عموماً
      }
    }
  }

  return result;
};
