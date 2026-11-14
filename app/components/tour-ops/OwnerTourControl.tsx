"use client";

/* ──────────────────────────────────────────────────────────────────────
 * /admin/tour-control — «Контроль туров и букингов» (только owner)
 *   сводка за период: активные туры, модели, операторы, заказы, оборот;
 *   по направлениям и менеджерам; загрузка туров; все операторы.
 * admin сюда не попадает: proxy.ts + rbac (OWNER_ROLES) + RPC is_owner().
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Gauge, Headset, Loader2, MapPin, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, SectionHeader, StatStrip } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { reassignOperator } from "@/app/actions/operator-team";
import { arr, errorCode, num, obj, str } from "@/lib/tour-ops/types";
import { opsError } from "@/lib/tour-ops/i18n";
import { fmtDateTime, fmtDay, fmtMoney, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, INPUT, Notice, STATUS_TONE, Tabs, useOps } from "@/app/components/tour-ops/ops-ui";

type Period = "month" | "d30" | "d90";

function periodRange(p: Period): { from: string; to: string | null } {
  const now = new Date();
  if (p === "month") return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), to: null };
  const days = p === "d30" ? 30 : 90;
  return { from: new Date(now.getTime() - days * 86400000).toISOString(), to: null };
}

export default function OwnerTourControl() {
  const { t, lang } = useOps();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [operators, setOperators] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = periodRange(period);
    const [ov, ops] = await Promise.all([
      supabase.rpc("voyage_owner_tour_overview", { p_from: r.from, p_to: r.to }),
      supabase.rpc("voyage_owner_operators"),
    ]);
    setLoading(false);
    if (ov.error || ops.error) {
      setError(opsError(t, errorCode((ov.error ?? ops.error)?.message)));
      return;
    }
    setError(null);
    setData(obj(ov.data));
    setOperators(arr(ops.data).map(obj));
  }, [period, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = obj(data?.totals);
  const turnover = arr(data?.turnover_by_currency).map(obj);
  const turnoverText = turnover.length ? turnover.map((x) => fmtMoney(num(x.total), str(x.currency) || "USD", lang)).join(" · ") : "0";

  return (
    <PageShell>
      <PageHeader eyebrow={t.owner.eyebrow} title={t.owner.title} subtitle={t.owner.subtitle} />
      <div className="mt-6">
        <Tabs items={(["month", "d30", "d90"] as const).map((k) => ({ key: k, label: t.owner.period[k] }))} value={period} onChange={setPeriod} />
      </div>
      {error && <div className="mt-4"><Notice tone="rose">{error}</Notice></div>}
      {loading && !data && <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>}

      {data && (
        <>
          <StatStrip
            items={[
              { label: t.owner.toursActive, value: String(num(totals.tours_active)), icon: CalendarClock, tone: "gold" },
              { label: t.owner.models, value: String(num(totals.models)), icon: Users },
              { label: t.owner.operators, value: String(num(totals.operators)), icon: Headset, hint: num(totals.pending_operator_applications) ? `${t.owner.pendingApps}: ${num(totals.pending_operator_applications)}` : undefined },
              { label: t.owner.bookings, value: String(num(totals.bookings)), icon: Gauge, hint: `${t.owner.turnover}: ${turnoverText}` },
            ]}
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Panel className="p-5">
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.owner.byDestination}</p>
              <ul className="space-y-2 text-[13px]">
                {arr(data.by_destination).map(obj).map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-zinc-200"><MapPin className="size-3.5 text-amber-200/60" /> {str(d.city)}</span>
                    <span className="text-zinc-400">{num(d.tours)} · {num(d.bookings)} · <span className="text-zinc-100">{fmtMoney(num(d.turnover), str(d.currency) || "USD", lang)}</span></span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel className="p-5">
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.owner.byManager}</p>
              <ul className="space-y-2 text-[13px]">
                {arr(data.by_manager).map(obj).map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-zinc-200">{str(m.name)}</span>
                    <span className="text-zinc-400">{num(m.tours)} · {num(m.bookings)} · {num(m.operators)} <Headset className="inline size-3" /></span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <section className="mt-10 space-y-3">
            <SectionHeader eyebrow={t.owner.eyebrow} title={t.owner.tours} icon={CalendarClock} count={arr(data.tours).length} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {arr(data.tours).map(obj).map((tour) => {
                const tz = str(tour.timezone) || "UTC";
                const load = Math.round(num(tour.load));
                return (
                  <Link key={str(tour.id)} href={`/admin/tour-control/${str(tour.id)}`} className="group block">
                    <Panel className="h-full p-4 group-hover:border-amber-200/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg text-zinc-50">{str(tour.city)}</p>
                          <p className="text-[12px] text-zinc-500">{fmtDay(str(tour.departs_at), tz, lang)} · {str(tour.manager_name)}</p>
                        </div>
                        <Chip className={STATUS_TONE[str(tour.status) === "in_tour" ? "in_progress" : "scheduled"]}>{t.tourStatus[str(tour.status)] ?? str(tour.status)}</Chip>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={load} aria-valuemin={0} aria-valuemax={100} aria-label={t.owner.load}>
                        <div className="h-full rounded-full bg-amber-200/70" style={{ width: `${Math.min(100, load)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">{t.owner.load}: {load}%</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-zinc-400">
                        <span>{num(tour.models)} {t.list.models}</span>
                        <span>{num(tour.operators)} {t.list.operators}</span>
                        <span>{num(tour.bookings_open)} {t.list.open}</span>
                        <span>{t.owner.tickets}: {num(tour.tickets_ready)}/{num(tour.models)}</span>
                        <span>{t.owner.checkedIn}: {num(tour.checked_in)}/{num(tour.models)}</span>
                        <span className="text-zinc-200">{fmtMoney(num(tour.turnover), str(tour.currency) || "USD", lang)}</span>
                      </div>
                    </Panel>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-10 space-y-3">
            <SectionHeader eyebrow={t.owner.eyebrow} title={t.owner.operatorsTitle} icon={Headset} count={operators.length} />
            <div className="overflow-x-auto rounded-2xl border border-zinc-800">
              <table className="w-full min-w-[40rem] text-left text-[13px]">
                <tbody className="divide-y divide-zinc-800/80">
                  {operators.map((o) => (
                    <tr key={str(o.id)}>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/tour-control/operators/${str(o.id)}`} className="text-zinc-100 hover:text-amber-100">{str(o.display_name)}</Link>
                        <span className="block text-[11px] text-zinc-500">{str(o.telegram_username) ? `@${str(o.telegram_username)}` : ""} {str(o.phone)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">{str(o.manager_name)}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{t.team.tours(num(o.tours))}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{t.owner.bookings30}: {num(o.bookings_30d)} · {t.owner.cancelled30}: {num(o.cancelled_30d)}</td>
                      <td className="px-4 py-2.5"><Chip className={str(o.status) === "active" ? "border-emerald-400/40 text-emerald-200" : "border-rose-400/40 text-rose-200"}>{str(o.status) === "active" ? t.team.active : t.team.suspended}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}

export function OwnerOperatorCard({ operatorId }: { operatorId: string }) {
  const { t, lang } = useOps();
  const tz = viewerTimezone(null);
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<{ tone: "rose" | "emerald"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, mgr] = await Promise.all([
      supabase.rpc("voyage_owner_operator_card", { p_operator: operatorId }),
      supabase.from("profiles").select("id,full_name,name").eq("role", "manager").order("full_name"),
    ]);
    if (error) setMsg({ tone: "rose", text: opsError(t, errorCode(error.message)) });
    else setCard(obj(data));
    setManagers((mgr.data ?? []).map((m) => ({ id: String(m.id), name: String(m.full_name || m.name || m.id) })));
  }, [operatorId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const reassign = async () => {
    if (!target) return;
    const r = await reassignOperator(operatorId, target);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    else {
      setMsg({ tone: "emerald", text: t.settings.saved });
      await load();
    }
  };

  const p = obj(card?.profile);
  return (
    <PageShell>
      <Link href="/admin/tour-control" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-200"><ArrowLeft className="size-3.5" /> {t.common.back}</Link>
      <PageHeader eyebrow={t.owner.operatorCard} title={str(p.display_name) || "—"} subtitle={[str(p.email), str(p.phone), str(p.telegram_username) ? `@${str(p.telegram_username)}` : ""].filter(Boolean).join(" · ")} />
      {msg && <div className="mt-6"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {card && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Panel className="space-y-3 p-5">
            <p className="text-[13px] text-zinc-300">{t.list.manager}: <span className="text-zinc-100">{str(p.manager_name)}</span></p>
            <p className="text-[13px] text-zinc-300">{t.team.timezone}: {str(p.timezone) || "—"}</p>
            <p className="text-[13px] text-zinc-300">{t.owner.reviewsLeft}: {num(card.guest_reviews)}</p>
            {str(p.experience) && <p className="whitespace-pre-line text-[12px] text-zinc-400">{t.team.experience}: {str(p.experience)}</p>}
            <div className="flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3">
              <select className={`${INPUT} w-auto min-w-[12rem]`} value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t.owner.reassign}>
                <option value="">{t.owner.reassign}</option>
                {managers.filter((m) => m.id !== str(p.manager_id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button type="button" className={BTN_GOLD} disabled={!target} onClick={reassign}>{t.common.save}</button>
            </div>
            <ul className="space-y-1 border-t border-zinc-800/80 pt-3 text-[13px]">
              {arr(card.tours).map(obj).map((tour) => (
                <li key={str(tour.id)}><Link className="text-zinc-200 hover:text-amber-100" href={`/admin/tour-control/${str(tour.id)}`}>{str(tour.city)}</Link> <span className="text-zinc-500">· {t.tourStatus[str(tour.status)] ?? str(tour.status)}</span></li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-5">
            <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.owner.events}</p>
            <ul className="space-y-1.5 text-[12px] text-zinc-400">
              {arr(card.events).map(obj).map((e, i) => (
                <li key={i}>
                  {fmtDateTime(str(e.created_at), tz, lang)} · {str(e.kind)}
                  {str(e.from_status) ? ` ${t.status[str(e.from_status) as keyof typeof t.status] ?? str(e.from_status)} →` : ""}
                  {str(e.to_status) ? ` ${t.status[str(e.to_status) as keyof typeof t.status] ?? str(e.to_status)}` : ""}
                  {str(e.reason) ? ` (${str(e.reason)})` : ""}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
      <Link href="/admin/tour-control" className={`${BTN_GHOST} mt-8`}>{t.common.back}</Link>
    </PageShell>
  );
}
