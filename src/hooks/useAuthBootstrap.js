import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMe, refreshTokensThunk } from "../store/slices/authSlice";

const parseJwt = (token) => {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

export default function useAuthBootstrap() {
  const dispatch = useDispatch();
  const access = useSelector((s) => s.auth.access);
  const timerRef = useRef(null);

  useEffect(() => {
    // عند أول تحميل ولو فيه access نحاول نجيب /me
    if (access) dispatch(fetchMe());
  }, [access, dispatch]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!access) return;

    const payload = parseJwt(access);
    if (!payload?.exp) return;

    const nowMs = Date.now();
    const expMs = payload.exp * 1000;
    const refreshAt = Math.max(0, expMs - nowMs - 60 * 1000); // 60 ثانية قبل الانتهاء

    timerRef.current = setTimeout(() => {
      dispatch(refreshTokensThunk());
    }, refreshAt);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [access, dispatch]);
}
