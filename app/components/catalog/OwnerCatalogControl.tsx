"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток — контроль owner (этап 2)
 * app/components/catalog/OwnerCatalogControl.tsx
 *
 * Выключатель каталога (по умолчанию выключен, D5: включать после юриста),
 * лимиты по умолчанию, доступ менеджеров (выдаётся явно, с причиной),
 * использование за сегодня, код водяного знака и журнал событий.
 * Все изменения проверяет база: voyage_owner_catalog_* только для owner.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Power, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { PageHeader, PageShell, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import {
  getOwnerCatalogOverview, ownerSetCatalogAccess, ownerSetCatalogSettings,
  type OwnerCatalogManager, type OwnerCatalogOverview,
} from "@/app/actions/owner-catalog";
import { FIELD, GHOST_BTN, GOLD_BTN } from "@/app/components/catalog/catalog-ui";
import { catalogCopy, localeOf, photoFirstCopy, type CatalogCopy } from "@/lib/resident-catalog";

const fmtAt = (v: string, lang: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(localeOf(lang), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const toInt = (v: string) => (v.trim() === "" ? null : Number(v));

export default function OwnerCatalogControl() {
  const { lang } = useLanguage();
  const c = catalogCopy(lang);
  const [ov, setOv] = useState<OwnerCatalogOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getOwnerCatalogOverview();
    if (!r.ok) { setError(c.errors[r.reason] ?? c.errors.failed); return; }
    setOv(r.overview); setError(null);
  }, [c]);
  useEffect(() => { void load(); }, [load]);

  return (
    <PageShell>
      <PageHeader eyebrow={c.ownEyebrow} title={c.ownTitle} subtitle={c.ownSubtitle} />
      <div className="mt-8 space-y-6">
        {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
        {!ov ? (
          !error && <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 size={14} className="animate-spin" /> {c.loading}</p>
        ) : (
          <>
            {!ov.canManage && <p className="text-xs text-zinc-500">{c.ownReadOnly}</p>}
            <SettingsPanel c={c} ov={ov} onSaved={setOv} />
            <Panel className="p-5">
              <p className="text-sm text-zinc-300">{c.ownResidents(ov.residents.optedIn, ov.residents.listed, ov.residents.paused, ov.residents.videoCatalog)}</p>
              <p className="mt-1 text-xs text-zinc-500">{c.ownInvites7(ov.invites7d)}</p>
              {/* каталог 2.0, этап A (D6): включили, но не видны из-за города, роста или языка */}
              {ov.residents.missingBasics > 0 && (
                <p className="mt-2 text-xs text-amber-100/90">{photoFirstCopy(lang).ownMissingBasics(ov.residents.missingBasics)}</p>
              )}
            </Panel>
            <Panel className="p-5">
              <h2 className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">{c.ownManagers}</h2>
              <ul className="mt-4 divide-y divide-zinc-800/80">
                {ov.managers.map((m) => <ManagerRow key={m.id} m={m} c={c} lang={lang} canManage={ov.canManage} onSaved={setOv} />)}
              </ul>
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel className="p-5">
                <h2 className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">{c.ownLimitEvents}</h2>
                {ov.limitEvents.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                    {ov.limitEvents.map((e, i) => (
                      <li key={i}>{fmtAt(e.at, lang)} · {e.manager} · {e.kind.endsWith("invites") ? c.ownKindInvites : c.ownKindOpens}</li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-xs text-zinc-600">{c.ownNoEvents}</p>}
              </Panel>
              <Panel className="p-5">
                <h2 className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">{c.ownAccessEvents}</h2>
                {ov.accessEvents.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                    {ov.accessEvents.map((e, i) => (
                      <li key={i}>
                        {fmtAt(e.at, lang)} · {e.manager || "—"} · {e.enabled !== null ? (e.enabled ? c.ownEnabled : c.ownDisabled) : e.status ? (c.ownAccess as Record<string, string>)[e.status] ?? e.status : e.action === "catalog.settings" ? c.ownLimitsSaved : e.action}
                        {e.reason ? <span className="text-zinc-600"> — {e.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-xs text-zinc-600">{c.ownNoEvents}</p>}
              </Panel>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function SettingsPanel({ c, ov, onSaved }: { c: CatalogCopy; ov: OwnerCatalogOverview; onSaved: (o: OwnerCatalogOverview) => void }) {
  const [opens, setOpens] = useState(String(ov.settings.defaultOpenLimit));
  const [invites, setInvites] = useState(String(ov.settings.defaultInviteLimit));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"switch" | "limits" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const on = ov.settings.enabled;
  const limitsChanged = toInt(opens) !== ov.settings.defaultOpenLimit || toInt(invites) !== ov.settings.defaultInviteLimit;

  // Включение/выключение — отдельная кнопка с явным enabled; «Сохранить лимиты» enabled не передаёт
  // (раньше причина стояла рядом с «Сохранить», и это сохраняло лимиты, а каталог не включало).
  const run = async (kind: "switch" | "limits") => {
    setError(null); setDone(null);
    if (reason.trim().length < 3) { setError(c.ownReasonRequired); reasonRef.current?.focus(); return; }
    setBusy(kind);
    const r = kind === "switch"
      ? await ownerSetCatalogSettings({ enabled: !on, openLimit: null, inviteLimit: null, reason })
      : await ownerSetCatalogSettings({ enabled: null, openLimit: toInt(opens), inviteLimit: toInt(invites), reason });
    setBusy(null);
    if (!r.ok) { setError(c.errors[r.reason] ?? c.errors.failed); return; }
    setReason("");
    setDone(kind === "switch" ? (r.overview.settings.enabled ? c.ownEnabled : c.ownDisabled) : c.ownLimitsSaved);
    onSaved(r.overview);
  };

  return (
    <Panel className="p-5">
      <p className={`inline-flex items-center gap-2 text-sm ${on ? "text-emerald-200" : "text-zinc-300"}`}>
        <Power size={16} aria-hidden /> {on ? c.ownEnabled : c.ownDisabled}
      </p>
      {!ov.settings.present && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{c.ownSettingsMissing}</p>
      )}
      <p className="mt-2 text-xs text-amber-100/80">{c.ownLawyer}</p>

      {ov.canManage && (
        <>
          <label className="mt-4 block text-xs text-zinc-400">
            {c.ownReason}
            <input ref={reasonRef} className={`${FIELD} mt-1`} maxLength={500} value={reason} placeholder={c.ownReasonHint}
              onChange={(e) => { setReason(e.target.value); setError(null); }} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={on ? GHOST_BTN : GOLD_BTN} disabled={busy !== null} onClick={() => run("switch")}>
              {busy === "switch" && <Loader2 size={14} className="animate-spin" />} {on ? c.ownDisable : c.ownEnable}
            </button>
            <span className="text-[11px] text-zinc-500">{c.ownSwitchHint}</span>
          </div>

          <div className="mt-5 border-t border-zinc-800/80 pt-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{c.ownDefaults}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-xs text-zinc-400">{c.ownOpens}<input className={`${FIELD} mt-1`} inputMode="numeric" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
              <label className="text-xs text-zinc-400">{c.ownInvites}<input className={`${FIELD} mt-1`} inputMode="numeric" value={invites} onChange={(e) => setInvites(e.target.value)} /></label>
              <button type="button" className={GHOST_BTN} disabled={busy !== null || !limitsChanged} onClick={() => run("limits")}>
                {busy === "limits" && <Loader2 size={14} className="animate-spin" />} {c.ownSaveLimits}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-600">{c.ownLimitsHint}</p>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
      {done && !error && <p role="status" className="mt-3 text-xs text-emerald-200">✓ {done}</p>}
    </Panel>
  );
}

function ManagerRow({ m, c, lang, canManage, onSaved }: {
  m: OwnerCatalogManager; c: CatalogCopy; lang: string; canManage: boolean; onSaved: (o: OwnerCatalogOverview) => void;
}) {
  const [open, setOpen] = useState(false);
  const [opens, setOpens] = useState(m.access?.openLimit != null ? String(m.access.openLimit) : "");
  const [invites, setInvites] = useState(m.access?.inviteLimit != null ? String(m.access.inviteLimit) : "");
  const [expires, setExpires] = useState(m.access?.expiresAt ? m.access.expiresAt.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = m.access?.status ?? "none";

  const set = async (next: "active" | "suspended" | "none") => {
    setBusy(true); setError(null);
    const r = await ownerSetCatalogAccess({
      managerId: m.id, status: next, openLimit: toInt(opens), inviteLimit: toInt(invites),
      expiresAt: expires ? `${expires}T23:59:59Z` : null, reason,
    });
    setBusy(false);
    if (!r.ok) { setError(c.errors[r.reason] ?? c.errors.failed); return; }
    setReason(""); setOpen(false); onSaved(r.overview);
  };

  const tone = status === "active" ? "text-emerald-200" : status === "suspended" ? "text-amber-200" : "text-zinc-500";
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-100">
            {m.name}{m.agency ? <span className="text-zinc-500"> · {m.agency}</span> : null}
            {m.badge && <ShieldCheck size={13} className="ml-1 inline text-[#c9a961]" aria-label={m.badge} />}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
            <span className={tone}>{c.ownAccess[status]}</span>
            <span>{c.ownCode}: <span className="font-mono text-zinc-400">{m.code}</span></span>
            {m.today && <span>{c.ownToday}: {m.today.opensUsed}/{m.today.opens} · {m.today.invitesUsed}/{m.today.invites}</span>}
            {m.access?.expiresAt && <span>→ {fmtAt(m.access.expiresAt, lang)}</span>}
            {!m.eligible && <span className="text-rose-300/80">{c.ownNotEligible}</span>}
          </p>
          {m.access?.reason && <p className="mt-0.5 text-[11px] text-zinc-600">{m.access.reason}</p>}
        </div>
        {canManage && (m.eligible || status !== "none") && (
          <button type="button" className={GHOST_BTN} onClick={() => setOpen((v) => !v)} aria-expanded={open}>{c.ownEdit}</button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-3 rounded-xl border border-zinc-800 p-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-400">{c.ownOpens}<input className={`${FIELD} mt-1`} inputMode="numeric" placeholder="—" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
          <label className="text-xs text-zinc-400">{c.ownInvites}<input className={`${FIELD} mt-1`} inputMode="numeric" placeholder="—" value={invites} onChange={(e) => setInvites(e.target.value)} /></label>
          <label className="text-xs text-zinc-400">{c.ownExpires}<input type="date" className={`${FIELD} mt-1`} value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
          <label className="text-xs text-zinc-400 sm:col-span-3">{c.ownReason}<input className={`${FIELD} mt-1`} maxLength={500} placeholder={c.ownReasonHint} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            {m.eligible && <button type="button" className={GOLD_BTN} disabled={busy || reason.trim().length < 3} onClick={() => set("active")}>{c.ownGrant}</button>}
            {status === "active" && <button type="button" className={GHOST_BTN} disabled={busy || reason.trim().length < 3} onClick={() => set("suspended")}>{c.ownSuspend}</button>}
            {status !== "none" && <button type="button" className={GHOST_BTN} disabled={busy || reason.trim().length < 3} onClick={() => set("none")}>{c.ownRevoke}</button>}
          </div>
          {error && <p role="alert" className="text-xs text-rose-300 sm:col-span-3">{error}</p>}
        </div>
      )}
    </li>
  );
}
