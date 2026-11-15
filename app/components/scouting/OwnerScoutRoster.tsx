"use client";

/* ──────────────────────────────────────────────────────────────────────
 * /admin/tour-control/scouts — блок «Скауты» (только owner)
 *
 *   • заявки скаутов (бот /scout, ссылки VYS менеджеров) → Одобрить / Отклонить;
 *   • все скауты и менеджеры-скауты: роль, статус, модели, персональная
 *     ставка (поверх ставки платформы), реквизиты выплат с предупреждением
 *     «изменены < 72 ч назад», приостановить / вернуть, повысить до менеджера;
 *   • история выплат пачкой (снимок реквизитов + ref/хэш);
 *   • ссылки VYS от owner — кабинет открывается без модерации.
 * admin сюда не попадает (proxy + rbac + RPC voyage_ops_role() = 'owner').
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpCircle, Check, Gem, History, Loader2, PauseCircle, PlayCircle, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, Panel, SectionHeader } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { ownerDecideScoutApplication, ownerPromoteScout, ownerSetScoutRate, ownerSetScoutStatus } from "@/app/actions/scouting";
import { arr, errorCode, num, numOrNull, obj, str, strOrNull } from "@/lib/tour-ops/types";
import { fmtDateTime, fmtMoney, viewerTimezone, type UiLang } from "@/lib/tour-ops/time";
import { Chip, INPUT, Modal, Notice } from "@/app/components/tour-ops/ops-ui";
import { cabinetDict, cabinetError } from "@/lib/scouting/cabinet-i18n";
import type { PayoutMethod } from "@/lib/scouting/cabinet";
import { ScoutRecruitPanel, } from "@/app/components/scouting/ScoutCabinet";
import { useCabinet } from "@/app/components/scouting/ScoutFunnel";

type ScoutRow = {
  id: string; name: string; role: string; scoutStatus: string | null; telegram: string | null; phone: string | null; about: string | null;
  referredBy: string | null; banned: boolean; models: number; modelsReady: number; percentOverride: number | null; percentEffective: number;
  rateNote: string | null; payoutMethod: string | null; payoutDetails: string | null; payoutHolder: string | null; payoutUpdatedAt: string | null;
  pending: Record<string, number>; paid: Record<string, number>;
};
type AppRow = { id: string; name: string; phone: string; about: string | null; telegram: string | null; status: string; referredBy: string | null; createdAt: string };
type PayoutRow = { id: string; scoutName: string; currency: string; amount: number; rows: number; ref: string; method: string | null; details: string | null; holder: string | null; detailsChangedAt: string | null; paidAt: string; paidBy: string };

const RECENT_MS = 72 * 60 * 60 * 1000;
const isRecent = (iso: string | null, at = Date.now()) => !!iso && at - Date.parse(iso) < RECENT_MS;

const T = {
  RU: {
    title: "Скауты", apps: "Заявки скаутов", noApps: "Новых заявок нет.", approve: "Одобрить", reject: "Отклонить",
    approved: (l: string, d: boolean) => (d ? `Кабинет открыт (логин ${l}), доступ отправлен в Telegram.` : `Кабинет открыт (логин ${l}), но Telegram не доставил доступ — скаут может отправить боту /password.`),
    rejected: "Заявка отклонена.", via: (n: string) => `по ссылке: ${n}`, direct: "без ссылки",
    roster: "Скауты и менеджеры-скауты", noScouts: "Скаутов пока нет.",
    role: { scout: "скаут", manager: "менеджер" } as Record<string, string>,
    status: { active: "активен", suspended: "приостановлен", promoted: "стал менеджером" } as Record<string, string>,
    models: (n: number, r: number) => `моделей: ${n} · готовы: ${r}`,
    rate: "Ставка", rateGlobal: "ставка платформы", rateEdit: "Изменить ставку", rateNote: "Комментарий (виден только owner)", rateReset: "Вернуть ставку платформы",
    rateHint: "Персональная ставка действует только на новые начисления: уже начисленное остаётся по старой.", save: "Сохранить",
    payout: "Реквизиты", noPayout: "реквизиты не указаны", recent: "Изменены менее 72 ч назад — сверьте со скаутом лично перед выплатой.",
    suspend: "Приостановить", activate: "Вернуть доступ", promote: "Повысить до менеджера",
    reasonPh: "Причина (обязательно, попадёт в журнал)",
    promoteHint: "Тот же профиль: модели, ссылки VYM и история бонусов остаются. Дальше действует правило «нет бонуса в собственном туре».",
    payouts: "Выплаты", noPayouts: "Выплат ещё не было.", pending: "к выплате", paid: "выплачено", cancel: "Отмена",
  },
  EN: {
    title: "Scouts", apps: "Scout applications", noApps: "No new applications.", approve: "Approve", reject: "Decline",
    approved: (l: string, d: boolean) => (d ? `Desk open (login ${l}), access sent via Telegram.` : `Desk open (login ${l}), but Telegram delivery failed — the scout can send /password to the bot.`),
    rejected: "Application declined.", via: (n: string) => `via link: ${n}`, direct: "no link",
    roster: "Scouts and manager-scouts", noScouts: "No scouts yet.",
    role: { scout: "scout", manager: "manager" } as Record<string, string>,
    status: { active: "active", suspended: "suspended", promoted: "promoted to manager" } as Record<string, string>,
    models: (n: number, r: number) => `models: ${n} · ready: ${r}`,
    rate: "Rate", rateGlobal: "platform rate", rateEdit: "Change rate", rateNote: "Note (owner only)", rateReset: "Back to platform rate",
    rateHint: "A personal rate applies to new accruals only; earlier ones keep their rate.", save: "Save",
    payout: "Payout details", noPayout: "no payout details", recent: "Changed less than 72 h ago — confirm with the scout before paying.",
    suspend: "Suspend", activate: "Restore access", promote: "Promote to manager",
    reasonPh: "Reason (required, goes to the log)",
    promoteHint: "Same profile: models, VYM links and bonus history stay. From then on, the “no bonus in your own tour” rule applies.",
    payouts: "Payouts", noPayouts: "No payouts yet.", pending: "to be paid", paid: "paid", cancel: "Cancel",
  },
};

function parse(v: unknown) {
  const r = obj(v);
  const money = (x: unknown) => Object.fromEntries(Object.entries(obj(x)).map(([k, n]) => [k, num(n)]));
  const scouts: ScoutRow[] = arr(r.scouts).map((x) => {
    const s = obj(x);
    return {
      id: str(s.id), name: str(s.name) || "—", role: str(s.role), scoutStatus: strOrNull(s.scout_status), telegram: strOrNull(s.telegram_username),
      phone: strOrNull(s.phone), about: strOrNull(s.about), referredBy: strOrNull(s.referred_by_name), banned: s.banned === true,
      models: num(s.models), modelsReady: num(s.models_ready), percentOverride: numOrNull(s.percent_override), percentEffective: num(s.percent_effective),
      rateNote: strOrNull(s.rate_note), payoutMethod: strOrNull(s.payout_method), payoutDetails: strOrNull(s.payout_details),
      payoutHolder: strOrNull(s.payout_holder), payoutUpdatedAt: strOrNull(s.payout_updated_at), pending: money(s.pending), paid: money(s.paid),
    };
  });
  const apps: AppRow[] = arr(r.applications).map((x) => {
    const a = obj(x);
    return { id: str(a.id), name: str(a.name) || "—", phone: str(a.phone), about: strOrNull(a.about), telegram: strOrNull(a.telegram_username), status: str(a.status), referredBy: strOrNull(a.referred_by_name), createdAt: str(a.created_at) };
  });
  const payouts: PayoutRow[] = arr(r.payouts).map((x) => {
    const p = obj(x);
    return {
      id: str(p.id), scoutName: str(p.scout_name) || "—", currency: str(p.currency) || "USD", amount: num(p.amount), rows: num(p.rows), ref: str(p.ref),
      method: strOrNull(p.method), details: strOrNull(p.details), holder: strOrNull(p.holder), detailsChangedAt: strOrNull(p.details_changed_at),
      paidAt: str(p.paid_at), paidBy: str(p.paid_by_name),
    };
  });
  return { scouts, apps, payouts };
}

type Dialog = { kind: "rate" | "suspend" | "activate" | "promote"; scout: ScoutRow } | null;

export default function OwnerScoutRoster({ onChanged }: { onChanged?: () => void | Promise<void> } = {}) {
  const { c, lang } = useCabinet();
  const t = lang === "RU" ? T.RU : T.EN;
  const tz = viewerTimezone(null);
  const [data, setData] = useState<ReturnType<typeof parse> | null>(null);
  const [msg, setMsg] = useState<{ tone: "rose" | "emerald" | "amber" | "zinc"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc("voyage_owner_scout_overview");
    if (error) return setMsg({ tone: "rose", text: cabinetError(c, errorCode(error.message)) });
    setData(parse(d));
  }, [c]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const r = await ownerDecideScoutApplication(id, approve);
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: cabinetError(c, r.code) });
    else setMsg({ tone: approve ? (r.data?.delivered ? "emerald" : "amber") : "zinc", text: approve ? t.approved(r.data?.login ?? "—", r.data?.delivered === true) : t.rejected });
    await load();
  };

  const openDialog = (kind: NonNullable<Dialog>["kind"], scout: ScoutRow) => {
    setDialog({ kind, scout });
    setRate(scout.percentOverride !== null ? String(scout.percentOverride) : "");
    setNote(kind === "rate" ? scout.rateNote ?? "" : "");
  };

  const submit = async (resetRate = false) => {
    if (!dialog) return;
    setBusy("dialog");
    const id = dialog.scout.id;
    const r =
      dialog.kind === "rate" ? await ownerSetScoutRate(id, resetRate || rate.trim() === "" ? null : Number(rate.replace(",", ".")), note)
      : dialog.kind === "promote" ? await ownerPromoteScout(id, note)
      : await ownerSetScoutStatus(id, dialog.kind === "suspend" ? "suspended" : "active", note);
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "rose", text: cabinetError(c, r.code) });
    setDialog(null);
    setMsg({ tone: "emerald", text: "✓" });
    await load();
    await onChanged?.();
  };

  const moneyText = (m: Record<string, number>, l: UiLang) => Object.entries(m).filter(([, v]) => v).map(([cur, v]) => fmtMoney(v, cur, l)).join(" · ") || "0";
  const now = Date.now();

  return (
    <section className="mt-10 space-y-6">
      <SectionHeader eyebrow="Owner" title={t.title} icon={Gem} count={data?.apps.length} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!data ? (
        <Loader2 className="size-4 animate-spin text-zinc-500" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {/* ── заявки ── */}
            <Panel className="p-5">
              <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500"><UserPlus className="size-3.5 text-amber-200/60" />{t.apps}</p>
              {data.apps.length === 0 ? (
                <p className="text-[13px] text-zinc-500">{t.noApps}</p>
              ) : (
                <ul className="space-y-3">
                  {data.apps.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-900 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0 text-[13px]">
                        <p className="font-medium text-zinc-100">{a.name} {a.telegram && <span className="font-normal text-zinc-500">@{a.telegram}</span>}</p>
                        <p className="text-[12px] text-zinc-400">{a.phone} · {a.referredBy ? t.via(a.referredBy) : t.direct} · {fmtDateTime(a.createdAt, tz, lang)}</p>
                        {a.about && <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-zinc-500">{a.about}</p>}
                      </div>
                      {a.status === "pending" ? (
                        <div className="flex gap-2">
                          <button type="button" className={BTN_GOLD} disabled={busy === a.id} onClick={() => decide(a.id, true)}>{busy === a.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t.approve}</button>
                          <button type="button" className={BTN_GHOST} disabled={busy === a.id} onClick={() => decide(a.id, false)}><X className="size-4" /> {t.reject}</button>
                        </div>
                      ) : (
                        <Loader2 className="size-4 animate-spin text-zinc-500" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* ── скауты ── */}
            <Panel className="overflow-x-auto">
              <p className="px-5 pt-5 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.roster}</p>
              {data.scouts.length === 0 ? (
                <p className="p-5 text-[13px] text-zinc-500">{t.noScouts}</p>
              ) : (
                <ul className="divide-y divide-zinc-900">
                  {data.scouts.map((s) => {
                    const recent = isRecent(s.payoutUpdatedAt, now);
                    return (
                      <li key={s.id} className="space-y-2 px-5 py-4 text-[13px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-zinc-100">
                            {s.name} {s.telegram && <span className="font-normal text-zinc-500">@{s.telegram}</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Chip className={s.role === "scout" ? "border-fuchsia-400/30 text-fuchsia-200/80" : "border-sky-400/30 text-sky-200/80"}>{t.role[s.role] ?? s.role}</Chip>
                            {s.scoutStatus && <Chip className={s.scoutStatus === "active" ? "border-emerald-400/30 text-emerald-200/80" : "border-zinc-700 text-zinc-400"}>{t.status[s.scoutStatus] ?? s.scoutStatus}</Chip>}
                          </div>
                        </div>
                        <p className="text-[12px] text-zinc-400">
                          {t.models(s.models, s.modelsReady)} · {t.pending}: {moneyText(s.pending, lang)} · {t.paid}: {moneyText(s.paid, lang)}
                          {s.referredBy ? ` · ${t.via(s.referredBy)}` : ""}
                        </p>
                        <p className="text-[12px] text-zinc-300">
                          {t.rate}: <b className="text-amber-100">{s.percentEffective}%</b> {s.percentOverride === null ? <span className="text-zinc-500">({t.rateGlobal})</span> : s.rateNote ? <span className="text-zinc-500">· {s.rateNote}</span> : null}
                        </p>
                        <p className="text-[12px] text-zinc-300">
                          {t.payout}:{" "}
                          {s.payoutDetails ? (
                            <span className="font-mono text-zinc-100">{c.profile.methods[s.payoutMethod as PayoutMethod] ?? s.payoutMethod} · {s.payoutDetails}{s.payoutHolder ? ` · ${s.payoutHolder}` : ""}</span>
                          ) : <span className="text-zinc-500">{t.noPayout}</span>}
                        </p>
                        {recent && s.payoutDetails && (
                          <p className="flex items-center gap-1.5 text-[12px] text-amber-200"><AlertTriangle className="size-3.5" />{t.recent} ({fmtDateTime(s.payoutUpdatedAt!, tz, lang)})</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button type="button" className={BTN_GHOST} onClick={() => openDialog("rate", s)}>{t.rateEdit}</button>
                          {s.role === "scout" && s.scoutStatus === "active" && <button type="button" className={BTN_GHOST} onClick={() => openDialog("suspend", s)}><PauseCircle className="size-3.5" /> {t.suspend}</button>}
                          {s.role === "scout" && s.scoutStatus === "suspended" && <button type="button" className={BTN_GHOST} onClick={() => openDialog("activate", s)}><PlayCircle className="size-3.5" /> {t.activate}</button>}
                          {s.role === "scout" && s.scoutStatus === "active" && <button type="button" className={BTN_GHOST} onClick={() => openDialog("promote", s)}><ArrowUpCircle className="size-3.5" /> {t.promote}</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {/* ── выплаты ── */}
            <Panel className="overflow-x-auto p-5">
              <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500"><History className="size-3.5 text-amber-200/60" />{t.payouts}</p>
              {data.payouts.length === 0 ? (
                <p className="text-[13px] text-zinc-500">{t.noPayouts}</p>
              ) : (
                <table className="w-full min-w-[40rem] text-left text-[12px]">
                  <tbody>
                    {data.payouts.map((p) => (
                      <tr key={p.id} className="border-b border-zinc-900 align-top last:border-0">
                        <td className="py-2 pr-3 text-zinc-400">{fmtDateTime(p.paidAt, tz, lang)}</td>
                        <td className="py-2 pr-3 text-zinc-100">{p.scoutName}</td>
                        <td className="py-2 pr-3 tabular-nums text-emerald-100">{fmtMoney(p.amount, p.currency, lang)} <span className="text-zinc-500">· {p.rows}</span></td>
                        <td className="py-2 pr-3 font-mono text-zinc-300">{p.ref}</td>
                        <td className="py-2 font-mono text-zinc-500">
                          {p.method ? `${c.profile.methods[p.method as PayoutMethod] ?? p.method} · ` : ""}{p.details ?? "—"}
                          {p.detailsChangedAt && Date.parse(p.paidAt) - Date.parse(p.detailsChangedAt) < RECENT_MS && <AlertTriangle className="ml-1 inline size-3 text-amber-200" aria-label={t.recent} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
          <aside>
            <ScoutRecruitPanel isOwner />
          </aside>
        </div>
      )}

      <Modal open={!!dialog} title={dialog ? `${dialog.scout.name} · ${dialog.kind === "rate" ? t.rateEdit : dialog.kind === "promote" ? t.promote : dialog.kind === "suspend" ? t.suspend : t.activate}` : ""} onClose={() => setDialog(null)}>
        {dialog && (
          <div className="space-y-3">
            {dialog.kind === "rate" && (
              <>
                <p className="text-[12px] leading-relaxed text-zinc-500">{t.rateHint}</p>
                <input className={INPUT} inputMode="decimal" placeholder={`${t.rateGlobal}`} value={rate} onChange={(e) => setRate(e.target.value)} />
              </>
            )}
            {dialog.kind === "promote" && <p className="text-[12px] leading-relaxed text-zinc-400">{t.promoteHint}</p>}
            <textarea className={`${INPUT} min-h-20 py-2.5`} maxLength={300} placeholder={dialog.kind === "rate" ? t.rateNote : t.reasonPh} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_GOLD} disabled={busy === "dialog"} onClick={() => submit(false)}>{busy === "dialog" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t.save}</button>
              {dialog.kind === "rate" && dialog.scout.percentOverride !== null && <button type="button" className={BTN_GHOST} disabled={busy === "dialog"} onClick={() => submit(true)}>{t.rateReset}</button>}
              <button type="button" className={BTN_GHOST} onClick={() => setDialog(null)}>{t.cancel}</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

// для линтера: словарь кабинета тянется и в серверных сборках
void cabinetDict;
