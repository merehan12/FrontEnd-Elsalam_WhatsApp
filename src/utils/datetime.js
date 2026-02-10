// src/utils/datetime.js

export function pickMessageDate(msg) {
  // أولوية: ts/created_at ... إلخ
  const iso =
    (msg && (msg.ts || msg.timestamp || msg.time || msg.created_at)) ||
    (msg && msg.body && msg.body.timestamp);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(+d)) return d;
  }

  // WhatsApp raw timestamp بالثواني (string)
  const rawSec =
    (msg && msg.body && msg.body.raw && msg.body.raw.timestamp) ||
    (msg && msg.raw && msg.raw.timestamp) ||
    (msg && msg.body && msg.body.timestamp_sec);
  if (rawSec) {
    const n = Number(rawSec);
    if (Number.isFinite(n)) return new Date(n * 1000);
  }

  return new Date();
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isYesterday(d, base = new Date()) {
  const y = new Date(base);
  y.setDate(base.getDate() - 1);
  return isSameDay(d, y);
}

export function formatDateHeader(d, rtl = false) {
  const now = new Date();
  if (isSameDay(d, now)) return rtl ? "اليوم" : "Today";
  if (isYesterday(d, now)) return rtl ? "أمس" : "Yesterday";

  // مثال: 21 Sep 2025  /  21 سبتمبر 2025
  return rtl
    ? d.toLocaleDateString("ar-EG", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : d.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function formatTimeOnly(d, locale) {
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
