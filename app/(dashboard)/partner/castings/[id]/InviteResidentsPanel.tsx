"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · модуль «Пригласить резиденток» в карточке кастинга
 * app/(dashboard)/partner/castings/[id]/InviteResidentsPanel.tsx
 *
 * Только owner/admin (VOYAGE Management): весь реестр резиденток с
 * фильтрами по выездному статусу, параметрам и турам → точечные
 * приглашения. Доступ проверяют server actions (requireRole) и RPC
 * (is_admin) — скрытие панели в интерфейсе лишь удобство.
 * Приглашённая получает Telegram и видит кастинг в своей ленте, даже если
 * не включила «Открыта к турам». Опцион и рукопожатие по-прежнему
 * требуют KYC 3.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Filter,
  LoaderCircle,
  MailPlus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import {
  inviteResidents,
  listCastingInvites,
  revokeCastingInvite,
  searchResidentRegistry,
} from "@/app/actions/resident-registry";
import { useCatalogTours } from "@/app/(dashboard)/partner/_components/CastingBriefFields";
import { useLanguage } from "@/app/context/LanguageContext";
import { CLOTHING_SIZES } from "@/lib/resident-sizes";
import { pickI18n } from "@/lib/casting-i18n";
import type {
  CastingInviteRow,
  InviteStatus,
  RegistryFilters,
  RegistryResident,
  TravelStatus,
} from "@/lib/resident-registry";

const PAGE = 48;
const LANGS = ["EN", "RU", "ES", "PT", "FR", "IT", "DE", "AR"] as const;

const TRAVEL_LABEL: Record<TravelStatus, string> = {
  available: "Свободна на даты",
  busy: "Занята в другой поездке",
  closed: "Закрыта к турам",
};
const TRAVEL_CLASS: Record<TravelStatus, string> = {
  available: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  busy: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  closed: "border-zinc-700 bg-zinc-900 text-zinc-400",
};
const INVITE_LABEL: Record<InviteStatus, string> = {
  invited: "Приглашена",
  accepted: "Откликнулась",
  declined: "Отказалась",
  revoked: "Отозвано",
};
const INVITE_CLASS: Record<InviteStatus, string> = {
  invited: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  accepted: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  declined: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  revoked: "border-zinc-700 bg-zinc-900 text-zinc-400",
};
const SKIP_LABEL: Record<string, string> = {
  not_eligible: "бан, Blacklist или профиль не одобрен",
  already_responded: "уже откликнулась",
  already_invited: "уже приглашена",
};
const ERROR_LABEL: Record<string, string> = {
  forbidden: "Реестр и приглашения доступны только owner и admin.",
  invalid: "Проверьте выбор и фильтры.",
  closed: "Кастинг закрыт или срок откликов истёк — приглашать нельзя.",
  schema: "В базе нет функций реестра. Примените миграцию 20261103090000_tour_catalog_casting_i18n_invites.sql.",
  too_many: "За один раз можно пригласить не больше 50 резиденток.",
  failed: "Не удалось выполнить запрос. Попробуйте ещё раз.",
};

const INPUT =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-amber-200/30";
const LABEL = "text-[10px] uppercase tracking-[0.16em] text-zinc-500";

const EMPTY_FILTERS: RegistryFilters = {
  q: "",
  travel: "",
  segment: "",
  kycMin: "",
  heightMin: "",
  heightMax: "",
  clothingSizes: [],
  shoeMin: "",
  shoeMax: "",
  languages: [],
  catalogTour: "",
  notInvited: true,
};

const numInput = (v: string): number | "" => (v.trim() === "" ? "" : Number(v.replace(",", ".")));

function toggle(list: string[] | undefined, value: string): string[] {
  const cur = list ?? [];
  return cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
}

function canInvite(r: RegistryResident): boolean {
  if (r.inviteStatus === "invited" || r.inviteStatus === "accepted") return false;
  return !(r.responseStatus === "ready" || r.responseStatus === "option" || r.responseStatus === "selected");
}

