// src/components/chats/SmartMedia.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { FileIcon, Download, Loader2, ExternalLink } from "lucide-react";
export default function SmartMedia({
  media,
  caption,
  name = "Attachment",
  status,
  onLoaded,
}) {
  const pending = ["sending", "queued"].includes(
    String(status || "").toLowerCase()
  );
  const cap = caption || media?.caption || "";
  const filename = media?.filename;
  const mime_type = media?.mime_type;

  /* ---------- helpers ---------- */
  const ensureAbsUrl = (u) => {
    if (!u) return null;
    const s = String(u);
    if (/^(https?:|blob:|data:|file:)/i.test(s)) return s;
    if (s.startsWith("/")) return s;
    return `/${s.replace(/^\/+/, "")}`;
  };
  const inferKindFromMime = (mime = "") => {
    const m = String(mime || "").toLowerCase();
    if (m.startsWith("image/")) return "image";
    if (m.startsWith("video/")) return "video";
    if (m.startsWith("audio/") || m.includes("voice")) return "audio";
    if (m) return "document";
    return null;
  };
  const inferKindFromName = (n = "") => {
    const s = String(n || "").toLowerCase();
    if (/\.(png|jpe?g|webp|gif|bmp|heic|heif|avif)$/.test(s)) return "image";
    if (/\.(mp4|mov|m4v|3gp|avi|webm)$/.test(s)) return "video";
    if (/\.(mp3|m4a|aac|ogg|opus|amr|wav)$/.test(s)) return "audio";
    if (s) return "document";
    return null;
  };

  const isMissing = !media;
  const safeUrl = ensureAbsUrl(media?.url);

  // ✅ هنا التعديل: نستخدم media.kind أو media.type لو الباك إند بعت type=image/video/audio
  const kind = useMemo(() => {
    const base =
      (media?.kind || media?.type || "").toString().toLowerCase();

    if (["image", "video", "audio", "document"].includes(base)) {
      return base;
    }

    return (
      inferKindFromMime(mime_type) ||
      inferKindFromName(filename) ||
      (safeUrl && inferKindFromName(safeUrl)) ||
      "document"
    );
  }, [media?.kind, media?.type, mime_type, filename, safeUrl]);

  /* ---------- Hooks يجب تعريفها دائمًا بالأعلى ---------- */
  // لحالة الصور
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);

  // لحالة الفيديو
  const vidRef = useRef(null);
  useEffect(() => {
    if (kind !== "video") return; // فعّل الليسنرز للفيديو فقط
    const v = vidRef.current;
    if (!v) return;
    const ok = () => onLoaded?.();
    v.addEventListener("loadedmetadata", ok);
    v.addEventListener("canplay", ok);
    return () => {
      v.removeEventListener("loadedmetadata", ok);
      v.removeEventListener("canplay", ok);
    };
  }, [kind, onLoaded]);

  /* ---------- shared ui tokens (تصغير الحجم) ---------- */
  const maxBoxClasses =
    "inline-block align-top max-w-[85vw] sm:max-w-[380px] lg:max-w-[440px] max-h-[300px]";
  const mediaClasses =
    "block h-auto max-h-[300px] w-auto max-w-full object-contain select-none";
  const cardBase =
    "relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800 shadow-sm";

  const OverlayActions = ({ openHref, downloadName }) => (
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {openHref ? (
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-black/60 text-white hover:bg-black/70"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open
        </a>
      ) : null}
      {openHref ? (
        <a
          href={openHref}
          download={downloadName || true}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-black/60 text-white hover:bg-black/70"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
          Save
        </a>
      ) : null}
    </div>
  );

  const PendingOverlay = () => (
    <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
      <div className="flex items-center gap-2 text-white text-xs">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Uploading…</span>
      </div>
    </div>
  );
  // 1) ميديا غير متوفرة
  if (isMissing) {
    return (
      <div className="w-[240px] min-h-[100px] flex items-center justify-center rounded-xl bg-gray-100/70 text-gray-500 text-sm">
        Media not available
      </div>
    );
  }

  // 2) لسه مفيش URL (مستنّي الـ resolver/WS)
  if (!safeUrl) {
    const label =
      kind === "image"
        ? "[IMAGE]"
        : kind === "video"
        ? "[VIDEO]"
        : kind === "audio"
        ? "[AUDIO]"
        : "[FILE]";
    return (
      <div className={`${maxBoxClasses} ${cardBase} p-4`}>
        <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-200">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-medium">{label}</span>
        </div>
        {cap ? (
          <div className="mt-2 text-xs opacity-80 break-words">{cap}</div>
        ) : null}
      </div>
    );
  }

  // 3) Image
  if (kind === "image") {
    const w = Number(media.width) || undefined;
    const h = Number(media.height) || undefined;
    const ratio = w && h ? `${w} / ${h}` : undefined;

    return (
      <figure
        className={`group ${maxBoxClasses} ${cardBase}`}
        style={ratio ? { aspectRatio: ratio } : undefined}
      >
        {!imgLoaded && !imgErrored ? (
          <div className="absolute inset-0 animate-pulse bg-gray-200/70 dark:bg-white/10" />
        ) : null}

        <a
          href={pending ? undefined : safeUrl}
          target={pending ? undefined : "_blank"}
          rel={pending ? undefined : "noopener noreferrer"}
          onClick={(e) => pending && e.preventDefault()}
          title={filename || cap || name}
          className="block"
        >
          <img
            src={safeUrl}
            alt={filename || cap || name}
            className={`${mediaClasses} ${imgLoaded ? "" : "opacity-0"}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => {
              setImgLoaded(true);
              onLoaded?.();
            }}
            onError={() => setImgErrored(true)}
          />
        </a>

        <OverlayActions
          openHref={!pending ? safeUrl : undefined}
          downloadName={filename}
        />
        {pending && <PendingOverlay />}

        {cap ? (
          <figcaption className="px-3 py-2 text-xs text-gray-800 dark:text-gray-100 bg-white/85 dark:bg-black/30 backdrop-blur">
            {cap}
          </figcaption>
        ) : null}

        {imgErrored ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
            >
              Open image
            </a>
          </div>
        ) : null}
      </figure>
    );
  }

  // 4) Video
  if (kind === "video") {
    return (
      <figure
        className={`group ${maxBoxClasses} ${cardBase} bg-black`}
      >
        <video
          ref={vidRef}
          src={safeUrl}
          controls={!pending}
          preload="metadata"
          playsInline
          className={`block max-h-[220px] w-auto max-w-full object-contain ${
            pending ? "opacity-70" : ""
          }`}
        />
        <OverlayActions
          openHref={!pending ? safeUrl : undefined}
          downloadName={filename}
        />
        {pending && <PendingOverlay />}
        {cap ? (
          <figcaption className="px-3 py-2 text-xs text-gray-100 bg-black/50 backdrop-blur">
            {cap}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  // 5) Audio
  if (kind === "audio") {
    return (
      <div className={`${maxBoxClasses} ${cardBase} p-3`}>
        <audio
          controls
          src={safeUrl}
          className={`block w-[260px] ${
            pending ? "pointer-events-none opacity-70" : ""
          }`}
          onLoadedMetadata={() => onLoaded?.()}
        />
        <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
          {cap || filename || mime_type || name}
        </div>
        {pending && <PendingOverlay />}
      </div>
    );
  }

  // 6) Document / Unknown
  const prettySize = (n) => {
    const b = Number(n);
    if (!Number.isFinite(b) || b <= 0) return null;
    const units = ["B", "KB", "MB", "GB"];
    let i = 0,
      v = b;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
  };

  return (
    <div className={`${maxBoxClasses} ${cardBase} p-3 flex items-start gap-3`}>
      <div className="shrink-0 mt-0.5">
        <FileIcon className="w-6 h-6 text-gray-500 dark:text-gray-300" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {filename || name}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className="truncate">{mime_type || "document"}</span>
          {media?.size ? (
            <span className="opacity-70">• {prettySize(media.size)}</span>
          ) : null}
        </div>
        {cap ? (
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 break-words">
            {cap}
          </div>
        ) : null}
      </div>

      {pending ? (
        <div className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-lg border text-gray-500 dark:text-gray-300 opacity-70">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Uploading…</span>
        </div>
      ) : (
        <div className="flex gap-1">
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border hover:bg-gray-50 dark:hover:bg-white/10"
            title="Open in new tab"
            onClick={() => onLoaded?.()}
          >
            <ExternalLink className="w-4 h-4" />
            Open
          </a>
          <a
            href={safeUrl}
            download={filename || true}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border hover:bg-gray-50 dark:hover:bg-white/10"
            title="Download"
          >
            <Download className="w-4 h-4" />
            Save
          </a>
        </div>
      )}
    </div>
  );
}
