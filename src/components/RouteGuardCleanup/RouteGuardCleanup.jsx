// src/components/RouteGuardCleanup.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setSelectedConversationId, stopConversationsWS } from "../../store/slices/conversationsSlice";

export default function RouteGuardCleanup() {
  const { pathname } = useLocation();
  const dispatch = useDispatch();

  useEffect(() => {
    // أول ما نخرج من /chats — اقفل جلسة الشات ونضّف الحالة
    if (!pathname.startsWith("/chats")) {
      dispatch(setSelectedConversationId(null));
      dispatch(stopConversationsWS());
    }
  }, [pathname, dispatch]);

  return null;
}
