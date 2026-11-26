"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity в профиле резидентки
 * app/components/media/VideoIdentitySection.tsx
 *
 * Визитка (загрузка или камера, до 90 с) + Moments (кружки до 30 с,
 * только камера, до 6) + согласие и видимость + «Кто смотрел».
 * Секция сама скрывается, если пользователь не резидентка или миграция
 * 20261130090000 ещё не применена.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Clapperboard, EyeOff, Loader2, Lock, Plus, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import {
  getMyProfileViews,
  getMyVideoIdentity,
  removeMyMedia,
  setMyVideoVisibility,
  type MyMediaResult,
} from "@/app/actions/resident-media";
import {
  INTRO_MAX_BYTES,
  MOMENT_MAX_BYTES,
  INTRO_MAX_SECONDS,
  MOMENT_MAX_COUNT,
  MOMENT_MAX_SECONDS,
  MOMENT_MIN_SECONDS,
  baseMime,
  formatDuration,
  mediaCopy,
  type MediaBundle,
  type MediaFailure,
  type MediaItem,
  type MediaKind,
  type ProfileViews,
} from "@/lib/resident-media";
import { probeVideoFile, uploadCapturedVideo, type CapturedVideo } from "@/app/components/media/mediaUpload";
import { VoyageVideoPlayer } from "@/app/components/media/VoyageVideoPlayer";
import { VideoRecorderDialog } from "@/app/components/media/VideoRecorderDialog";
import { MomentStoryViewer } from "@/app/components/media/MomentStoryViewer";
import { MomentBubble } from "@/app/components/media/MomentBubble";
import { ProfileViewsPanel } from "@/app/components/media/ProfileViewsPanel";

const MB = 1024 * 1024;

