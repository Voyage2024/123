"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · запись видео на сайте (Moments-кружки и Визитка)
 * app/components/media/VideoRecorderDialog.tsx
 *
 * getUserMedia + MediaRecorder. iPhone Safari (iOS 14.3+) пишет только
 * MP4 — формат выбирается автоматически (pickRecorderMime). Камера —
 * фронтальная, превью зеркальное, запись — как видят другие.
 * Шаги: камера → запись (кольцо прогресса, авто-стоп на лимите) →
 * предпросмотр → «Переснять» или «Сохранить».
 * Если браузер не умеет записывать на странице — системная камера
 * телефона через <input capture="user"> (не галерея).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Square, X, Check } from "lucide-react";
import { MOMENT_TOPICS, formatDuration, mediaCopy, pickRecorderMime, type MediaKind, type MomentTopic } from "@/lib/resident-media";
import { posterFromVideo, probeVideoFile, type CapturedVideo } from "@/app/components/media/mediaUpload";

type Phase = "starting" | "live" | "recording" | "review" | "fallback" | "saving";

export function VideoRecorderDialog({
  kind,
  lang,
  minSeconds,
  maxSeconds,
  onCancel,
  onSave,
}: {
  kind: MediaKind;
  lang: string;
  minSeconds: number;
  maxSeconds: number;
  onCancel: () => void;
  /** Возвращает текст ошибки или null при успехе. */
  onSave: (video: CapturedVideo, topic: MomentTopic | null) => Promise<string | null>;
}) {
  const c = mediaCopy(lang);
  const round = kind === "moment";
  const liveRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [captured, setCaptured] = useState<CapturedVideo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [topic, setTopic] = useState<MomentTopic | null>(round ? "hello" : null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("starting");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !pickRecorderMime()) {
      setError(c.cameraMissing);
      setPhase("fallback");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: round
          ? { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 }, aspectRatio: { ideal: 1 } }
          : { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
      });
      streamRef.current = stream;
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        await liveRef.current.play().catch(() => undefined);
      }
      setPhase("live");
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? c.cameraDenied : c.cameraMissing);
      setPhase("fallback");
    }
  }, [c.cameraDenied, c.cameraMissing, round]);

  useEffect(() => {
    void startCamera();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (tick.current) clearInterval(tick.current);
      try { recRef.current?.state === "recording" && recRef.current.stop(); } catch { /* уже остановлен */ }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- камера включается один раз при открытии
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const finishRecording = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state === "recording") rec.stop();
    if (tick.current) clearInterval(tick.current);
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    const mimeType = pickRecorderMime();
    if (!stream || !mimeType) return;
    chunks.current = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: round ? 1_500_000 : 2_500_000, audioBitsPerSecond: 96_000 });
    } catch {
      rec = new MediaRecorder(stream);
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
    rec.onstop = async () => {
      const durationMs = Date.now() - startedAt.current;
      const type = (rec.mimeType || mimeType).split(";")[0];
      const blob = new Blob(chunks.current, { type });
      const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
      stopStream();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCaptured({
        blob,
        mime: type,
        durationMs,
        width: typeof settings.width === "number" ? settings.width : null,
        height: typeof settings.height === "number" ? settings.height : null,
        poster: null,
        source: "in_app_camera",
      });
      setPhase("review");
    };
    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setPhase("recording");
    tick.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= maxSeconds * 1000) finishRecording();
    }, 100);
  };

  // Обложка: первый кадр предпросмотра.
  const onReviewLoaded = async () => {
    const v = reviewRef.current;
    if (!v || !captured || captured.poster) return;
    const poster = await posterFromVideo(v);
    setCaptured((prev) => (prev ? { ...prev, poster, width: prev.width ?? (v.videoWidth || null), height: prev.height ?? (v.videoHeight || null) } : prev));
  };

  const retake = () => {
    setCaptured(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    void startCamera();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const meta = await probeVideoFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptured({ blob: file, mime: file.type || "video/mp4", durationMs: meta.durationMs, width: meta.width, height: meta.height, poster: meta.poster, source: "in_app_camera" });
    setPhase("review");
  };

  const save = async () => {
    if (!captured) return;
    const secs = captured.durationMs / 1000;
    if (secs < minSeconds) { setError(c.tooShort(minSeconds)); return; }
    if (secs > maxSeconds + 1.5) { setError(c.tooLong(maxSeconds)); return; }
    setPhase("saving");
    setError(null);
    const message = await onSave(captured, round ? topic : null);
    if (message) { setError(message); setPhase("review"); }
  };

  const progress = Math.min(1, elapsed / (maxSeconds * 1000));
  const R = 47;
  const CIRC = 2 * Math.PI * R;
  const frame = round ? "aspect-square w-[min(78vw,360px)] rounded-full" : "aspect-[9/16] h-[min(62vh,560px)] rounded-3xl";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={round ? c.momentAdd : c.introRecord}>
      <button type="button" onClick={onCancel} aria-label={c.close} className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 hover:text-white"><X size={18} /></button>

      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c9a961]">{round ? c.moments : c.intro}</p>
      <p className="mb-4 max-w-sm text-center text-xs leading-5 text-zinc-400">
        {round && topic ? c.topics[topic].prompt : c.introHint}
      </p>

      <div className="relative">
        <div className={`relative overflow-hidden border border-amber-200/20 bg-zinc-950 shadow-[0_0_60px_rgba(201,169,97,0.12)] ${frame}`}>
          {(phase === "starting" || phase === "live" || phase === "recording") && (
            <video ref={liveRef} muted playsInline autoPlay className="h-full w-full scale-x-[-1] object-cover" />
          )}
          {(phase === "review" || phase === "saving") && previewUrl && (
            <video ref={reviewRef} src={previewUrl} playsInline autoPlay muted loop controls={!round} onLoadedData={onReviewLoaded} onClick={(e) => { e.currentTarget.muted = !e.currentTarget.muted; void e.currentTarget.play().catch(() => undefined); }} className="h-full w-full object-cover" />
          )}
          {phase === "starting" && <div className="absolute inset-0 flex items-center justify-center text-zinc-500"><Loader2 className="animate-spin" size={26} /></div>}
          {phase === "fallback" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Camera size={26} className="text-zinc-500" />
              <p className="text-xs leading-5 text-zinc-400">{error}</p>
            </div>
          )}
          {phase === "recording" && (
            <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-rose-200">
              ● {formatDuration(elapsed)} / {formatDuration(maxSeconds * 1000)}
            </span>
          )}
        </div>
        {round && phase === "recording" && (
          <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.6" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="#c9a961" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
          </svg>
        )}
      </div>

      {round && (phase === "live" || phase === "review") && (
        <div className="mt-5 flex max-w-md flex-wrap justify-center gap-1.5" role="radiogroup" aria-label={c.pickTopic}>
          {MOMENT_TOPICS.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={topic === t} onClick={() => setTopic(t)} className={`rounded-full border px-3 py-1 text-[11px] transition ${topic === t ? "border-[#c9a961]/60 bg-[#c9a961]/15 text-amber-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}>
              {c.topics[t].label}
            </button>
          ))}
        </div>
      )}

      {error && phase !== "fallback" && <p role="alert" className="mt-4 max-w-sm text-center text-xs text-rose-200">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        {phase === "live" && (
          <button type="button" onClick={startRecording} aria-label={c.record} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/70 bg-transparent transition hover:scale-105">
            <span className="h-11 w-11 rounded-full bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]" />
          </button>
        )}
        {phase === "recording" && (
          <button type="button" onClick={finishRecording} aria-label={c.stop} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/70">
            <Square size={22} className="text-rose-400" fill="currentColor" />
          </button>
        )}
        {(phase === "review" || phase === "saving") && (
          <>
            <button type="button" onClick={retake} disabled={phase === "saving"} className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2.5 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-40"><RotateCcw size={14} /> {c.retake}</button>
            <button type="button" onClick={save} disabled={phase === "saving"} className="inline-flex items-center gap-2 rounded-full border border-[#c9a961]/50 bg-[#c9a961] px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-200 disabled:opacity-60">
              {phase === "saving" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {phase === "saving" ? c.uploading : c.save}
            </button>
          </>
        )}
        {phase === "fallback" && (
          <>
            <input ref={fileRef} type="file" accept="video/*" capture="user" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-[#c9a961]/50 bg-[#c9a961]/10 px-4 py-2.5 text-xs text-amber-100"><Camera size={14} /> {c.cameraFallback}</button>
            <button type="button" onClick={() => void startCamera()} className="rounded-full border border-zinc-700 px-4 py-2.5 text-xs text-zinc-300">{c.retake}</button>
          </>
        )}
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">{c.maxLen(maxSeconds)}</p>
    </div>
  );
}