export function InviteResidentsPanel({
  castingId,
  castingOpen,
  onChanged,
}: {
  castingId: string;
  castingOpen: boolean;
  onChanged?: () => void;
}) {
  const { lang } = useLanguage();
  const { tours } = useCatalogTours();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<RegistryFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<RegistryFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<RegistryResident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<CastingInviteRow[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const loadInvites = useCallback(async () => {
    const res = await listCastingInvites(castingId);
    if (res.ok) setInvites(res.invites);
  }, [castingId]);

  const search = useCallback(
    async (next: RegistryFilters, offset = 0) => {
      setLoading(true);
      setNotice(null);
      const res = await searchResidentRegistry({ castingId, filters: next, limit: PAGE, offset });
      setLoading(false);
      if (!res.ok) {
        setNotice({ tone: "error", text: ERROR_LABEL[res.reason] ?? ERROR_LABEL.failed });
        return;
      }
      setTotal(res.page.total);
      setRows((prev) => (offset === 0 ? res.page.residents : [...prev, ...res.page.residents]));
    },
    [castingId],
  );

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    if (open && rows.length === 0 && !loading) void search(applied, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tourName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tours) map.set(t.id, pickI18n(t.title, lang, t.sourceLang) ?? t.city);
    return map;
  }, [tours, lang]);

  const applyFilters = () => {
    setApplied(filters);
    setSelected(new Set());
    void search(filters, 0);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setSelected(new Set());
    void search(EMPTY_FILTERS, 0);
  };

  const flip = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      return next;
    });

  const selectAllVisible = () =>
    setSelected(new Set(rows.filter(canInvite).slice(0, 50).map((r) => r.id)));

  const send = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setNotice(null);
    const res = await inviteResidents({ castingId, residentIds: Array.from(selected), message });
    setSending(false);
    if (!res.ok) {
      setNotice({ tone: "error", text: ERROR_LABEL[res.reason] ?? ERROR_LABEL.failed });
      return;
    }
    const { invited, skipped, notified } = res.summary;
    const parts = [`Приглашено: ${invited.length}`, `в Telegram: ${notified}`];
    if (skipped.length) {
      const reasons = Array.from(new Set(skipped.map((s) => SKIP_LABEL[s.reason] ?? s.reason)));
      parts.push(`пропущено ${skipped.length} (${reasons.join(", ")})`);
    }
    if (invited.length > notified) parts.push("без Telegram резидентка увидит приглашение в ленте кастингов");
    setNotice({ tone: invited.length ? "ok" : "error", text: parts.join(" · ") });
    setSelected(new Set());
    setMessage("");
    await Promise.all([loadInvites(), search(applied, 0)]);
    onChanged?.();
  };

  const revoke = async (residentId: string) => {
    const res = await revokeCastingInvite(castingId, residentId);
    if (!res.ok) {
      setNotice({ tone: "error", text: ERROR_LABEL[res.reason] ?? ERROR_LABEL.failed });
      return;
    }
    await Promise.all([loadInvites(), search(applied, 0)]);
  };

  const activeInvites = invites.filter((i) => i.status === "invited" || i.status === "accepted").length;
  const lowKyc = rows.filter((r) => selected.has(r.id) && r.kycLevel < 3).length;

  return (
    <section className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/[0.04] to-transparent p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <MailPlus size={15} className="text-amber-200/80" /> Пригласить резиденток
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Весь реестр платформы (owner/admin): фильтры по выездному статусу, параметрам и турам. Приглашение приходит в Telegram и
            закрепляет кастинг в ленте резидентки.
            {activeInvites > 0 && <span className="ml-1 text-zinc-300">Активных приглашений: {activeInvites}.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-200/15"
          aria-expanded={open}
        >
          <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
          {open ? "Свернуть реестр" : "Открыть реестр"}
        </button>
      </div>

      {invites.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {invites.map((inv) => (
            <li
              key={inv.residentId}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${INVITE_CLASS[inv.status]}`}
              title={inv.message ?? undefined}
            >
              {inv.name ?? "Резидентка"} · {INVITE_LABEL[inv.status]}
              {inv.status === "invited" && !inv.notified && <span className="text-zinc-400">· без Telegram</span>}
              {inv.status === "invited" && (
                <button
                  type="button"
                  onClick={() => void revoke(inv.residentId)}
                  className="rounded-full p-0.5 text-zinc-400 transition hover:text-rose-200"
                  aria-label={`Отозвать приглашение: ${inv.name ?? "резидентка"}`}
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-5 space-y-5">
          {!castingOpen && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-xs text-amber-100">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" /> Кастинг не принимает отклики (статус или срок). Реестр можно смотреть, но приглашения
              не отправятся — откройте кастинг или продлите срок.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
            className="grid gap-3 rounded-xl border border-zinc-800/80 bg-black/20 p-3.5 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className={`${LABEL} sm:col-span-2`}>
              Поиск
              <span className="relative mt-1 block">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  value={filters.q ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Имя, e-mail или @telegram"
                  className={`${INPUT} pl-8 normal-case tracking-normal`}
                />
              </span>
            </label>
            <label className={LABEL}>
              Выездной статус
              <select
                value={filters.travel ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, travel: e.target.value as RegistryFilters["travel"] }))}
                className={`${INPUT} mt-1 normal-case tracking-normal`}
              >
                <option value="">Любой</option>
                <option value="available">{TRAVEL_LABEL.available}</option>
                <option value="busy">{TRAVEL_LABEL.busy}</option>
                <option value="closed">{TRAVEL_LABEL.closed}</option>
              </select>
            </label>
            <label className={LABEL}>
              Сегмент
              <select
                value={filters.segment ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, segment: e.target.value as RegistryFilters["segment"] }))}
                className={`${INPUT} mt-1 normal-case tracking-normal`}
              >
                <option value="">Working и Elite</option>
                <option value="working">Working</option>
                <option value="elite">Elite</option>
              </select>
            </label>
            <label className={LABEL}>
              KYC от
              <select
                value={String(filters.kycMin ?? "")}
                onChange={(e) => setFilters((f) => ({ ...f, kycMin: numInput(e.target.value) }))}
                className={`${INPUT} mt-1 normal-case tracking-normal`}
              >
                <option value="">Любой</option>
                <option value="1">1 · паспорт</option>
                <option value="2">2 · видео</option>
                <option value="3">3 · консьерж (для рукопожатия)</option>
              </select>
            </label>
            <div className={LABEL}>
              Рост, см
              <div className="mt-1 flex gap-2">
                <input inputMode="numeric" placeholder="от" value={String(filters.heightMin ?? "")} onChange={(e) => setFilters((f) => ({ ...f, heightMin: numInput(e.target.value) }))} className={INPUT} />
                <input inputMode="numeric" placeholder="до" value={String(filters.heightMax ?? "")} onChange={(e) => setFilters((f) => ({ ...f, heightMax: numInput(e.target.value) }))} className={INPUT} />
              </div>
            </div>
            <div className={LABEL}>
              Обувь, EU
              <div className="mt-1 flex gap-2">
                <input inputMode="decimal" placeholder="от" value={String(filters.shoeMin ?? "")} onChange={(e) => setFilters((f) => ({ ...f, shoeMin: numInput(e.target.value) }))} className={INPUT} />
                <input inputMode="decimal" placeholder="до" value={String(filters.shoeMax ?? "")} onChange={(e) => setFilters((f) => ({ ...f, shoeMax: numInput(e.target.value) }))} className={INPUT} />
              </div>
            </div>
            <label className={LABEL}>
              Летала в тур
              <select
                value={filters.catalogTour ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, catalogTour: e.target.value }))}
                className={`${INPUT} mt-1 normal-case tracking-normal`}
              >
                <option value="">Не важно</option>
                {tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {tourName.get(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <div className={`${LABEL} sm:col-span-2`}>
              Размер одежды
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CLOTHING_SIZES.map((size) => {
                  const on = (filters.clothingSizes ?? []).includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFilters((f) => ({ ...f, clothingSizes: toggle(f.clothingSizes, size) }))}
                      className={`min-h-8 rounded-full border px-2.5 font-mono text-[11px] tracking-normal transition ${on ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={`${LABEL} sm:col-span-2`}>
              Языки (все выбранные)
              <div className="mt-1 flex flex-wrap gap-1.5">
                {LANGS.map((code) => {
                  const on = (filters.languages ?? []).includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFilters((f) => ({ ...f, languages: toggle(f.languages, code) }))}
                      className={`min-h-8 rounded-full border px-2.5 font-mono text-[11px] tracking-normal transition ${on ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={filters.notInvited === true}
                  onChange={(e) => setFilters((f) => ({ ...f, notInvited: e.target.checked }))}
                  className="size-4 accent-amber-200"
                />
                Скрыть уже приглашённых
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-200">
                  <RotateCcw size={13} /> Сбросить
                </button>
                <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/40 bg-amber-200 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:opacity-60">
                  {loading ? <LoaderCircle size={13} className="animate-spin" /> : <Filter size={13} />} Применить
                </button>
              </div>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span>
              Найдено: <span className="text-zinc-200">{total}</span> · выбрано: <span className="text-amber-100">{selected.size}</span> / 50
            </span>
            {rows.some(canInvite) && (
              <button type="button" onClick={selectAllVisible} className="text-amber-100/80 underline-offset-4 hover:underline">
                Выбрать всех на экране
              </button>
            )}
          </div>

          {rows.length === 0 && !loading ? (
            <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">Никого не нашли — ослабьте фильтры.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => {
                const allowed = canInvite(r);
                const on = selected.has(r.id);
                return (
                  <li key={r.id}>
                    <label
                      className={`flex h-full cursor-pointer gap-3 rounded-xl border p-3 transition ${
                        on ? "border-amber-200/50 bg-amber-200/[0.06]" : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                      } ${allowed ? "" : "cursor-default opacity-70"}`}
                    >
                      <input type="checkbox" className="mt-1 size-4 shrink-0 accent-amber-200" checked={on} disabled={!allowed} onChange={() => flip(r.id)} />
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                        {r.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.photo} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <UserRound className="absolute inset-0 m-auto size-6 text-zinc-600" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm text-zinc-100">{r.name ?? "Без имени"}</span>
                          <span className="rounded-full border border-zinc-700 px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-zinc-400">{r.segment ?? "—"}</span>
                          <span className={`rounded-full border px-1.5 py-px text-[9px] uppercase tracking-[0.12em] ${r.kycLevel >= 3 ? "border-amber-200/40 text-amber-100" : "border-zinc-700 text-zinc-500"}`}>
                            KYC {r.kycLevel}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] text-zinc-400">
                          {[
                            r.height ? `${r.height} см` : null,
                            r.clothingSize,
                            r.shoeSize ? `EU ${r.shoeSize}` : null,
                            r.languages.length ? r.languages.join(" · ") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Параметры не заполнены"}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          <span className={`rounded-full border px-2 py-px text-[10px] ${TRAVEL_CLASS[r.travel]}`}>{TRAVEL_LABEL[r.travel]}</span>
                          {r.toursDone > 0 && <span className="rounded-full border border-zinc-700 px-2 py-px text-[10px] text-zinc-400">Поездок: {r.toursDone}</span>}
                          {r.inviteStatus && <span className={`rounded-full border px-2 py-px text-[10px] ${INVITE_CLASS[r.inviteStatus]}`}>{INVITE_LABEL[r.inviteStatus]}</span>}
                          {r.responseStatus && !r.inviteStatus && <span className="rounded-full border border-emerald-400/20 px-2 py-px text-[10px] text-emerald-200">Есть отклик</span>}
                        </span>
                        {r.catalogTours.length > 0 && (
                          <span className="mt-1 block truncate text-[10px] text-zinc-500">
                            Туры: {r.catalogTours.map((id) => tourName.get(id) ?? "—").join(", ")}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length < total && (
            <div className="text-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => void search(applied, rows.length)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-4 py-2 text-xs text-zinc-300 transition hover:text-white disabled:opacity-60"
              >
                {loading && <LoaderCircle size={13} className="animate-spin" />} Показать ещё
              </button>
            </div>
          )}

          <div className="sticky bottom-3 z-10 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
            <label className={LABEL}>
              Сообщение к приглашению (необязательно, до 500 символов)
              <textarea
                rows={2}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Например: видели ваше портфолио — будем рады видеть вас в Дубае."
                className={`${INPUT} mt-1 normal-case tracking-normal`}
              />
            </label>
            {lowKyc > 0 && (
              <p className="text-[11px] text-amber-100/80">
                У {lowKyc} из выбранных KYC ниже 3: откликнуться они смогут, но опцион и рукопожатие станут доступны после верификации 3 уровня.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {notice ? (
                <p role={notice.tone === "error" ? "alert" : "status"} className={`flex items-start gap-1.5 text-xs ${notice.tone === "error" ? "text-rose-200" : "text-emerald-200"}`}>
                  {notice.tone === "error" ? <ShieldAlert size={13} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
                  {notice.text}
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => void send()}
                disabled={selected.size === 0 || sending || !castingOpen}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/40 bg-amber-200 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
                Пригласить{selected.size ? ` (${selected.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
