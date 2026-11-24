"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · анкета кандидатки на доске откликов кастинга
 * app/(dashboard)/partner/castings/[id]/CandidateProfileDialog.tsx
 *
 * Открывается из списка откликнувшихся. Листание ← / → по текущему
 * фильтру доски — чтобы быстро сравнивать кандидаток. Данные — только из
 * getCastingCandidateProfile (RPC partner_manager_candidate_profile):
 * контактов, документов и платёжных данных в ответе нет, поэтому их нет
 * и в интерфейсе. Действия отбора — те же, что на карточке доски
 * (опцион, отказ, рукопожатие), их проверяют штатные RPC.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Camera,
  Handshake,
  Languages,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  X,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { getCastingCandidateProfile } from "@/app/actions/casting-candidates";
import type { CandidateProfile } from "@/lib/casting-candidate";
import KycLevelBadge from "@/app/components/profile/KycLevelBadge";
import { VipBadge, isKycElite } from "@/app/components/profile/VipBadge";
import { kycCopy } from "@/lib/kyc-levels";
import { projectLabel } from "@/lib/project-types";

export type CandidateRowRef = {
  resident_id: string;
  response_updated_at: string;
  status: string;
  full_name: string;
  profile_available?: boolean | null;
};

type TourOption = { id: string; city: string; project_type: string; departs_at: string };

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

const FAILURE_TEXT: Record<string, string> = {
  forbidden: "Анкеты этого кастинга вам недоступны: вы не ответственный за кастинг или назначение на тур отозвано.",
  withdrawn: "Резидентка отозвала отклик — анкета закрыта.",
  not_found: "Кандидатка не найдена среди откликов этого кастинга.",
  schema: "На базе не применена миграция 20261127090000_manager_candidate_profile.sql.",
  invalid: "Некорректная ссылка на анкету.",
  failed: "Не удалось загрузить анкету. Попробуйте ещё раз.",
};

function date(value: string | null, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function years(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} год`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} года`;
  return `${n} лет`;
}

function Param({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{label}</p>
      <p className={`mt-1 text-sm ${value ? "text-zinc-100" : "text-zinc-600"}`}>{value ?? "не указано"}</p>
    </div>
  );
}

