"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Кабинет скаута (/scout)
 *
 *   ScoutModelsBoard     /scout            — модели с воронкой + ссылки VYM
 *   ScoutCastingShowcase /scout/castings   — открытые кастинги под моделей
 *   ScoutEarnings        /scout/earnings   — леджер и выплаты (и менеджеру)
 *   ScoutProfileView     /scout/profile    — контакт, ставка, реквизиты
 *
 * Все данные — через SECURITY DEFINER RPC; таблицы кастингов, туров,
 * заказов и профилей скауту RLS не открывает.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CalendarDays, Gem, Link2, Loader2, MapPin, Plus, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, SectionHeader, StatStrip } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { issueScoutInvite, revokeScoutInvite, setMyPayoutDetails } from "@/app/actions/scouting";
import { errorCode } from "@/lib/tour-ops/types";
import { fmtDay, fmtMoney, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, CopyButton, Field, INPUT, Notice } from "@/app/components/tour-ops/ops-ui";
import KycLevelBadge from "@/app/components/profile/KycLevelBadge";
import { projectLabels } from "@/lib/project-types";
import {
  PAYOUT_METHODS,
  parseCabinetModels,
  parseLedger,
  parseScoutHome,
  parseShowcase,
  payoutFormatOk,
  type CabinetModel,
  type CabinetModels,
  type LedgerStatus,
  type PayoutMethod,
  type ScoutHome,
  type ScoutLedger,
  type ShowcaseCasting,
  type ShowcaseFit,
} from "@/lib/scouting/cabinet";
import { cabinetError } from "@/lib/scouting/cabinet-i18n";
import { Avatar, BONUS_TONE, tourRange } from "@/app/components/scouting/scout-ui";
import { FunnelNudge, ModelFunnel, NudgeButton, useCabinet } from "@/app/components/scouting/ScoutFunnel";

type Msg = { tone: "rose" | "emerald" | "amber"; text: string } | null;
type Invite = { id: string; code: string; note: string | null; status: string; uses: number; maxUses: number; expiresAt: string };

function botLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=mod_${code}` : null;
}

const money = (list: { currency: string; v: number }[], lang: "EN" | "RU" | "ES" | "PT") =>
  list.filter((x) => x.v).map((x) => fmtMoney(x.v, x.currency, lang)).join(" · ") || "0";

function MsgLine({ msg }: { msg: Msg }) {
  return msg ? <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null;
}

/* ══════════════════════════════════════════════════════════════════
 * /scout — модели и ссылки
 * ══════════════════════════════════════════════════════════════════ */

export function ScoutModelsBoard() {
  const { c, lang } = useCabinet();
  const tz = viewerTimezone(null);
  const [data, setData] = useState<CabinetModels | null>(null);
  const [ledger, setLedger] = useState<ScoutLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const [m, l] = await Promise.all([supabase.rpc("voyage_my_scouted_models"), supabase.rpc("voyage_my_scout_ledger")]);
    setLoading(false);
    if (m.error) setMsg({ tone: "rose", text: cabinetError(c, errorCode(m.error.message)) });
    setData(m.error ? null : parseCabinetModels(m.data));
    setLedger(l.error ? null : parseLedger(l.data));
  }, [c]);

  useEffect(() => {
    void load();
  }, [load]);

  const models = data?.models ?? [];
  const ready = models.filter((m) => m.readiness?.next === "ready" || m.readiness?.next === "waiting").length;
  const inTour = models.filter((m) => m.readiness?.inTour || m.tours.length > 0).length;
  const totals = ledger?.totals ?? [];

  return (
    <PageShell>
      <PageHeader eyebrow={c.eyebrow} title={c.pages.models.title} subtitle={c.pages.models.subtitle} />
      <StatStrip
        items={[
          { label: c.stats.models, value: String(models.length), icon: Users, tone: "gold" },
          { label: c.stats.ready, value: String(ready), icon: Sparkles, tone: "emerald" },
          { label: c.stats.inTour, value: String(inTour), icon: MapPin },
          { label: c.stats.pending, value: money(totals.map((t) => ({ currency: t.currency, v: t.pending })), lang), icon: BadgeDollarSign, tone: "amber" },
        ]}
      />
      <MsgLine msg={msg} />
      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /></p>
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-3">
            <p className="flex items-center gap-2 text-[12px] text-zinc-500"><ShieldCheck className="size-3.5 text-amber-200/60" />{c.privacy}</p>
            {models.length === 0 ? (
              <Panel className="p-6 text-sm leading-relaxed text-zinc-400">{c.emptyModels}</Panel>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {models.map((m) => (
                  <ScoutModelCard key={m.id} m={m} tz={tz} onResult={(text, tone) => setMsg({ text, tone })} />
                ))}
              </ul>
            )}
          </section>
          <aside className="space-y-4">
            <ScoutLinksPanel onError={(text) => setMsg({ tone: "rose", text })} />
            {(data?.claims.length ?? 0) > 0 && (
              <Panel className="p-5">
                <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{c.claims.title}</p>
                <ul className="space-y-2 text-[13px]">
                  {data!.claims.map((cl) => (
                    <li key={cl.id} className="flex items-center justify-between gap-2">
                      <span className="text-zinc-200">{cl.name}</span>
                      <Chip className={cl.status === "pending" ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : cl.status === "approved" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-zinc-700 text-zinc-400"}>
                        {c.claims.status[cl.status] ?? cl.status}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
}

export function ScoutModelCard({ m, tz, onResult, footer }: { m: CabinetModel; tz: string; onResult: (text: string, tone: "emerald" | "amber" | "rose") => void; footer?: React.ReactNode }) {
  const { lang } = useCabinet();
  return (
    <Panel as="article" className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={m.name} url={m.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[15px] font-medium text-zinc-50">{m.name}</p>
            <KycLevelBadge level={m.kycLevel} lang={lang} tone="own" withName={false} />
          </div>
          {m.assignedAt && <p className="mt-0.5 text-[11px] text-zinc-500">{fmtDay(m.assignedAt, tz, lang)}</p>}
        </div>
      </div>
      {m.readiness && <ModelFunnel r={m.readiness} hasTour={m.tours.length > 0} tz={tz} />}
      {m.tours.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-zinc-800/70 pt-3 text-[12px]">
          {m.tours.slice(0, 3).map((t, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-zinc-300">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3 text-amber-200/60" />{t.city}</span>
              <span className="text-zinc-500">{tourRange(t.departsAt, t.returnsAt, tz, lang)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {m.readiness && <FunnelNudge modelId={m.id} r={m.readiness} lastNudgeAt={m.lastNudgeAt} onResult={onResult} />}
        {footer}
      </div>
    </Panel>
  );
}

/* ── ссылки VYM ────────────────────────────────────────────────────── */

export function ScoutLinksPanel({ onError }: { onError: (text: string) => void }) {
  const { c, lang } = useCabinet();
  const tz = viewerTimezone(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [form, setForm] = useState({ note: "", days: 60, maxUses: 25 });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("scout_invites").select("id,code,note,status,uses,max_uses,expires_at").order("created_at", { ascending: false }).limit(30);
    setInvites((data ?? []).map((r) => ({ id: r.id, code: r.code, note: r.note, status: r.status, uses: r.uses, maxUses: r.max_uses, expiresAt: r.expires_at })));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy("new");
    const r = await issueScoutInvite(form);
    setBusy(null);
    if (!r.ok) onError(cabinetError(c, r.code));
    else setForm({ note: "", days: 60, maxUses: 25 });
    await load();
  };
  const revoke = async (id: string) => {
    setBusy(id);
    const r = await revokeScoutInvite(id);
    setBusy(null);
    if (!r.ok) onError(cabinetError(c, r.code));
    await load();
  };

  return (
    <Panel className="space-y-3 p-5">
      <SectionHeader eyebrow={c.eyebrow} title={c.links.title} icon={Link2} />
      <p className="text-[12px] leading-relaxed text-zinc-500">{c.links.hint}</p>
      <Field label={c.links.note}>
        <input className={INPUT} maxLength={120} value={form.note} onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={c.links.days}>
          <input className={INPUT} type="number" min={1} max={180} value={form.days} onChange={(e) => setForm((v) => ({ ...v, days: Number(e.target.value) }))} />
        </Field>
        <Field label={c.links.maxUses}>
          <input className={INPUT} type="number" min={1} max={200} value={form.maxUses} onChange={(e) => setForm((v) => ({ ...v, maxUses: Number(e.target.value) }))} />
        </Field>
      </div>
      <button type="button" className={`${BTN_GOLD} w-full`} disabled={busy === "new"} onClick={create}>
        {busy === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {c.links.create}
      </button>
      {invites.length === 0 ? (
        <p className="text-[12px] text-zinc-500">{c.links.empty}</p>
      ) : (
        <ul className="space-y-2 border-t border-zinc-800/70 pt-3">
          {invites.map((i) => {
            const expired = Date.parse(i.expiresAt) <= Date.now();
            const active = i.status === "active" && !expired && i.uses < i.maxUses;
            const link = botLink(i.code);
            return (
              <li key={i.id} className={active ? "" : "opacity-55"}>
                <p className="font-mono text-[13px] tracking-wider text-amber-100">{i.code}</p>
                <p className="text-[11px] text-zinc-500">
                  {i.note ? `${i.note} · ` : ""}{c.links.uses(i.uses, i.maxUses)} · {i.status === "revoked" ? c.links.status.revoked : expired ? c.links.status.expired : c.links.until(fmtDay(i.expiresAt, tz, lang))}
                </p>
                {active && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <CopyButton text={link ?? `/start mod_${i.code}`} label={c.links.copy} copied={c.links.copied} />
                    <button type="button" className={BTN_GHOST} disabled={busy === i.id} onClick={() => revoke(i.id)}>{c.links.revoke}</button>
                  </div>
                )}
                {active && !link && <p className="mt-1 text-[11px] text-zinc-500">{c.links.noBot}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * /scout/castings — анонимная витрина
 * ══════════════════════════════════════════════════════════════════ */

const FIT_TONE: Record<ShowcaseFit, string> = {
  responded: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  ready: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  photo: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  kyc: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  open_to_tours: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
};

export function ScoutCastingShowcase() {
  const { c, lang } = useCabinet();
  const tz = viewerTimezone(null);
  const [list, setList] = useState<ShowcaseCasting[] | null>(null);
  const [nudges, setNudges] = useState<Record<string, string | null>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const projects = useMemo(() => projectLabels(lang), [lang]);
  const country = useMemo(() => {
    try {
      return new Intl.DisplayNames([lang.toLowerCase()], { type: "region" });
    } catch {
      return null;
    }
  }, [lang]);

  useEffect(() => {
    void Promise.all([supabase.rpc("voyage_scout_casting_showcase"), supabase.rpc("voyage_my_scouted_models")]).then(([s, m]) => {
      if (s.error) setMsg({ tone: "rose", text: cabinetError(c, errorCode(s.error.message)) });
      setList(s.error ? [] : parseShowcase(s.data));
      if (!m.error) setNudges(Object.fromEntries(parseCabinetModels(m.data).models.map((x) => [x.id, x.lastNudgeAt])));
    });
  }, [c]);

  return (
    <PageShell>
      <PageHeader eyebrow={c.eyebrow} title={c.pages.castings.title} subtitle={c.pages.castings.subtitle} />
      <p className="mt-6 flex items-center gap-2 text-[12px] text-zinc-500"><ShieldCheck className="size-3.5 text-amber-200/60" />{c.showcase.privacy}</p>
      <MsgLine msg={msg} />
      {list === null ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /></p>
      ) : list.length === 0 ? (
        <Panel className="mt-6 p-6 text-sm text-zinc-400">{c.showcase.empty}</Panel>
      ) : (
        <ul className="mt-6 grid gap-3 lg:grid-cols-2">
          {list.map((k) => (
            <Panel as="article" key={k.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-medium text-zinc-50">
                    <MapPin className="size-4 text-amber-200/70" />{k.city}
                    {k.countryCode && <span className="text-[12px] font-normal text-zinc-500">{country?.of(k.countryCode) ?? k.countryCode}</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-400">
                    <span>{projects[(k.project === "event" ? "event" : "tour")]}</span>
                    {k.startsOn && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{fmtDay(k.startsOn, "UTC", lang)}{k.endsOn ? ` — ${fmtDay(k.endsOn, "UTC", lang)}` : ""}</span>}
                    <span className="text-zinc-500">{c.showcase.closes(fmtDay(k.closesAt, tz, lang))}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <KycLevelBadge level={k.minKycLevel} lang={lang} withName={false} />
                  {k.fresh && <Chip className="border-amber-300/40 bg-amber-300/10 text-amber-100">{c.showcase.fresh}</Chip>}
                </div>
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{c.showcase.models}</p>
              <ul className="mt-2 space-y-2">
                {k.models.map((m) => {
                  const kind = m.fit === "ready" ? "casting" : m.fit === "photo" ? "photo" : m.fit === "kyc" ? "kyc" : m.fit === "open_to_tours" ? "open_to_tours" : null;
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={m.name} url={m.avatarUrl} size="sm" />
                        <span className="truncate text-[13px] text-zinc-200">{m.name}</span>
                        <Chip className={FIT_TONE[m.fit]}>{m.fit === "kyc" ? c.showcase.fitKyc(k.minKycLevel) : c.showcase.fit[m.fit]}</Chip>
                      </span>
                      {kind && (
                        <NudgeButton
                          compact
                          modelId={m.id}
                          kind={kind}
                          castingId={kind === "casting" ? k.id : undefined}
                          lastNudgeAt={nudges[m.id] ?? null}
                          onResult={(text, tone) => setMsg({ text, tone })}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * /scout/earnings — леджер (и вкладка «Скаут-бонусы» у менеджера)
 * ══════════════════════════════════════════════════════════════════ */

export function ScoutEarnings({ embedded = false }: { embedded?: boolean }) {
  const { c, lang } = useCabinet();
  const tz = viewerTimezone(null);
  const [ledger, setLedger] = useState<ScoutLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LedgerStatus | "all">("all");

  useEffect(() => {
    void supabase.rpc("voyage_my_scout_ledger").then(({ data, error: e }) => {
      if (e) setError(cabinetError(c, errorCode(e.message)));
      setLedger(e ? null : parseLedger(data));
    });
  }, [c]);

  const rows = (ledger?.rows ?? []).filter((r) => filter === "all" || r.status === filter);
  const terms = ledger?.terms;
  const body = (
    <>
      {!embedded && (
        <StatStrip
          items={[
            { label: c.stats.pending, value: money((ledger?.totals ?? []).map((t) => ({ currency: t.currency, v: t.pending })), lang), icon: BadgeDollarSign, tone: "amber" },
            { label: c.stats.paid, value: money((ledger?.totals ?? []).map((t) => ({ currency: t.currency, v: t.paid })), lang), icon: Wallet, tone: "emerald" },
            { label: c.profile.rate, value: terms ? `${terms.percent}%` : "—", icon: Gem, tone: "gold", hint: terms ? c.earnings.base[terms.base === "agency" ? "agency" : "total"] : undefined },
            { label: c.earnings.payoutsTitle, value: String(ledger?.payouts.length ?? 0), icon: Sparkles },
          ]}
        />
      )}
      {error && <div className="mt-4"><Notice tone="rose">{error}</Notice></div>}
      {terms && (
        <div className="mt-6 space-y-1 text-[13px] leading-relaxed text-zinc-400">
          <p>{c.earnings.terms(`${terms.percent}%`, c.earnings.base[terms.base === "agency" ? "agency" : "total"], terms.personal)} {terms.windowMonths > 0 ? c.earnings.window(terms.windowMonths) : c.earnings.lifelong}</p>
          <p className={ledger?.payoutMasked ? "text-zinc-500" : "text-amber-100/80"}>
            {ledger?.payoutMasked ? c.earnings.detailsOn(`${ledger.payoutMethod ? c.profile.methods[ledger.payoutMethod as PayoutMethod] ?? ledger.payoutMethod : ""} ${ledger.payoutMasked}`) : c.earnings.noDetails}
          </p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "pending", "paid", "void"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${filter === k ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
            {k === "all" ? c.earnings.filterAll : c.earnings.status[k]}
          </button>
        ))}
      </div>
      {!ledger ? (
        !error && <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /></p>
      ) : rows.length === 0 ? (
        <Panel className="mt-4 p-6 text-sm text-zinc-400">{c.earnings.empty}</Panel>
      ) : (
        <Panel className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-[13px]">
            <thead className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <tr className="border-b border-zinc-800/80">
                <th className="px-4 py-3 font-normal">{c.earnings.head.date}</th>
                <th className="px-4 py-3 font-normal">{c.earnings.head.model}</th>
                <th className="px-4 py-3 font-normal">{c.earnings.head.tour}</th>
                <th className="px-4 py-3 text-right font-normal">{c.earnings.head.amount}</th>
                <th className="px-4 py-3 font-normal">{c.earnings.head.status}</th>
                <th className="px-4 py-3 font-normal">{c.earnings.head.payout}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-zinc-900 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{r.firstAt ? fmtDay(r.firstAt, tz, lang) : "—"}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2.5"><Avatar name={r.modelName} url={r.avatarUrl} size="sm" /><span className="text-zinc-100">{r.modelName}</span></span></td>
                  <td className="px-4 py-3 text-zinc-300">{r.city || "—"}<span className="block text-[11px] text-zinc-500">{tourRange(r.departsAt, r.returnsAt, tz, lang)}</span></td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${r.status === "void" ? "text-zinc-500 line-through" : r.amount < 0 ? "text-rose-200" : "text-zinc-100"}`}>
                    {fmtMoney(r.amount, r.currency, lang)}
                    {r.adjustments > 0 && <span className="block text-[10px] text-zinc-500 no-underline">{c.earnings.adjusted}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Chip className={BONUS_TONE[r.status]}>{c.earnings.status[r.status]}</Chip>
                    {r.status === "void" && r.voidReason && <span className="mt-1 block text-[11px] text-zinc-500">{c.earnings.voidReason[r.voidReason] ?? r.voidReason}</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-400">
                    {r.payout ? (
                      <>
                        <span className="font-mono text-zinc-200">{c.earnings.payoutLine(r.payout.ref, r.payout.masked ?? "")}</span>
                        <span className="block text-[11px] text-zinc-500">{fmtDay(r.payout.paidAt, tz, lang)}</span>
                      </>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {(ledger?.payouts.length ?? 0) > 0 && (
        <Panel className="mt-6 p-5">
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{c.earnings.payoutsTitle}</p>
          <ul className="space-y-2 text-[13px]">
            {ledger!.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-300">{fmtDay(p.paidAt, tz, lang)} · <span className="font-mono text-zinc-200">{p.ref}</span>{p.masked ? <span className="text-zinc-500"> · {p.masked}</span> : null}</span>
                <span className="tabular-nums text-emerald-100">{fmtMoney(p.amount, p.currency, lang)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
  if (embedded) return <section className="mt-6">{body}</section>;
  return (
    <PageShell>
      <PageHeader eyebrow={c.eyebrow} title={c.pages.earnings.title} subtitle={c.pages.earnings.subtitle} />
      {body}
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * /scout/profile — контакт, ставка, реквизиты
 * ══════════════════════════════════════════════════════════════════ */

export function ScoutProfileView() {
  const { c, lang } = useCabinet();
  const tz = viewerTimezone(null);
  const [home, setHome] = useState<ScoutHome | null>(null);
  const [form, setForm] = useState<{ method: PayoutMethod; details: string; holder: string }>({ method: "usdt_trc20", details: "", holder: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("voyage_scout_home");
    if (error) return setMsg({ tone: "rose", text: cabinetError(c, errorCode(error.message)) });
    const h = parseScoutHome(data);
    setHome(h);
    if (h?.payout.method) setForm({ method: h.payout.method, details: h.payout.details ?? "", holder: h.payout.holder ?? "" });
  }, [c]);
  useEffect(() => {
    void load();
  }, [load]);

  const check = payoutFormatOk(form.method, form.details);
  const save = async () => {
    if (check !== "ok") {
      setMsg({ tone: "rose", text: cabinetError(c, check === "wallet" ? "payout_wallet_invalid" : check === "card" ? "payout_card_forbidden" : "payout_details_invalid") });
      return;
    }
    setSaving(true);
    const r = await setMyPayoutDetails(form);
    setSaving(false);
    if (!r.ok) return setMsg({ tone: "rose", text: cabinetError(c, r.code) });
    setMsg({ tone: "emerald", text: c.profile.saved(r.data?.masked ?? "") });
    await load();
  };

  const rows: [string, string][] = home
    ? [
        [c.profile.name, home.displayName],
        [c.profile.telegram, home.telegramUsername ? `@${home.telegramUsername}` : home.hasTelegram ? "✓" : "—"],
        [c.profile.phone, home.phone ?? "—"],
        [c.profile.since, home.since ? fmtDay(home.since, tz, lang) : "—"],
        [c.profile.referredBy, home.referredBy ?? "—"],
        [c.profile.rate, c.profile.rateValue(`${home.terms.percent}% ${c.earnings.base[home.terms.base === "agency" ? "agency" : "total"]}`, home.terms.personal)],
      ]
    : [];

  return (
    <PageShell>
      <PageHeader eyebrow={c.eyebrow} title={c.pages.profile.title} subtitle={c.pages.profile.subtitle} />
      <MsgLine msg={msg} />
      <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
        <Panel className="p-5">
          {!home ? (
            <Loader2 className="size-4 animate-spin text-zinc-500" />
          ) : (
            <dl className="space-y-3 text-[13px]">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{k}</dt>
                  <dd className="text-zinc-100">{v}</dd>
                </div>
              ))}
              {!home.hasTelegram && <Notice tone="amber">{c.profile.noTelegram}</Notice>}
            </dl>
          )}
        </Panel>
        <Panel className="space-y-3 p-5">
          <SectionHeader eyebrow={c.eyebrow} title={c.profile.payoutTitle} icon={Wallet} />
          <p className="text-[12px] leading-relaxed text-zinc-500">{c.profile.payoutHint}</p>
          <Field label={c.profile.method}>
            <select className={INPUT} value={form.method} onChange={(e) => setForm((v) => ({ ...v, method: e.target.value as PayoutMethod }))}>
              {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{c.profile.methods[m]}</option>)}
            </select>
          </Field>
          <Field label={c.profile.details} hint={c.profile.detailsHint[form.method]}>
            <input className={`${INPUT} font-mono`} maxLength={300} value={form.details} autoComplete="off" spellCheck={false} onChange={(e) => setForm((v) => ({ ...v, details: e.target.value }))} />
          </Field>
          <Field label={c.profile.holder}>
            <input className={INPUT} maxLength={120} value={form.holder} onChange={(e) => setForm((v) => ({ ...v, holder: e.target.value }))} />
          </Field>
          {home?.payout.updatedAt && <p className="text-[11px] text-zinc-500">{c.profile.updatedAt(fmtDay(home.payout.updatedAt, tz, lang))}</p>}
          <button type="button" className={`${BTN_GOLD} w-full`} disabled={saving || !form.details.trim()} onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} {c.profile.save}
          </button>
          <p className="text-[11px] leading-relaxed text-zinc-500">{c.profile.security}</p>
        </Panel>
      </div>
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Менеджер / owner: ссылки VYS для новых скаутов
 * ══════════════════════════════════════════════════════════════════ */

type Recruit = { id: string; code: string; note: string | null; status: string; uses: number; maxUses: number; expiresAt: string };

function recruitLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=sc_${code}` : null;
}

export function ScoutRecruitPanel({ isOwner = false }: { isOwner?: boolean }) {
  const { c, lang } = useCabinet();
  const tz = viewerTimezone(null);
  const [list, setList] = useState<Recruit[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("scout_recruit_invites").select("id,code,note,status,uses,max_uses,expires_at").order("created_at", { ascending: false }).limit(20);
    setList((data ?? []).map((r) => ({ id: r.id, code: r.code, note: r.note, status: r.status, uses: r.uses, maxUses: r.max_uses, expiresAt: r.expires_at })));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy("new");
    setError(null);
    const { issueScoutRecruitInvite } = await import("@/app/actions/scouting");
    const r = await issueScoutRecruitInvite({ note, days: 30, maxUses: 3 });
    setBusy(null);
    if (!r.ok) setError(cabinetError(c, r.code));
    else setNote("");
    await load();
  };
  const revoke = async (id: string) => {
    setBusy(id);
    const { revokeScoutRecruitInvite } = await import("@/app/actions/scouting");
    await revokeScoutRecruitInvite(id);
    setBusy(null);
    await load();
  };

  return (
    <Panel className="space-y-3 p-5">
      <SectionHeader eyebrow="VYS" title={c.recruit.title} icon={Gem} />
      <p className="text-[12px] leading-relaxed text-zinc-500">{c.recruit.hint}</p>
      {isOwner && <p className="text-[12px] text-amber-100/80">{c.recruit.ownerAuto}</p>}
      <Field label={c.links.note}>
        <input className={INPUT} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button type="button" className={`${BTN_GOLD} w-full`} disabled={busy === "new"} onClick={create}>
        {busy === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {c.recruit.create}
      </button>
      {error && <Notice tone="rose">{error}</Notice>}
      {list.length === 0 ? (
        <p className="text-[12px] text-zinc-500">{c.recruit.empty}</p>
      ) : (
        <ul className="space-y-2 border-t border-zinc-800/70 pt-3">
          {list.map((i) => {
            const expired = Date.parse(i.expiresAt) <= Date.now();
            const active = i.status === "active" && !expired && i.uses < i.maxUses;
            const link = recruitLink(i.code);
            return (
              <li key={i.id} className={active ? "" : "opacity-55"}>
                <p className="font-mono text-[13px] tracking-wider text-amber-100">{i.code}</p>
                <p className="text-[11px] text-zinc-500">
                  {i.note ? `${i.note} · ` : ""}{c.recruit.uses(i.uses, i.maxUses)} · {i.status === "revoked" ? c.links.status.revoked : expired ? c.links.status.expired : c.links.until(fmtDay(i.expiresAt, tz, lang))}
                </p>
                {active && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <CopyButton text={link ?? `/scout ${i.code}`} label={c.links.copy} copied={c.links.copied} />
                    <button type="button" className={BTN_GHOST} disabled={busy === i.id} onClick={() => revoke(i.id)}>{c.links.revoke}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
