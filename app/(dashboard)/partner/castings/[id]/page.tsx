"use client";

/* VOYAGE · Partner casting response board
 * Names/photos/KYC are shown on this route because the Core Loop requirement
 * explicitly asks for full candidate cards. RPC ownership checks still apply.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock,
  Handshake,
  Languages,
  MapPin,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  completeCastingHandshake,
  declineCastingResponse,
  setCastingResponseOption,
  type CastingActionResult,
} from "@/app/(dashboard)/partner/castings/[id]/actions";

type Casting = {
  id: string;
  manager_id: string;
  city: string;
  project_type: string;
  starts_on: string;
  ends_on: string;
  slots: number;
  closes_at: string;
  fee_amount: number | string | null;
  fee_currency: string | null;
  status: string;
};

type ResponseRow = {
  response_id: string;
  casting_id: string;
  resident_id: string;
  status: string;
  option_expires_at: string | null;
  response_created_at: string;
  response_updated_at: string;
  full_name: string;
  avatar_url: string | null;
  photo_urls: string[] | null;
  height: number | string | null;
  languages: string[] | null;
  kyc_level: number;
  circle: string;
  influence_index: number;
  reliability: number | string;
  resolved_photo_url?: string | null;
};

type TourOption = { id: string; city: string; project_type: string; departs_at: string; casting_id: string | null };
type Filter = "all" | "ready" | "option" | "selected" | "declined" | "withdrawn";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "ready", label: "На рассмотрении" },
  { key: "option", label: "Опцион" },
  { key: "selected", label: "Одобрены" },
  { key: "declined", label: "Отклонены" },
];

const STATUS_LABEL: Record<string, string> = {
  ready: "На рассмотрении",
  option: "Опцион",
  selected: "Рукопожатие · одобрено",
  declined: "Отклонено",
  withdrawn: "Отклик отозван",
};
const STATUS_CLASS: Record<string, string> = {
  ready: "border-amber-200/25 bg-amber-200/5 text-amber-100",
  option: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  selected: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  declined: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  withdrawn: "border-zinc-700 bg-zinc-900 text-zinc-400",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function date(value: string, withTime = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function feeLabel(amount: Casting["fee_amount"], currency: string | null) {
  if (amount === null || !currency) return "По договорённости";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  try { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
  catch { return `${n} ${currency}`; }
}

async function signedPhoto(row: ResponseRow): Promise<ResponseRow> {
  const raw = row.photo_urls?.find(Boolean) || row.avatar_url || null;
  if (!raw) return { ...row, resolved_photo_url: null };
  if (/^https?:\/\//i.test(raw)) return { ...row, resolved_photo_url: raw };
  const { data, error } = await supabase.storage.from("user-uploads").createSignedUrl(raw, 3600);
  return { ...row, resolved_photo_url: error ? null : data?.signedUrl ?? null };
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof UsersIcon }) {
  return <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</span><Icon size={16} className="text-amber-200/60" /></div><p className="mt-3 font-serif text-3xl text-zinc-100">{value}</p></div>;
}
function UsersIcon(props: React.ComponentProps<typeof CircleUserRound>) { return <CircleUserRound {...props} />; }

export default function CastingResponsesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [casting, setCasting] = useState<Casting | null>(null);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [tours, setTours] = useState<TourOption[]>([]);
  const [tourSelection, setTourSelection] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isUuid(id)) {
      setError("Некорректный идентификатор кастинга.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: castingData, error: castingError } = await supabase
      .from("partner_castings")
      .select("id,manager_id,city,project_type,starts_on,ends_on,slots,closes_at,fee_amount,fee_currency,status")
      .eq("id", id)
      .maybeSingle();

    if (castingError || !castingData) {
      setCasting(null);
      setRows([]);
      setTours([]);
      setError(castingError?.message || "Кастинг не найден или недоступен текущей роли.");
      setLoading(false);
      return;
    }
    setCasting(castingData as Casting);

    const [{ data: responseData, error: responseError }, { data: tourData }] = await Promise.all([
      (supabase as any).rpc("partner_manager_get_responses", { p_casting_id: id }),
      supabase.from("partner_tours")
        .select("id,city,project_type,departs_at,casting_id")
        .eq("manager_id", castingData.manager_id)
        .eq("city", castingData.city)
        .eq("project_type", castingData.project_type)
        .eq("status", "confirmed")
        .or(`casting_id.is.null,casting_id.eq.${id}`)
        .order("departs_at", { ascending: true }),
    ]);

    if (responseError) {
      setRows([]);
      setError(responseError.message || "Не удалось загрузить отклики.");
    } else {
      const sourceRows = (Array.isArray(responseData) ? responseData : []) as ResponseRow[];
      const rowsWithPhotos = await Promise.all(sourceRows.map(signedPhoto));
      setRows(rowsWithPhotos);
    }
    const availableTours = (tourData ?? []) as TourOption[];
    setTours(availableTours);
    setTourSelection((prev) => {
      const next = { ...prev };
      for (const row of (Array.isArray(responseData) ? responseData : []) as ResponseRow[]) {
        if (!next[row.resident_id] && availableTours[0]) next[row.resident_id] = availableTours[0].id;
      }
      return next;
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: rows.length, ready: 0, option: 0, selected: 0, declined: 0, withdrawn: 0 };
    rows.forEach((row) => { if (row.status in result) result[row.status as Filter] += 1; });
    return result;
  }, [rows]);
  const filteredRows = useMemo(() => filter === "all" ? rows : rows.filter((row) => row.status === filter), [filter, rows]);
  const canProcess = !!casting && casting.status !== "cancelled";

  async function runAction(key: string, action: () => Promise<CastingActionResult>, success: string) {
    setLoadingAction(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) { setError(result.error); return; }
      setNotice(success);
      await load();
    } finally {
      setLoadingAction(null);
    }
  }

  if (loading && !casting) {
    return <div className="mx-auto max-w-7xl p-6"><div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/30 p-8 text-sm text-zinc-500">Загружаем доску откликов…</div></div>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-12">
      <Link href="/partner/castings" className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-3.5 py-2.5 text-xs text-zinc-400 transition hover:border-amber-200/25 hover:text-amber-100"><ArrowLeft size={14} /> Все кастинги</Link>

      {casting && <>
        <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-200/[0.04] blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-100/60">Partner workspace · Response board</p>
              <h1 className="mt-3 font-serif text-3xl text-zinc-50 sm:text-4xl">{casting.city} <span className="text-amber-100/50">/</span> {casting.project_type}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400"><span className="inline-flex items-center gap-1.5"><CalendarClock size={13} /> {date(casting.starts_on)} – {date(casting.ends_on)}</span><span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {casting.slots} мест</span><span className="inline-flex items-center gap-1.5"><Clock size={13} /> Закрытие: {date(casting.closes_at, true)}</span></p>
            </div>
            <div className="shrink-0 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3"><p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Гонорар</p><p className="mt-1 font-serif text-xl text-amber-100">{feeLabel(casting.fee_amount, casting.fee_currency)}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-600">{casting.status}</p></div>
          </div>
        </header>

<section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
  <Stat label="Всего откликов" value={counts.all} icon={Users as any} />
  <Stat label="На рассмотрении" value={counts.ready} icon={Clock as any} />
  <Stat label="Опционы" value={counts.option} icon={Sparkles as any} />
  <Stat label="Одобрено" value={counts.selected} icon={BadgeCheck as any} />
</section>
      </>}

      {notice && <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-950/20 px-4 py-3 text-sm text-rose-200"><div>{error}</div><button onClick={() => void load()} className="mt-2 inline-flex items-center gap-1.5 text-xs underline underline-offset-4"><RefreshCw size={12} /> Повторить загрузку</button></div>}

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div><h2 className="font-serif text-2xl text-zinc-100">Откликнувшиеся резидентки</h2><p className="mt-1 text-xs text-zinc-500">Профильные данные возвращаются только для текущего кастинга и проверяются серверным RPC.</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400 hover:text-amber-100 disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить</button></div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Фильтр откликов">
          {FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${filter === item.key ? "border-amber-200/25 bg-amber-200/10 text-amber-100" : "border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:text-zinc-200"}`}>{item.label}<span className="font-mono text-[10px] opacity-70">{counts[item.key]}</span></button>)}
        </div>

        {loading && casting ? <div className="rounded-2xl border border-zinc-800 bg-zinc-900/25 p-5 text-sm text-zinc-500">Обновляем данные…</div> : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-zinc-500"><CircleUserRound size={22} /></span><p className="mt-4 text-sm text-zinc-300">{rows.length === 0 ? "На этот кастинг пока не откликнулись" : "В этой категории откликов нет"}</p><p className="mt-1 text-xs text-zinc-600">Новые ответы появятся здесь автоматически после обновления.</p></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredRows.map((row) => {
              const status = String(row.status).toLowerCase();
              const busy = loadingAction?.startsWith(`${row.resident_id}:`) ?? false;
              const actionable = canProcess && (status === "ready" || status === "option");
              const tourId = tourSelection[row.resident_id] ?? "";
              return (
                <article key={row.response_id} className="rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/65 to-zinc-950/80 p-4 transition-colors hover:border-zinc-700/80 sm:p-5">
                  <div className="flex gap-4">
                    {row.resolved_photo_url ? <img src={row.resolved_photo_url} alt={row.full_name} className="h-20 w-20 shrink-0 rounded-2xl border border-amber-200/15 object-cover sm:h-24 sm:w-24" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-600 sm:h-24 sm:w-24"><CircleUserRound size={31} /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words font-serif text-xl text-zinc-100">{row.full_name || "Резидентка"}</h3><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-medium ${STATUS_CLASS[status] ?? STATUS_CLASS.withdrawn}`}>{STATUS_LABEL[status] ?? status}</span></div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-zinc-400">
                        <span className="inline-flex items-center gap-1"><Ruler size={12} className="text-zinc-600" /> {row.height ? `${row.height} см` : "Рост не указан"}</span>
                        <span className="inline-flex items-center gap-1"><Languages size={12} className="text-zinc-600" /> {(row.languages ?? []).length ? row.languages!.join(" · ") : "Языки не указаны"}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] ${Number(row.kyc_level) >= 3 ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200" : "border-amber-300/20 bg-amber-300/5 text-amber-100/80"}`}><ShieldCheck size={11} /> KYC {Math.max(0, Number(row.kyc_level) || 0)}/3</span>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-300"><Sparkles size={11} className="text-amber-200/60" /> {row.circle || "voyager"}</span>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-300"><Star size={11} className="text-amber-200/60" /> Influence {row.influence_index ?? 0}</span>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-400"><UserRoundCheck size={11} /> Reliability {row.reliability ?? 100}%</span>
                      </div>
                    </div>
                  </div>

                  {status === "option" && row.option_expires_at && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-200"><Clock size={12} /> Опцион до {date(row.option_expires_at, true)}</p>}
                  <p className="mt-3 text-[10px] text-zinc-600">Отклик: {date(row.response_created_at, true)}</p>

                  {actionable && <div className="mt-4 space-y-3 border-t border-zinc-800/70 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" disabled={busy || !canProcess} onClick={() => void runAction(`${row.resident_id}:option`, () => setCastingResponseOption(id, row.resident_id, 24), "Опцион установлен на 24 часа.")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-300/[0.07] px-3 py-2.5 text-xs text-violet-100 transition hover:bg-violet-300/[0.13] disabled:cursor-not-allowed disabled:opacity-50"><Clock size={14} /> {status === "option" ? "Продлить опцион на 24 ч" : "Опцион · 24 ч"}</button>
                      <button type="button" disabled={busy || !canProcess} onClick={() => { if (window.confirm(`Отклонить отклик ${row.full_name || "резидентки"}?`)) void runAction(`${row.resident_id}:decline`, () => declineCastingResponse(id, row.resident_id), "Отклик отклонён."); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] px-3 py-2.5 text-xs text-rose-200/90 transition hover:bg-rose-400/[0.1] disabled:cursor-not-allowed disabled:opacity-50"><XCircle size={14} /> Отклонить</button>
                    </div>
                    <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.035] p-3">
                      <label htmlFor={`tour-${row.resident_id}`} className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-100/60">Тур для рукопожатия</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative min-w-0 flex-1"><select id={`tour-${row.resident_id}`} value={tourId} onChange={(event) => setTourSelection((prev) => ({ ...prev, [row.resident_id]: event.target.value }))} disabled={!tours.length || busy} className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 pr-9 text-xs text-zinc-200 outline-none focus:border-emerald-300/30 disabled:opacity-50"><option value="">{tours.length ? "Выберите тур" : "Нет подходящего подтверждённого тура"}</option>{tours.map((tour) => <option key={tour.id} value={tour.id}>{tour.city} · {tour.project_type} · {date(tour.departs_at)}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" /></div>
                        <button type="button" disabled={busy || !canProcess || !tourId} onClick={() => { if (window.confirm(`Подтвердить рукопожатие с ${row.full_name || "резиденткой"}? Будет создан участник тура.`)) void runAction(`${row.resident_id}:handshake`, () => completeCastingHandshake(id, tourId, row.resident_id), "Рукопожатие завершено: резидентка добавлена в состав тура."); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-2.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-40"><Handshake size={14} /> Рукопожатие / утвердить</button>
                      </div>
                      {!tours.length && <p className="mt-2 text-[10px] leading-4 text-zinc-500">Создайте подтверждённый тур с тем же городом и типом проекта. Функция рукопожатия проверяет соответствие тура, KYC, Blacklist и лимит мест.</p>}
                    </div>
                  </div>}
                  {status === "selected" && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2.5 text-xs text-emerald-200"><CheckCircle2 size={15} /> Рукопожатие завершено, участница привязана к туру.</div>}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <div className="flex justify-start"><button onClick={() => router.refresh()} className="inline-flex items-center gap-2 text-[10px] text-zinc-600 transition hover:text-zinc-300"><RefreshCw size={11} /> Перезагрузить страницу</button></div>
    </main>
  );
}
