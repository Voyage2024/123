"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · «Моя видимость» в анкете резидентки (этап 2)
 * app/components/catalog/MyVisibilityPanel.tsx
 *
 * «Открыта к предложениям» (каталог), вес и параметры, пауза 7/14/30,
 * «Так вас видит менеджер» (обязательно перед первым включением),
 * скрыться от менеджера / не приглашать, пульс за 7 дней.
 * Каждое правило проверяет база (миграция 20261201090000); здесь — вид.
 * Нет миграции или не резидентка — блок не показывается.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Activity, Check, Eye, EyeOff, Loader2, MailX, PauseCircle, ShieldCheck, Sparkles, UserX, X } from "lucide-react";
import { getMyCatalogPreview, getMyCatalogState, setManagerHidden, setMyCatalogVisibility, type VisibilityPatch } from "@/app/actions/catalog-visibility";
import { CatalogCardView } from "@/app/components/catalog/CatalogCardView";
import { GHOST_BTN, GOLD_BTN } from "@/app/components/catalog/catalog-ui";
import { PAUSE_DAYS, catalogCopy, fmtDay, type CatalogCard, type CatalogState } from "@/lib/resident-catalog";
import { mediaCopy } from "@/lib/resident-media";

function Toggle({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition disabled:opacity-50 ${on ? "border-[#c9a961]/70 bg-[#c9a961]/80" : "border-zinc-700 bg-zinc-800"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-zinc-950 shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function MyVisibilityPanel({ lang }: { lang: string }) {
  const c = catalogCopy(lang);
  const m = mediaCopy(lang);
  const [state, setState] = useState<CatalogState | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ card: CatalogCard | null; confirm: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await getMyCatalogState();
    if (res.ok) setState(res.state);
    else if (["schema", "forbidden", "not_authenticated"].includes(res.reason)) setHidden(true);
    else setError(c.errors[res.reason]);
  }, [c]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (key: string, p: VisibilityPatch) => {
    setBusy(key);
    setError(null);
    const res = await setMyCatalogVisibility(p);
    setBusy(null);
    if (!res.ok) { setError(c.errors[res.reason]); return false; }
    setState(res.state);
    return true;
  };

  const openPreview = async (confirm: boolean) => {
    setPreview({ card: null, confirm });
    const [res] = await Promise.all([getMyCatalogPreview(), patch("preview", { previewSeen: true })]);
    if (!res.ok) { setPreview(null); setError(c.errors[res.reason]); return; }
    setPreview({ card: res.card, confirm });
  };

  const toggleCatalog = () => {
    if (!state) return;
    if (state.catalogVisible) { void patch("catalog", { visible: false }); return; }
    if (!state.previewSeen) { void openPreview(true); return; }
    void patch("catalog", { visible: true });
  };

  const hide = async (managerId: string, mode: "hidden" | "no_invites" | null) => {
    setBusy(`hide:${managerId}`);
    setError(null);
    const res = await setManagerHidden(managerId, mode);
    setBusy(null);
    if (!res.ok) { setError(c.errors[res.reason]); return; }
    setState(res.state);
  };

  if (hidden) return null;
  if (!state) {
    return (
      <section className="mb-10 rounded-[22px] border border-zinc-800/60 bg-zinc-900/30 p-5" aria-label={c.visTitle}>
        {error ? <p className="text-xs text-rose-200">{error}</p> : <p className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" /> {c.loading}</p>}
      </section>
    );
  }

  const ck = state.checklist;
  const missing = [
    !ck.approved && c.visNeedApproved,
    !ck.kyc && c.visNeedKyc,
    ck.photos < 3 && c.visNeedPhotos(ck.photos),
    !ck.notRestricted && c.visNeedRestricted,
  ].filter(Boolean) as string[];
  const p = state.pulse;
  const scopeLabel = !state.videoConsent ? m.consentTitle : state.videoScope === "catalog" ? m.scopeCatalog : state.videoScope === "hidden" ? m.scopeHidden : m.scopeEngaged;

  return (
    <section id="my-visibility" className="mb-10 scroll-mt-24" aria-labelledby="my-visibility-title">
      <div className="relative overflow-hidden rounded-[22px] border border-zinc-800/60 bg-zinc-900/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#c9a961]/[0.06] blur-3xl" />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c9a961]/80">{c.visKicker}</p>
        <h2 id="my-visibility-title" className="relative mt-1 font-serif text-2xl text-zinc-50">{c.visTitle}</h2>
        <p className="relative mt-1 max-w-2xl text-xs leading-5 text-zinc-400">{c.visLead}</p>

        {/* одноразовая карточка-приглашение для тех, кто ещё не включал каталог (C4) */}
        {!state.catalogVisible && !state.promptDismissed && !state.catalogSince && (
          <div className="relative mt-4 rounded-2xl border border-[#c9a961]/30 bg-gradient-to-br from-[#c9a961]/[0.12] via-transparent to-transparent p-4">
            <p className="flex items-center gap-2 text-sm text-amber-100"><Sparkles size={15} aria-hidden /> {c.promptTitle}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-300">{c.promptText}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={GOLD_BTN} onClick={() => void openPreview(true)}>{c.promptCta}</button>
              <button type="button" className={GHOST_BTN} disabled={busy === "prompt"} onClick={() => void patch("prompt", { dismissPrompt: true })}>{c.promptLater}</button>
            </div>
          </div>
        )}

        <div className="relative mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-sm text-zinc-100"><ShieldCheck size={15} className="text-[#c9a961]" aria-hidden /> {c.visCatalog}</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">{state.catalogVisible ? c.visCatalogHint : c.visCatalogOff}</p>
                </div>
                <Toggle on={state.catalogVisible} disabled={busy === "catalog" || busy === "preview"} onClick={toggleCatalog} label={c.visCatalog} />
              </div>
              {state.catalogVisible && (
                <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${state.listed ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-amber-200/30 bg-amber-200/10 text-amber-100"}`}>
                  {state.listed ? <Check size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
                  {state.pausedUntil ? c.visPausedUntil(fmtDay(state.pausedUntil, lang)) : state.listed ? c.visListed : c.visNotListed}
                </p>
              )}
              {state.catalogVisible && !state.listed && !state.pausedUntil && missing.length > 0 && (
                <div className="mt-2 text-[11px] text-zinc-400">
                  <p>{c.visNeed}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">{missing.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              {!state.enabled && <p className="mt-2 text-[11px] text-zinc-500">{c.visCatalogDisabled}</p>}
              <p className="mt-2 text-[11px] text-zinc-500">{c.visVideoNote}</p>
              <button type="button" className={`${GHOST_BTN} mt-3`} onClick={() => void openPreview(false)}><Eye size={13} aria-hidden /> {c.visPreview}</button>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-100">{c.visBody}</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-500">{c.visBodyHint}</p>
                </div>
                <Toggle on={state.showBodyParams} disabled={busy === "body"} onClick={() => void patch("body", { body: !state.showBodyParams })} label={c.visBody} />
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">Video Identity: <span className="text-zinc-300">{scopeLabel}</span> · <a href="#video-identity" className="underline underline-offset-4 hover:text-amber-100">{c.ringOpen}</a></p>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4">
              <p className="flex items-center gap-2 text-sm text-zinc-100"><PauseCircle size={15} className="text-[#c9a961]" aria-hidden /> {c.visPause}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{state.pausedUntil ? c.visPausedUntil(fmtDay(state.pausedUntil, lang)) : c.visPauseHint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PAUSE_DAYS.map((d) => (
                  <button key={d} type="button" className={GHOST_BTN} disabled={busy === "pause" || !state.catalogVisible} onClick={() => void patch("pause", { pauseDays: d })}>{c.visPauseDays(d)}</button>
                ))}
                {state.pausedUntil && <button type="button" className={GOLD_BTN} disabled={busy === "pause"} onClick={() => void patch("pause", { pauseDays: 0 })}>{c.visResume}</button>}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400"><Activity size={13} className="text-[#c9a961]" aria-hidden /> {c.pulseTitle}</p>
              {p.views + p.shortlisted + p.invites === 0 ? (
                <p className="mt-2 text-[11px] text-zinc-500">{c.pulseEmpty}</p>
              ) : (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {([[p.views, c.pulseViews, p.catalogViews ? `${p.catalogViews} ${c.pulseCatalogViews}` : ""], [p.shortlisted, c.pulseShortlisted, ""], [p.invites, c.pulseInvites, ""]] as const).map(([v, label, sub]) => (
                    <div key={label} className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 px-2 py-2">
                      <dd className="font-serif text-2xl text-amber-100">{v}</dd>
                      <dt className="text-[10px] leading-4 text-zinc-500">{label}</dt>
                      {sub && <dt className="text-[9px] text-zinc-600">{sub}</dt>}
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-4">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400"><UserX size={13} className="text-[#c9a961]" aria-hidden /> {c.visHiddenTitle}</p>
              {state.hidden.length === 0 ? (
                <p className="mt-2 text-[11px] text-zinc-500">{c.visHiddenEmpty}</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {state.hidden.map((h) => (
                    <li key={h.managerId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-zinc-200">{h.label} <span className="text-zinc-500">· {h.mode === "hidden" ? c.visModeHidden : c.visModeNoInvites}</span></span>
                      <button type="button" className="text-[11px] text-zinc-400 underline underline-offset-4 hover:text-amber-100" disabled={busy === `hide:${h.managerId}`} onClick={() => void hide(h.managerId, null)}>{c.visUnhide}</button>
                    </li>
                  ))}
                </ul>
              )}
              {state.recent.length > 0 && (
                <>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.visRecentTitle}</p>
                  <ul className="mt-2 space-y-1.5">
                    {state.recent.map((r) => (
                      <li key={r.managerId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-zinc-200">{r.label} <span className="text-zinc-600">· {fmtDay(r.lastAt, lang)}</span></span>
                        <span className="flex gap-2">
                          <button type="button" className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-200" disabled={!!busy} onClick={() => void hide(r.managerId, "hidden")}><EyeOff size={11} aria-hidden /> {c.visHide}</button>
                          <button type="button" className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-amber-100" disabled={!!busy} onClick={() => void hide(r.managerId, "no_invites")}><MailX size={11} aria-hidden /> {c.visNoInvites}</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-[10.5px] leading-5 text-zinc-600">{c.visHideNote}</p>
            </div>
            <p className="px-1 text-[10.5px] leading-5 text-zinc-600">{c.visNeverShown}</p>
          </div>
        </div>
        {error && <p role="alert" className="relative mt-4 rounded-lg border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">{error}</p>}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={c.visPreviewTitle}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#c9a961]/80">{c.visPreview}</p>
                <p className="mt-1 text-[11px] leading-5 text-zinc-400">{c.visPreviewNote}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} aria-label={c.close} className="rounded-full p-2 text-zinc-400 hover:bg-white/5"><X size={18} /></button>
            </div>
            {preview.card ? (
              <CatalogCardView card={preview.card} lang={lang} watermark="PREVIEW · VOYAGE" />
            ) : (
              <p className="flex items-center gap-2 py-6 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" /> {c.loading}</p>
            )}
            {preview.confirm && preview.card && !state.catalogVisible && (
              <div className="sticky bottom-0 mt-5 flex flex-wrap gap-2 border-t border-zinc-800 bg-zinc-950 pt-4">
                <button type="button" className={GOLD_BTN} disabled={busy === "catalog"} onClick={async () => { if (await patch("catalog", { visible: true })) setPreview(null); }}>{c.visPreviewConfirm}</button>
                <button type="button" className={GHOST_BTN} onClick={() => setPreview(null)}>{c.promptLater}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default MyVisibilityPanel;
