"use client";

/* ──────────────────────────────────────────────────────────────────────
 * /admin/tour-control/scouts — «Скауты и бонусы» (только owner)
 *   ставка платформы (scout_bonus_percent, база, окно, льготный срок);
 *   к выплате: строки леджера → «Отметить выплату» с номером платёжки;
 *   заявки на закрепление уже работающих моделей;
 *   менеджеры-скауты; ручное закрепление / снятие (с причиной);
 *   журнал закреплений (append-only).
 * admin сюда не попадает: proxy.ts + rbac + RoleGuard + RPC (voyage_ops_role() = 'owner').
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, History, Loader2, Percent, Search, UserCog, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, SectionHeader, StatStrip } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { ownerDecideScoutClaim, ownerMarkScoutPaid, ownerSetFinanceSettings, ownerSetScout, ownerVoidScoutBonus } from "@/app/actions/scouting";
import { errorCode } from "@/lib/tour-ops/types";
import { fmtDateTime, fmtDay, fmtMoney, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, Field, INPUT, Notice } from "@/app/components/tour-ops/ops-ui";
import KycLevelBadge from "@/app/components/profile/KycLevelBadge";
import { scoutError } from "@/lib/scouting/i18n";
import { parseFoundModels, parseOwnerOverview, sumMoney, type FinanceSettings, type OwnerFoundModel, type OwnerScoutOverview } from "@/lib/scouting/types";
import { useScout } from "@/app/components/scouting/scout-ui";
import OwnerScoutRoster from "@/app/components/scouting/OwnerScoutRoster";

type Msg = { tone: "rose" | "emerald" | "amber"; text: string } | null;

export default function OwnerScoutControl() {
  const { s, lang } = useScout();
  const o = s.owner;
  const tz = viewerTimezone(null);
  const [data, setData] = useState<OwnerScoutOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [payRef, setPayRef] = useState("");

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc("voyage_owner_scout_overview");
    setLoading(false);
    if (error) return setMsg({ tone: "rose", text: scoutError(s, errorCode(error.message)) });
    const parsed = parseOwnerOverview(d);
    setData(parsed);
    setSettings(parsed.settings);
    setPicked((p) => new Set([...p].filter((id) => parsed.pendingRows.some((r) => r.id === id))));
  }, [s]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; code?: string }>, okText?: string) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: scoutError(s, "code" in r && r.code ? r.code : "failed") });
    else if (okText) setMsg({ tone: "emerald", text: okText });
    await load();
    return r.ok;
  };

  const pickedSum = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of data?.pendingRows ?? []) if (picked.has(r.id)) acc[r.currency] = (acc[r.currency] ?? 0) + r.amount;
    return sumMoney(acc);
  }, [data, picked]);

  const money = (m: Record<string, number>) => sumMoney(m).map((x) => fmtMoney(x.amount, x.currency, lang)).join(" · ") || "—";
  const totalsPending = (data?.totals ?? []).map((x) => fmtMoney(x.pending, x.currency, lang)).join(" · ") || "0";
  const totalsPaid = (data?.totals ?? []).map((x) => fmtMoney(x.paid, x.currency, lang)).join(" · ") || "0";

  const toggleScoutRows = (scoutId: string) => {
    const ids = (data?.pendingRows ?? []).filter((r) => r.scoutId === scoutId).map((r) => r.id);
    setPicked((p) => {
      const all = ids.every((id) => p.has(id));
      const n = new Set(p);
      ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
      return n;
    });
  };

  return (
    <PageShell>
      <Link href="/admin/tour-control" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-200"><ArrowLeft className="size-3.5" /> {o.back}</Link>
      <div className="mt-2">
        <PageHeader eyebrow={o.eyebrow} title={o.title} subtitle={o.subtitle} />
      </div>
      {msg && <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {loading && <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /></p>}

      {data && settings && (
        <>
          <StatStrip
            items={[
              { label: o.totalsPending, value: totalsPending, icon: BadgeDollarSign, tone: "amber" },
              { label: o.totalsPaid, value: totalsPaid, icon: BadgeDollarSign, tone: "emerald" },
              { label: o.scouts, value: String(data.scouts.filter((x) => x.models > 0).length), icon: UserCog, tone: "gold" },
              { label: o.models, value: String(data.scouts.reduce((a, x) => a + x.models, 0)), icon: Users, hint: data.claims.length ? `${o.claims}: ${data.claims.length}` : undefined },
            ]}
          />

          {/* ── скауты: заявки, ставки, реквизиты, статусы ── */}
          <OwnerScoutRoster onChanged={load} />

          {/* ── к выплате ── */}
          <section className="mt-10 space-y-3">
            <SectionHeader eyebrow={o.eyebrow} title={o.payouts} icon={BadgeDollarSign} count={data.pendingRows.length} />
            <p className="max-w-3xl text-[13px] leading-relaxed text-zinc-400">{o.payoutsHint}</p>
            {data.pendingRows.length === 0 ? (
              <Panel className="p-5 text-sm text-zinc-500">{o.noPayouts}</Panel>
            ) : (
              <Panel className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-[13px]">
                  <thead className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    <tr className="border-b border-zinc-800/80">
                      <th className="w-10 px-4 py-3" />
                      <th className="px-3 py-3 font-normal">{o.scout}</th>
                      <th className="px-3 py-3 font-normal">{s.bonuses.model}</th>
                      <th className="px-3 py-3 font-normal">{s.bonuses.where}</th>
                      <th className="px-3 py-3 font-normal">{o.host}</th>
                      <th className="px-3 py-3 text-right font-normal">{s.bonuses.amount}</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingRows.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-900 last:border-0">
                        <td className="px-4 py-3">
                          <input type="checkbox" className="size-4 accent-amber-200" checked={picked.has(r.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} aria-label={r.modelName} />
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" className="text-zinc-100 hover:text-amber-100" onClick={() => toggleScoutRows(r.scoutId)}>{r.scoutName}</button>
                        </td>
                        <td className="px-3 py-3 text-zinc-200">{r.modelName}</td>
                        <td className="px-3 py-3 text-zinc-300">
                          {r.tourId ? <Link href={`/admin/tour-control/${r.tourId}`} className="hover:text-amber-100">{r.city || "—"}</Link> : r.city || "—"}
                          <span className="block text-[11px] text-zinc-500">
                            {r.serviceAt ? fmtDay(r.serviceAt, tz, lang) : ""} · {r.tourClosed ? o.readyToPay : o.tourOpen}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-zinc-400">{r.hostName}</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${r.amount < 0 ? "text-rose-200" : "text-zinc-50"}`}>
                          {fmtMoney(r.amount, r.currency, lang)}
                          <span className="block text-[11px] text-zinc-500">{r.kind === "adjustment" ? o.adjustment : o.baseText(r.percent, r.baseKind, fmtMoney(r.baseAmount, r.currency, lang))}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="text-[11px] text-zinc-500 hover:text-rose-200"
                            disabled={busy === r.id}
                            onClick={() => {
                              const reason = window.prompt(o.voidReason) ?? "";
                              if (reason.trim().length >= 3) void run(r.id, () => ownerVoidScoutBonus(r.id, reason));
                            }}
                          >
                            {o.voidRow}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-end gap-3 border-t border-zinc-800/80 p-4">
                  <Field label={o.payRef} className="w-64">
                    <input className={INPUT} value={payRef} maxLength={120} placeholder={o.payRefPh} onChange={(e) => setPayRef(e.target.value)} />
                  </Field>
                  <button
                    type="button"
                    className={BTN_GOLD}
                    disabled={picked.size === 0 || payRef.trim().length < 2 || busy === "pay"}
                    onClick={async () => {
                      const ok = await run("pay", () => ownerMarkScoutPaid([...picked], payRef), o.saved);
                      if (ok) {
                        setPicked(new Set());
                        setPayRef("");
                      }
                    }}
                  >
                    {busy === "pay" && <Loader2 className="size-4 animate-spin" />} {o.pay(picked.size)}
                  </button>
                  {pickedSum.length > 0 && <span className="pb-2 text-[13px] tabular-nums text-zinc-300">{pickedSum.map((x) => fmtMoney(x.amount, x.currency, lang)).join(" · ")}</span>}
                </div>
              </Panel>
            )}
          </section>

          <div className="mt-10 grid gap-6 xl:grid-cols-2">
            {/* ── ставка ── */}
            <Panel className="space-y-4 p-5">
              <SectionHeader eyebrow={o.eyebrow} title={o.settings} icon={Percent} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={o.percent}>
                  <input className={INPUT} type="number" min={0} max={50} step={0.5} value={settings.percent} onChange={(e) => setSettings({ ...settings, percent: Number(e.target.value) })} />
                </Field>
                <Field label={o.base}>
                  <select className={INPUT} value={settings.base} onChange={(e) => setSettings({ ...settings, base: e.target.value === "agency" ? "agency" : "total" })}>
                    <option value="total">{o.baseTotal}</option>
                    <option value="agency">{o.baseAgency}</option>
                  </select>
                </Field>
                <Field label={o.window} hint={o.windowHint}>
                  <input className={INPUT} type="number" min={0} max={120} value={settings.windowMonths} onChange={(e) => setSettings({ ...settings, windowMonths: Number(e.target.value) })} />
                </Field>
                <Field label={o.grace} hint={o.graceHint}>
                  <input className={INPUT} type="number" min={0} max={365} value={settings.graceDays} onChange={(e) => setSettings({ ...settings, graceDays: Number(e.target.value) })} />
                </Field>
              </div>
              <Notice>{o.settingsHint}</Notice>
              <button type="button" className={BTN_GOLD} disabled={busy === "settings"} onClick={() => run("settings", () => ownerSetFinanceSettings(settings), o.saved)}>
                {busy === "settings" && <Loader2 className="size-4 animate-spin" />} {o.save}
              </button>
              {settings.updatedAt && <p className="text-[11px] text-zinc-500">{fmtDateTime(settings.updatedAt, tz, lang)}</p>}
            </Panel>

            {/* ── заявки ── */}
            <Panel className="space-y-3 p-5">
              <SectionHeader eyebrow={o.eyebrow} title={o.claims} icon={Users} count={data.claims.length} />
              {data.claims.length === 0 ? (
                <p className="text-[13px] text-zinc-500">{o.noClaims}</p>
              ) : (
                <ul className="divide-y divide-zinc-900">
                  {data.claims.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-100">
                          {c.modelName} <KycLevelBadge level={c.modelKyc} lang={lang} tone="own" />
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          → {c.managerName} · {s.models.claimReason[c.reason] ?? c.reason} · {o.claimInfo(fmtDay(c.modelCreatedAt, tz, lang), c.toursDone)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className={BTN_GOLD} disabled={busy === c.id} onClick={() => run(c.id, () => ownerDecideScoutClaim(c.id, true))}>{o.approve}</button>
                        <button type="button" className={BTN_GHOST} disabled={busy === c.id} onClick={() => run(c.id, () => ownerDecideScoutClaim(c.id, false))}>{o.reject}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {/* ── скауты ── */}
            <Panel className="p-5">
              <SectionHeader eyebrow={o.eyebrow} title={o.scouts} icon={UserCog} />
              <ul className="mt-3 divide-y divide-zinc-900 text-[13px]">
                {data.scouts.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-zinc-100">{x.name}</span>
                      <span className="block text-[11px] text-zinc-500">{o.models}: {x.models} · {o.activeInvites}: {x.invitesActive}</span>
                    </span>
                    <span className="text-right text-[12px] text-zinc-400">
                      <span className="block">{s.bonusStatus.pending}: <span className="text-amber-100">{money(x.pending)}</span></span>
                      <span className="block">{s.bonusStatus.paid}: {money(x.paid)}</span>
                      {sumMoney(x.withhold).length > 0 && <span className="block text-zinc-500">{o.withhold}: {money(x.withhold)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <AssignPanel managers={data.managers} onDone={load} setMsg={setMsg} />
          </div>

          {/* ── журнал ── */}
          <section className="mt-10 space-y-3">
            <SectionHeader eyebrow={o.eyebrow} title={o.log} icon={History} />
            <Panel className="p-4">
              <ul className="space-y-2 text-[12px]">
                {data.log.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="text-zinc-300">
                      <span className="text-zinc-100">{g.modelName}</span> · {o.logAction[g.action] ?? g.action}
                      {g.fromName && <span className="text-zinc-500"> · {g.fromName}</span>}
                      {g.toName && <span className="text-zinc-400"> → {g.toName}</span>}
                      {g.note && <span className="text-zinc-500"> · «{g.note}»</span>}
                    </span>
                    <span className="text-zinc-500">{fmtDateTime(g.createdAt, tz, lang)}{g.actorName ? ` · ${g.actorName}` : ""}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        </>
      )}
    </PageShell>
  );
}

function AssignPanel({ managers, onDone, setMsg }: { managers: { id: string; name: string }[]; onDone: () => Promise<void>; setMsg: (m: Msg) => void }) {
  const { s, lang } = useScout();
  const o = s.owner;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<OwnerFoundModel[]>([]);
  const [pick, setPick] = useState<OwnerFoundModel | null>(null);
  const [manager, setManager] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("voyage_owner_find_models", { p_query: q.trim() });
      setFound(parseFoundModels(data));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const apply = async (target: string | null) => {
    if (!pick) return;
    setBusy(true);
    const r = await ownerSetScout(pick.id, target, reason);
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "rose", text: scoutError(s, r.code) });
    setMsg({ tone: "emerald", text: o.saved });
    setPick(null);
    setReason("");
    setQ("");
    await onDone();
  };

  return (
    <Panel className="space-y-3 p-5">
      <SectionHeader eyebrow={o.eyebrow} title={o.assign} icon={Search} />
      <p className="text-[12px] leading-relaxed text-zinc-500">{o.assignHint}</p>
      <Field label={o.search}>
        <input className={INPUT} value={q} placeholder={o.searchPh} onChange={(e) => { setQ(e.target.value); setPick(null); }} />
      </Field>
      {!pick && found.length > 0 && (
        <ul className="max-h-56 divide-y divide-zinc-900 overflow-y-auto rounded-xl border border-zinc-800">
          {found.map((m) => (
            <li key={m.id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-zinc-900/60" onClick={() => { setPick(m); setManager(m.scoutId ?? ""); }}>
                <span className="min-w-0 truncate text-zinc-100">{m.name}<span className="text-zinc-500">{m.telegramUsername ? ` · @${m.telegramUsername}` : m.email ? ` · ${m.email}` : ""}</span></span>
                <span className="shrink-0 text-[11px] text-zinc-500">{o.current(m.scoutName)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pick && (
        <div className="space-y-3 rounded-xl border border-zinc-800 p-3">
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-100">
            {pick.name} <KycLevelBadge level={pick.kycLevel} lang={lang} tone="own" />
            <Chip className="border-zinc-700 text-zinc-400">{o.current(pick.scoutName)}</Chip>
            {pick.scoutSince && <span className="text-[11px] text-zinc-500">{fmtDay(pick.scoutSince, viewerTimezone(null), lang)}</span>}
          </p>
          <Field label={o.pickManager}>
            <select className={INPUT} value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">—</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label={o.reason}>
            <input className={INPUT} value={reason} maxLength={300} placeholder={o.reasonPh} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_GOLD} disabled={busy || !manager || manager === pick.scoutId || reason.trim().length < 3} onClick={() => apply(manager)}>{o.apply}</button>
            {pick.scoutId && (
              <button type="button" className={BTN_GHOST} disabled={busy || reason.trim().length < 3} onClick={() => apply(null)}>{o.clear}</button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