export function CandidateProfileDialog({
  castingId,
  rows,
  index,
  onIndex,
  onClose,
  lang,
  canProcess,
  tours,
  tourSelection,
  onTourSelect,
  busyKey,
  onOption,
  onDecline,
  onHandshake,
}: {
  castingId: string;
  rows: CandidateRowRef[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  lang: Lang;
  canProcess: boolean;
  tours: TourOption[];
  tourSelection: Record<string, string>;
  onTourSelect: (residentId: string, tourId: string) => void;
  busyKey: string | null;
  onOption: (residentId: string, status: string) => void;
  onDecline: (residentId: string, name: string) => void;
  onHandshake: (residentId: string, tourId: string, name: string) => void;
}) {
  const row = rows[index] ?? null;
  const [cache, setCache] = useState<Record<string, CandidateProfile>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Ключ кэша включает время изменения отклика: после опциона/отказа анкета перечитывается.
  const cacheKey = row ? `${row.resident_id}:${row.response_updated_at}` : "";
  const profile = cacheKey ? cache[cacheKey] ?? null : null;

  const load = useCallback(async () => {
    if (!row) return;
    setFailure(null);
    if (cache[cacheKey]) return;
    if (row.profile_available === false) {
      setFailure(row.status === "withdrawn" ? "withdrawn" : "forbidden");
      return;
    }
    setLoading(true);
    const result = await getCastingCandidateProfile(castingId, row.resident_id);
    setLoading(false);
    if (!result.ok) { setFailure(result.reason); return; }
    setCache((prev) => ({ ...prev, [cacheKey]: result.profile }));
  }, [cache, cacheKey, castingId, row]);

  useEffect(() => { setPhotoIndex(0); }, [row?.resident_id]);
  useEffect(() => { void load(); }, [load]);

  const go = useCallback((delta: number) => {
    if (rows.length < 2) return;
    onIndex((index + delta + rows.length) % rows.length);
  }, [index, onIndex, rows.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [go, onClose]);

  const gallery = useMemo(() => profile?.photos ?? [], [profile]);
  const mainPhoto = gallery[Math.min(photoIndex, Math.max(gallery.length - 1, 0))]?.src ?? null;
  const status = String(row?.status ?? profile?.response.status ?? "").toLowerCase();
  const actionable = canProcess && (status === "ready" || status === "option");
  const busy = !!row && (busyKey?.startsWith(`${row.resident_id}:`) ?? false);
  const tourId = row ? tourSelection[row.resident_id] ?? "" : "";
  const name = profile?.name ?? row?.full_name ?? "Резидентка";

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Анкета: ${name}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden border-amber-200/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black outline-none sm:max-h-[92vh] sm:rounded-3xl sm:border">
        {/* Шапка: листание и закрытие */}
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(-1)} disabled={rows.length < 2} aria-label="Предыдущая кандидатка" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 transition hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="font-mono text-[11px] text-zinc-500">{index + 1} / {rows.length}</span>
            <button type="button" onClick={() => go(1)} disabled={rows.length < 2} aria-label="Следующая кандидатка" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 transition hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-30"><ChevronRight size={16} /></button>
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-zinc-600 sm:inline">← → для сравнения</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть анкету" className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 transition hover:text-zinc-100"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {failure ? (
            <div className="p-8 text-center sm:p-12">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-zinc-500"><Lock size={20} /></span>
              <p className="mt-4 text-sm text-zinc-300">{FAILURE_TEXT[failure] ?? FAILURE_TEXT.failed}</p>
              {failure === "failed" && <button type="button" onClick={() => void load()} className="mt-3 text-xs text-amber-100 underline underline-offset-4">Повторить</button>}
            </div>
          ) : !profile ? (
            <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="aspect-[3/4] animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />)}<p className="text-xs text-zinc-600">{loading ? "Загружаем анкету…" : ""}</p></div>
            </div>
          ) : (
            <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              {/* Галерея */}
              <section aria-label="Фотографии" className="space-y-3">
                <div className={`relative aspect-[3/4] max-h-[52vh] w-full overflow-hidden rounded-2xl border bg-zinc-900 md:max-h-none ${isKycElite(profile.kycLevel) ? "border-amber-200/40" : "border-zinc-800"}`}>
                  {mainPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка Supabase Storage, срок 1 час
                    <img src={mainPhoto} alt={`${name} — фото ${photoIndex + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-600"><CircleUserRound size={42} /><span className="text-xs">Фотографий нет</span></div>
                  )}
                  {gallery.length > 1 && (
                    <>
                      <button type="button" onClick={() => setPhotoIndex((i) => (i - 1 + gallery.length) % gallery.length)} aria-label="Предыдущее фото" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 p-1.5 text-zinc-200 backdrop-blur hover:bg-black/70"><ChevronLeft size={16} /></button>
                      <button type="button" onClick={() => setPhotoIndex((i) => (i + 1) % gallery.length)} aria-label="Следующее фото" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 p-1.5 text-zinc-200 backdrop-blur hover:bg-black/70"><ChevronRight size={16} /></button>
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-zinc-300">{photoIndex + 1}/{gallery.length}</span>
                    </>
                  )}
                </div>
                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {gallery.map((p, i) => (
                      <button key={p.src} type="button" onClick={() => setPhotoIndex(i)} aria-label={`Фото ${i + 1}`} aria-current={i === photoIndex} className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border transition ${i === photoIndex ? "border-amber-200/60" : "border-zinc-800 opacity-70 hover:opacity-100"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {profile.snaps.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500"><Camera size={11} /> Актуальные снепы</p>
                    <div className="grid grid-cols-4 gap-2 md:grid-cols-3">
                      {profile.snaps.map((s) => (
                        <figure key={s.src} className="overflow-hidden rounded-lg border border-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.src} alt="Снеп" className="aspect-[3/4] w-full object-cover" />
                          <figcaption className="px-1.5 py-1 text-[9px] text-zinc-500">{date(s.capturedAt)}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Анкета */}
              <section aria-label="Анкета" className="min-w-0 space-y-5">
                <header>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="break-words font-serif text-3xl text-zinc-50">{name}{profile.age !== null && <span className="text-zinc-400">, {years(profile.age)}</span>}</h2>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${STATUS_CLASS[status] ?? STATUS_CLASS.withdrawn}`}>{STATUS_LABEL[status] ?? status}</span>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                    {profile.location && <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-zinc-600" /> {profile.location}</span>}
                    <span className="font-mono text-[10px] text-zinc-600">{profile.code}</span>
                    <span>Отклик: {date(profile.response.createdAt, true)}</span>
                  </p>
                  {status === "option" && profile.response.optionExpiresAt && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-200"><Clock size={12} /> Опцион до {date(profile.response.optionExpiresAt, true)}</p>}
                </header>

                <div className="flex flex-wrap gap-1.5">
                  {isKycElite(profile.kycLevel) ? <VipBadge lang={lang} variant="compact" /> : <KycLevelBadge level={profile.kycLevel} lang={lang} tone={profile.belowKyc ? "miss" : "ok"} />}
                  {profile.belowKyc && (status === "ready" || status === "option") && <span title={kycCopy(lang).raiseWarning} className="inline-flex items-center gap-1 rounded-full border border-amber-300/35 bg-amber-300/[0.08] px-2 py-0.5 text-[10.5px] text-amber-100"><ShieldCheck size={11} /> {kycCopy(lang).belowRequired(profile.minKycLevel)}</span>}
                  {profile.trust.trusted ? (
                    <span title="3+ долетевших тура, 3+ отзыва от 4,5, без срывов за год" className="inline-flex items-center gap-1 rounded-full border border-amber-200/40 bg-gradient-to-r from-amber-200/20 to-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.08em] text-amber-100"><ShieldCheck size={11} /> Trusted</span>
                  ) : (
                    <span title="Trusted: 3+ долетевших тура, 3+ отзыва от 4,5, без срывов за год" className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-black/20 px-2 py-0.5 text-[10.5px] text-zinc-400">Trusted — пока нет</span>
                  )}
                  {profile.verifiedAt && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10.5px] text-emerald-200"><CheckCircle2 size={11} /> Верифицирована {date(profile.verifiedAt)}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Param label="Рост" value={profile.height ? `${profile.height} см` : null} />
                  <Param label="Вес" value={profile.weight ? `${profile.weight} кг` : null} />
                  <Param label="Параметры" value={profile.measurements} />
                  <Param label="Размер одежды" value={profile.clothingSize} />
                  <Param label="Размер обуви" value={profile.shoeSize !== null ? `EU ${profile.shoeSize}` : null} />
                  <Param label="Возраст" value={profile.age !== null ? years(profile.age) : null} />
                  <Param label="Курение" value={profile.smoking === null ? null : profile.smoking ? "Да" : "Нет"} />
                  <Param label="Алкоголь" value={profile.alcohol === null ? null : profile.alcohol ? "Да" : "Нет"} />
                  <Param label="Сегмент" value={profile.segment === "elite" ? "Elite" : profile.segment === "working" ? "Working" : null} />
                </div>

                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500"><Languages size={11} /> Языки</p>
                  <div className="flex flex-wrap gap-1.5">{profile.languages.length ? profile.languages.map((l) => <span key={l} className="rounded-lg border border-zinc-800 bg-black/20 px-2 py-1 font-mono text-[11px] text-zinc-200">{l}</span>) : <span className="text-xs text-zinc-600">не указаны</span>}</div>
                </div>

                <div>
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">О себе</p>
                  <p className="whitespace-pre-line rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2.5 text-sm leading-6 text-zinc-200">{profile.about ?? <span className="text-zinc-600">Резидентка пока ничего не написала.</span>}</p>
                </div>

                {profile.achievements.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Достижения и опыт</p>
                    <ul className="space-y-1 text-sm text-zinc-300">{profile.achievements.map((a) => <li key={a} className="flex gap-2"><Sparkles size={12} className="mt-1 shrink-0 text-amber-200/60" /> {a}</li>)}</ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-zinc-300"><Sparkles size={11} className="text-amber-200/60" /> {profile.circle}</span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-zinc-300"><Star size={11} className="text-amber-200/60" /> Influence {profile.influenceIndex}</span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-zinc-400"><UserRoundCheck size={11} /> Reliability {profile.reliability}%</span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-zinc-400">Туров: {profile.trust.flown}{profile.trust.rating !== null && ` · ★ ${profile.trust.rating} (${profile.trust.reviews})`}</span>
                </div>

                <p className="flex items-start gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5 text-[11px] leading-5 text-zinc-500"><Lock size={13} className="mt-0.5 shrink-0 text-zinc-600" /> Контакты, Telegram, email, документы и видео KYC, платёжные данные и Personal Vault в анкете не показываются — ни до рукопожатия, ни после. Связь с участницей — через комнату поездки и бота клуба.</p>

                {actionable && (
                  <div className="space-y-3 border-t border-zinc-800/70 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" disabled={busy} onClick={() => onOption(row.resident_id, status)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-300/[0.07] px-3 py-2.5 text-xs text-violet-100 transition hover:bg-violet-300/[0.13] disabled:cursor-not-allowed disabled:opacity-50"><Clock size={14} /> {status === "option" ? "Продлить опцион на 24 ч" : "Опцион · 24 ч"}</button>
                      <button type="button" disabled={busy} onClick={() => onDecline(row.resident_id, name)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] px-3 py-2.5 text-xs text-rose-200/90 transition hover:bg-rose-400/[0.1] disabled:cursor-not-allowed disabled:opacity-50"><XCircle size={14} /> Отклонить</button>
                    </div>
                    <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.035] p-3">
                      <label htmlFor={`dlg-tour-${row.resident_id}`} className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-100/60">Логистика (перелёт) для рукопожатия</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative min-w-0 flex-1">
                          <select id={`dlg-tour-${row.resident_id}`} value={tourId} onChange={(e) => onTourSelect(row.resident_id, e.target.value)} disabled={!tours.length || busy} className="w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 pr-9 text-xs text-zinc-200 outline-none focus:border-emerald-300/30 disabled:opacity-50">
                            <option value="">{tours.length ? "Выберите перелёт" : "Нет подтверждённых деталей перелёта"}</option>
                            {tours.map((t) => <option key={t.id} value={t.id}>{t.city} · {projectLabel(t.project_type, lang)} · {date(t.departs_at)}</option>)}
                          </select>
                          <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        </div>
                        <button type="button" disabled={busy || !tourId} onClick={() => onHandshake(row.resident_id, tourId, name)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-2.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-40"><Handshake size={14} /> Рукопожатие / утвердить</button>
                      </div>
                    </div>
                  </div>
                )}
                {status === "selected" && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2.5 text-xs text-emerald-200"><CheckCircle2 size={15} /> Рукопожатие завершено, участница привязана к поездке.</div>}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