export function VideoIdentitySection({ lang }: { lang: string }) {
  const c = mediaCopy(lang);
  const [bundle, setBundle] = useState<MediaBundle | null>(null);
  const [views, setViews] = useState<ProfileViews | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<MediaKind | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reasonText = useCallback((r: MediaFailure, kind: MediaKind = "intro") => {
    if (r === "consent_required") return c.consentTitle;
    if (r === "limit") return c.momentLimit;
    if (r === "too_large") return c.tooLarge(Math.round((kind === "moment" ? MOMENT_MAX_BYTES : INTRO_MAX_BYTES) / MB));
    if (r === "invalid") return c.badFormat;
    return c.failed;
  }, [c]);

  const apply = useCallback((res: MyMediaResult) => {
    if (res.ok) { setBundle(res.bundle); setError(null); return true; }
    setError(reasonText(res.reason));
    return false;
  }, [reasonText]);

  const load = useCallback(async () => {
    const res = await getMyVideoIdentity();
    if (!res.ok) {
      // Не резидентка или миграция не применена — секции нет.
      if (res.reason === "forbidden" || res.reason === "schema" || res.reason === "unauthenticated") setHidden(true);
      else setError(c.failed);
      return;
    }
    setBundle(res.bundle);
    const v = await getMyProfileViews();
    if (v.ok) setViews(v.views);
  }, [c.failed]);

  useEffect(() => { void load(); }, [load]);

  // Ссылки живут 10 минут: обновляем список, пока вкладка открыта.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 8 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  if (hidden) return null;

  const intro = bundle?.items.find((i) => i.kind === "intro") ?? null;
  const moments = bundle?.items.filter((i) => i.kind === "moment") ?? [];
  const consent = bundle?.consent ?? false;
  const scope = bundle?.scope ?? "engaged";
  const playerLabels = { play: c.play, pause: c.pause, mute: c.mute, unmute: c.unmute, fullscreen: c.fullscreen, watermark: c.watermark };

  const setVisibility = async (nextScope: "engaged" | "hidden" | null, nextConsent: boolean | null) => {
    setBusy("visibility");
    const res = await setMyVideoVisibility(nextScope, nextConsent);
    setBusy(null);
    if (!res.ok) { setError(reasonText(res.reason)); return; }
    setBundle((b) => (b ? { ...b, scope: res.scope, consent: res.consent } : b));
  };

  const saveCaptured = async (kind: MediaKind, video: CapturedVideo, topic: string | null): Promise<string | null> => {
    const res = await uploadCapturedVideo(kind, video, topic);
    if (!res.ok) return reasonText(res.reason, kind);
    apply(res);
    setRecorder(null);
    setNotice(c.saved);
    return null;
  };

  const onIntroFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError(null);
    const mime = baseMime(file.type) ?? (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.webm$/i.test(file.name) ? "video/webm" : /\.mp4$/i.test(file.name) ? "video/mp4" : null);
    if (!mime) { setError(c.badFormat); return; }
    if (file.size > INTRO_MAX_BYTES) { setError(c.tooLarge(Math.round(INTRO_MAX_BYTES / MB))); return; }
    setBusy("intro");
    const meta = await probeVideoFile(file);
    if (!meta.durationMs) { setBusy(null); setError(c.badFormat); return; }
    if (meta.durationMs > (INTRO_MAX_SECONDS + 2) * 1000) { setBusy(null); setError(c.tooLong(INTRO_MAX_SECONDS)); return; }
    const res = await uploadCapturedVideo("intro", { blob: file, mime, durationMs: meta.durationMs, width: meta.width, height: meta.height, poster: meta.poster, source: "upload" }, null);
    setBusy(null);
    if (apply(res)) setNotice(c.saved);
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(c.deleteConfirm)) return;
    setBusy(item.id);
    const res = await removeMyMedia(item.id);
    setBusy(null);
    apply(res);
  };

  const latest = bundle?.latestAt ? new Date(bundle.latestAt).toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-PT" : "en-GB", { day: "numeric", month: "long" }) : null;

  return (
    <section className="mb-10" aria-labelledby="video-identity-title">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Clapperboard className="h-4 w-4 text-[#c9a961]" />
        <h2 id="video-identity-title" className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-300">{c.title}</h2>
        <span className="ml-1 text-[10px] text-zinc-600">{c.kicker}</span>
        {latest && <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10px] text-emerald-200">{c.freshness(latest)}</span>}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[#c9a961]/15 bg-gradient-to-br from-zinc-900/80 via-zinc-950 to-black p-4 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#c9a961]/10 blur-3xl" />
        <p className="relative max-w-2xl text-sm leading-6 text-zinc-300">{c.lead}</p>
        <div className="relative mt-4 grid gap-2 sm:grid-cols-3">
          {c.value.map(([title, text]) => (
            <div key={title} className="rounded-xl border border-zinc-800/70 bg-black/25 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-100"><Sparkles size={12} className="text-[#c9a961]" /> {title}</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">{text}</p>
            </div>
          ))}
        </div>

        {!bundle ? (
          <div className="relative mt-6 flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={14} className="animate-spin" /> {c.loading}</div>
        ) : !consent ? (
          <div className="relative mt-6 rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-100"><ShieldCheck size={15} /> {c.consentTitle}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{c.consentText}</p>
            <button type="button" disabled={busy === "visibility"} onClick={() => void setVisibility("engaged", true)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#c9a961]/60 bg-[#c9a961] px-4 text-xs font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:opacity-60">
              {busy === "visibility" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} {c.consentAccept}
            </button>
            {(intro || moments.length > 0) && <p className="mt-2 text-[11px] text-zinc-500">{c.consentRevokeHint}</p>}
          </div>
        ) : null}

        {bundle && (
          <div className={`relative mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] ${consent ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!consent}>
            {/* Визитка */}
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-zinc-200">{c.intro} <span className="text-[10px] text-zinc-600">· {c.maxLen(INTRO_MAX_SECONDS)}</span></p>
                {intro && <span className="font-mono text-[10px] text-zinc-500">{formatDuration(intro.durationMs)}</span>}
              </div>
              {intro?.src ? (
                <div className="mx-auto max-w-[300px]">
                  <VoyageVideoPlayer src={intro.src} poster={intro.poster} durationMs={intro.durationMs} labels={playerLabels} />
                  {intro.status === "hidden_by_staff" && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-400/25 bg-rose-400/5 px-2.5 py-2 text-[11px] text-rose-200"><EyeOff size={12} className="mt-0.5 shrink-0" /> {c.hiddenByStaff}{intro.hiddenReason ? ` · ${c.hiddenReason}: ${intro.hiddenReason}` : ""}</p>
                  )}
                </div>
              ) : (
                <div className="mx-auto flex aspect-[9/16] max-w-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-700/80 bg-black/30 p-5 text-center">
                  <Clapperboard size={26} className="text-zinc-600" />
                  <p className="text-xs text-zinc-400">{c.introEmpty}</p>
                  <p className="text-[11px] leading-5 text-zinc-600">{c.introHint}</p>
                </div>
              )}
              <div className="mx-auto mt-3 flex max-w-[300px] flex-wrap justify-center gap-2">
                <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={(e) => void onIntroFile(e.target.files?.[0])} />
                <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-700 px-3 text-[11px] text-zinc-200 hover:border-[#c9a961]/50 disabled:opacity-50">
                  {busy === "intro" ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {busy === "intro" ? c.uploading : intro ? c.introReplace : c.introUpload}
                </button>
                <button type="button" disabled={!!busy} onClick={() => setRecorder("intro")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-700 px-3 text-[11px] text-zinc-200 hover:border-[#c9a961]/50 disabled:opacity-50"><Camera size={13} /> {c.introRecord}</button>
                {intro && (
                  <button type="button" disabled={!!busy} onClick={() => void remove(intro)} aria-label={c.delete} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rose-400/20 px-3 text-[11px] text-rose-200/90 hover:bg-rose-400/10 disabled:opacity-50">
                    {busy === intro.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} {c.delete}
                  </button>
                )}
              </div>
            </div>

            {/* Moments + настройки */}
            <div className="min-w-0 space-y-5">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-200">{c.moments} <span className="text-[10px] text-zinc-600">· {moments.length}/{MOMENT_MAX_COUNT} · {c.maxLen(MOMENT_MAX_SECONDS)}</span></p>
                </div>
                <p className="mb-3 text-[11px] leading-5 text-zinc-500">{c.momentsHint}</p>
                <div className="flex flex-wrap gap-3">
                  {moments.map((m, i) => (
                    <div key={m.id} className="relative">
                      <MomentBubble item={m} label={`${c.moments} ${i + 1}`} onOpen={() => setStory(i)} />
                      <button type="button" disabled={!!busy} onClick={() => void remove(m)} aria-label={c.delete} className="absolute -right-1 -top-1 rounded-full border border-zinc-700 bg-zinc-950 p-1 text-zinc-400 hover:text-rose-200 disabled:opacity-50">
                        {busy === m.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  ))}
                  {moments.length < MOMENT_MAX_COUNT && (
                    <button type="button" disabled={!!busy} onClick={() => setRecorder("moment")} aria-label={c.momentAdd} className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border border-dashed border-[#c9a961]/50 text-amber-100 transition hover:bg-[#c9a961]/10 disabled:opacity-50">
                      <Plus size={18} />
                      <span className="text-[9px]">{c.momentAdd}</span>
                    </button>
                  )}
                </div>
                {moments.length === 0 && <p className="mt-2 text-[11px] text-zinc-500">{c.momentsEmpty}</p>}
                {moments.length >= MOMENT_MAX_COUNT && <p className="mt-2 text-[11px] text-zinc-500">{c.momentLimit}</p>}
                {moments.some((m) => m.status === "hidden_by_staff") && (
                  <ul className="mt-2 space-y-1">
                    {moments.filter((m) => m.status === "hidden_by_staff").map((m) => (
                      <li key={m.id} className="flex items-start gap-1.5 text-[11px] text-rose-200"><EyeOff size={12} className="mt-0.5 shrink-0" /> {c.hiddenByStaff}{m.hiddenReason ? ` · ${m.hiddenReason}` : ""}</li>
                    ))}
                  </ul>
                )}
              </div>

              {consent && (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{c.scopeTitle}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={c.scopeTitle}>
                    {([["engaged", c.scopeEngaged, c.scopeEngagedHint], ["hidden", c.scopeHidden, c.scopeHiddenHint]] as const).map(([value, title, hint]) => (
                      <button key={value} type="button" role="radio" aria-checked={scope === value} disabled={busy === "visibility"} onClick={() => void setVisibility(value, null)} className={`rounded-xl border px-3 py-2.5 text-left transition ${scope === value ? "border-[#c9a961]/50 bg-[#c9a961]/10" : "border-zinc-800 hover:border-zinc-600"}`}>
                        <span className="flex items-center gap-1.5 text-xs text-zinc-100">{value === "hidden" ? <Lock size={12} /> : <ShieldCheck size={12} />} {title}</span>
                        <span className="mt-0.5 block text-[10.5px] text-zinc-500">{hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10.5px] leading-5 text-zinc-600">{c.privacy}</p>
                  <button type="button" disabled={busy === "visibility"} onClick={() => void setVisibility(null, false)} className="mt-2 text-[11px] text-zinc-500 underline underline-offset-4 hover:text-rose-200">{c.consentRevoke}</button>
                </div>
              )}

              <ProfileViewsPanel views={views} lang={lang} />
            </div>
          </div>
        )}

        {error && <p role="alert" className="relative mt-4 rounded-lg border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">{error}</p>}
        {notice && <p role="status" className="relative mt-4 text-xs text-emerald-200">{notice}</p>}
      </div>

      {recorder && (
        <VideoRecorderDialog
          kind={recorder}
          lang={lang}
          minSeconds={recorder === "moment" ? MOMENT_MIN_SECONDS : 3}
          maxSeconds={recorder === "moment" ? MOMENT_MAX_SECONDS : INTRO_MAX_SECONDS}
          onCancel={() => setRecorder(null)}
          onSave={(video, topic) => saveCaptured(recorder, video, topic)}
        />
      )}
      {story !== null && moments.length > 0 && (
        <MomentStoryViewer items={moments} start={story} lang={lang} onClose={() => setStory(null)} />
      )}
    </section>
  );
}

export default VideoIdentitySection;
