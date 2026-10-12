"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  LoaderCircle,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from "lucide-react";
import {
  clearAccountBan,
  getResidentRegistry,
  setAccountBan,
  type BanDuration,
  type ResidentRecord,
} from "@/app/actions/access-control";

const PAGE_SIZE = 50;
const DURATION_OPTIONS: { value: BanDuration; label: string }[] = [
  { value: "24_hours", label: "24 часа" },
  { value: "1_week", label: "1 неделя" },
  { value: "1_month", label: "1 месяц" },
  { value: "forever", label: "Навсегда" },
];

function banActive(row: ResidentRecord) {
  if (row.ban_permanent || row.banned_until === "infinity") return true;
  if (!row.banned_until) return false;
  const until = Date.parse(row.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

function dateLabel(value: string | null) {
  if (!value || value === "infinity") return value === "infinity" ? "Навсегда" : "—";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

export default function FullDatabasePage() {
  const [rows, setRows] = useState<ResidentRecord[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<ResidentRecord | null>(null);
  const [duration, setDuration] = useState<BanDuration>("24_hours");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getResidentRegistry(page, search);
    if (!result.ok) {
      setError(result.error);
      setRows([]);
      setCount(0);
    } else {
      setRows(result.rows);
      setCount(result.count);
    }
    setLoading(false);
  }, [page, search]);

  // The asynchronous loader owns loading/error state for this query lifecycle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submitBan = async () => {
    if (!banTarget) return;
    setWorking(true);
    setError(null);
    const result = await setAccountBan(banTarget.id, duration, reason);
    if (!result.ok) {
      setError(result.error);
    } else {
      setNotice(result.message ?? "Блокировка установлена.");
      setBanTarget(null);
      setReason("");
      await load();
    }
    setWorking(false);
  };

  const unban = async (row: ResidentRecord) => {
    const accepted = window.confirm(`Снять блокировку с профиля «${row.full_name || row.name || row.id}»?`);
    if (!accepted) return;
    setWorking(true);
    setError(null);
    const result = await clearAccountBan(row.id);
    if (!result.ok) setError(result.error);
    else {
      setNotice(result.message ?? "Блокировка снята.");
      await load();
    }
    setWorking(false);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-7 sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-200/[0.05] blur-[90px]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65"><Database size={13} /> God Mode · Private Registry</p>
            <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">Полная база</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Закрытый реестр резиденток. Чувствительные контактные данные доступны только руководству клуба.</p>
          </div>
          <div className="rounded-xl border border-zinc-700/70 bg-black/20 px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-600">Резиденток в реестре</p>
            <p className="mt-1 font-serif text-2xl tabular-nums text-zinc-100">{count.toLocaleString("ru-RU")}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/45 px-4 py-3 transition-colors focus-within:border-amber-200/25">
          <Search size={16} className="shrink-0 text-zinc-600" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Имя, email или Telegram ID..."
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          {search && <button type="button" onClick={() => { setSearch(""); setPage(0); }} className="text-zinc-600 transition-colors hover:text-zinc-200" aria-label="Очистить поиск"><X size={15} /></button>}
        </label>
        <div className="flex items-center gap-2 text-xs text-zinc-600"><ShieldCheck size={14} className="text-amber-100/55" /> Только owner / admin</div>
      </div>

      {notice && <div className="flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200/90"><span className="flex items-center gap-2"><Check size={14} />{notice}</span><button onClick={() => setNotice(null)} aria-label="Закрыть"><X size={14} /></button></div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-left">
            <thead className="bg-black/20">
              <tr className="border-b border-zinc-800/80 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                <th className="px-4 py-4">Резидентка</th>
                <th className="px-4 py-4">Telegram / Email</th>
                <th className="px-4 py-4">Кошелёк USDT</th>
                <th className="px-4 py-4">Сегмент</th>
                <th className="px-4 py-4">Рейтинг / Надёжность</th>
                <th className="px-4 py-4">KYC</th>
                <th className="px-4 py-4">Доступ</th>
                <th className="px-4 py-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500"><LoaderCircle size={18} className="mr-2 inline animate-spin text-amber-100/70" />Загрузка реестра...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500">Резиденты не найдены.</td></tr>
              ) : rows.map((row) => {
                const active = banActive(row);
                return (
                  <tr key={row.id} className="align-top transition-colors hover:bg-white/[0.015]">
                    <td className="max-w-[270px] px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {row.resolved_avatar_url ? <img src={row.resolved_avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-amber-200/20 object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-medium text-amber-100/75">{(row.full_name?.trim() || row.name?.trim() || "?").slice(0, 1).toUpperCase()}</span>}
                        <div className="min-w-0">
                          <Link href={`/admin/database/${row.id}`} className="block truncate text-sm font-medium text-zinc-200 transition-colors hover:text-amber-100">{row.full_name?.trim() || row.name?.trim() || "Без ФИО"}</Link>
                          <p className="mt-1 font-mono text-[10px] text-zinc-700" title={row.id}>{row.id.slice(0, 8)}…</p>
                          <p className="mt-1 text-[10px] text-zinc-600">{row.location || "Локация не указана"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-4">
                      <p className="truncate text-xs text-zinc-300" title={row.telegram_id ?? undefined}>{row.telegram_id || "—"}</p>
                      <p className="mt-1 truncate text-[11px] text-zinc-600" title={row.email ?? undefined}>{row.email || "Email не указан"}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-4"><p className="break-all font-mono text-[10px] leading-5 text-zinc-400" title={row.usdt_wallet ?? undefined}>{row.usdt_wallet || "—"}</p></td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] ${row.segment === "elite" ? "border-amber-200/25 bg-amber-200/[0.07] text-amber-100" : "border-zinc-700/70 bg-zinc-800/50 text-zinc-400"}`}>{row.segment || "working"}</span>
                      <p className="mt-2 text-[10px] text-zinc-600">{row.circle || "voyager"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm tabular-nums text-zinc-200">{row.influence_index ?? row.tour_points ?? 0} <span className="text-[10px] text-zinc-600">pts</span></p>
                      <p className="mt-1 text-[11px] tabular-nums text-zinc-500">Надёжность {Number(row.reliability ?? 100).toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-4"><span className="text-xs tabular-nums text-zinc-300">{row.kyc_level ?? 0}/3</span><p className="mt-1 text-[10px] text-zinc-600">{row.status || "—"}</p></td>
                    <td className="max-w-[200px] px-4 py-4">
                      {active ? <><span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/30 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-rose-200"><Ban size={11} /> Заблокирован</span><p className="mt-2 text-[10px] text-zinc-500">{row.ban_permanent ? "Навсегда" : dateLabel(row.banned_until)}</p><p className="mt-1 line-clamp-2 text-[10px] text-zinc-600" title={row.ban_reason ?? undefined}>{row.ban_reason || "Без причины"}</p></> : <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-emerald-200/80"><Check size={11} /> Активен</span>}
                    </td>
                    <td className="px-4 py-4">
                      {active ? <button disabled={working} onClick={() => void unban(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 px-3 py-2 text-[10px] text-zinc-300 transition-all hover:border-emerald-500/30 hover:text-emerald-200 disabled:opacity-50"><UnlockKeyhole size={12} /> Снять бан</button> : <button disabled={working} onClick={() => { setBanTarget(row); setDuration("24_hours"); setReason(""); setError(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-950/15 px-3 py-2 text-[10px] text-rose-200/85 transition-all hover:border-rose-400/40 hover:bg-rose-950/30 disabled:opacity-50"><Ban size={12} /> Бан</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-zinc-800/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] tracking-wide text-zinc-600">Страница {page + 1} из {totalPages} · Показано {rows.length} из {count}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-30"><ChevronLeft size={14} /> Назад</button>
            <button type="button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-30">Далее <ChevronRight size={14} /></button>
          </div>
        </footer>
      </section>

      {banTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setBanTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ban-modal-title" className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-7">
            <button type="button" onClick={() => setBanTarget(null)} disabled={working} className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-40" aria-label="Закрыть"><X size={17} /></button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-950/25 text-rose-200"><Ban size={18} /></div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-200/70">Access control</p>
            <h2 id="ban-modal-title" className="mt-2 font-serif text-2xl text-zinc-50">Заблокировать резидентку</h2>
            <p className="mt-2 text-sm text-zinc-500">{banTarget.full_name || banTarget.name || banTarget.id}</p>

            <label className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Срок блокировки</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((option) => <button type="button" key={option.value} onClick={() => setDuration(option.value)} className={`rounded-xl border px-3 py-3 text-xs transition-colors ${duration === option.value ? "border-amber-200/35 bg-amber-200/[0.07] text-amber-100" : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"}`}>{option.label}</button>)}
            </div>

            <label htmlFor="ban-reason" className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Причина блокировки</label>
            <textarea id="ban-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Опишите нарушение правил клуба..." className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm leading-6 text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-amber-200/25" />
            <div className="mt-1 text-right text-[10px] text-zinc-700">{reason.length}/500</div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setBanTarget(null)} disabled={working} className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40">Отмена</button>
              <button type="button" onClick={() => void submitBan()} disabled={working || !reason.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-950/50 px-5 py-3 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40">{working ? <LoaderCircle size={14} className="animate-spin" /> : <Clock3 size={14} />} Подтвердить бан</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
