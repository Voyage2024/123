"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — доска тура (менеджер, owner, оператор)
 *
 *   Таймлайн   день в поясе тура, модели колонками, свободные окна,
 *              «впритык» при зазоре меньше буфера, статусы в один клик
 *   Касса      завершено / в работе / отменено, по моделям и операторам
 *   Операторы  привязка операторов команды к туру и моделям
 *   Приглашения прямые приглашения своих (закреплённых) моделей в тур
 *   Сейф       билеты моделей, апартаменты, заселение
 *   Настройки  пояс, валюта, доля модели, буфер
 *
 * Оператор видит только таймлайн и апартаменты своих моделей, без кассы.
 * Права — в БД; вкладки лишь не показывают то, что всё равно не отдадут.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CalendarClock, ChevronLeft, ChevronRight, Loader2, MapPin, Pencil, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, Pill } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { deleteBooking, saveBooking, saveTourSettings, setBookingStatus } from "@/app/actions/tour-ops";
import { BOOKING_FORMATS, NEXT_STATUS, PAYMENT_METHODS, errorCode, num, obj, arr, str, parseBoard, type Booking, type BookingFormat, type GuestCard, type PaymentMethod, type TourBoard } from "@/lib/tour-ops/types";
import { opsError, type OpsDict } from "@/lib/tour-ops/i18n";
import { COMMON_TIMEZONES, dayKey, fmtDay, fmtDuration, fmtMoney, isValidTimezone, minutesBetween, shiftDay, timeKey, withGaps, zonedToIso, type UiLang } from "@/lib/tour-ops/time";
import { Chip, DualTime, Field, GUEST_TONE, INPUT, Modal, Notice, STATUS_TONE, Tabs, useOps } from "@/app/components/tour-ops/ops-ui";
import GuestDesk from "@/app/components/tour-ops/GuestDesk";
import TourTeamPanel from "@/app/components/tour-ops/TourTeamPanel";
import VaultPanel from "@/app/components/tour-ops/VaultPanel";
import TourInvitesPanel, { ScoutCashboxBlock } from "@/app/components/scouting/TourInvitesPanel";
import { scoutDict } from "@/lib/scouting/i18n";

type TabKey = "timeline" | "cashbox" | "team" | "invites" | "vault" | "settings";

export default function TourOpsBoard({ tourId, backHref, ownerView = false }: { tourId: string; backHref: string; ownerView?: boolean }) {
  const { t, lang } = useOps();
  const [board, setBoard] = useState<TourBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("timeline");

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("voyage_tour_ops_board", { p_tour: tourId, p_from: null, p_to: null });
    setLoading(false);
    if (rpcError) {
      setError(opsError(t, errorCode(rpcError.message)));
      return;
    }
    setError(null);
    setBoard(parseBoard(data));
  }, [tourId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Живое обновление: любые изменения заказов тура → перечитать доску.
  useEffect(() => {
    const channel = supabase
      .channel(`tour-ops:${tourId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tour_bookings", filter: `tour_id=eq.${tourId}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tourId, load]);

  if (loading) {
    return (
      <PageShell>
        <p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>
      </PageShell>
    );
  }
  if (!board) {
    return (
      <PageShell>
        <Link href={backHref} className={BTN_GHOST}><ArrowLeft className="size-3.5" /> {t.common.back}</Link>
        <div className="mt-6"><Notice tone="rose">{error ?? t.errors.forbidden}</Notice></div>
      </PageShell>
    );
  }

  const manage = board.access === "owner" || board.access === "manager";
  const tabs: { key: TabKey; label: string }[] = [
    { key: "timeline", label: t.board.tabs.timeline },
    ...(manage
      ? [
          { key: "cashbox" as const, label: t.board.tabs.cashbox },
          { key: "team" as const, label: t.board.tabs.team },
          { key: "invites" as const, label: scoutDict(lang).tourInvite.tab },
        ]
      : []),
    { key: "vault", label: manage ? t.board.tabs.vault : t.board.tabs.housing },
    ...(manage ? [{ key: "settings" as const, label: t.board.tabs.settings }] : []),
  ];
  const tz = board.settings.timezone;

  return (
    <PageShell>
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-200">
        <ArrowLeft className="size-3.5" /> {t.common.back}
      </Link>
      <PageHeader
        eyebrow={`${board.tour.city}${board.tour.iata ? ` · ${board.tour.iata}` : ""} · ${t.tourStatus[board.tour.status] ?? board.tour.status}`}
        title={board.tour.city}
        subtitle={board.access === "resident" ? "" : t.board.accessNote[board.access]}
        aside={
          <div className="flex flex-wrap gap-2">
            <Pill tone="gold" icon={CalendarClock}>{t.common.tourTime(board.tour.city)}</Pill>
            {ownerView && <Pill tone="zinc" icon={UserRound}>{board.tour.managerName}</Pill>}
          </div>
        }
      />

      {!board.settings.exists && manage && <div className="mt-6"><Notice tone="amber">{t.board.settingsMissing}</Notice></div>}
      {error && <div className="mt-4"><Notice tone="rose">{error}</Notice></div>}

      <div className="mt-6">
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="mt-5">
        {tab === "timeline" && <Timeline board={board} t={t} lang={lang} reload={load} />}
        {tab === "cashbox" && manage && <Cashbox tourId={tourId} board={board} t={t} lang={lang} />}
        {tab === "team" && manage && <TourTeamPanel board={board} reload={load} />}
        {tab === "invites" && manage && <TourInvitesPanel tourId={tourId} closed={board.tour.status === "closed" || board.tour.status === "cancelled"} />}
        {tab === "vault" && <VaultPanel board={board} reload={load} />}
        {tab === "settings" && manage && <SettingsPanel board={board} t={t} reload={load} />}
      </div>
      <p className="mt-8 text-[11px] text-zinc-600">{tz}</p>
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ТАЙМЛАЙН
 * ══════════════════════════════════════════════════════════════════ */

function initialDay(board: TourBoard): string {
  const tz = board.settings.timezone;
  const today = dayKey(new Date(), tz);
  const from = dayKey(board.tour.departsAt, tz);
  const to = board.tour.returnsAt ? dayKey(board.tour.returnsAt, tz) : null;
  if (today < from) return from;
  if (to && today > to) return to;
  return today;
}

function Timeline({ board, t, lang, reload }: { board: TourBoard; t: OpsDict; lang: UiLang; reload: () => Promise<void> }) {
  const tz = board.settings.timezone;
  const [day, setDay] = useState(() => initialDay(board));
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closed = board.tour.status === "closed" || board.tour.status === "cancelled";
  const manage = board.access === "owner" || board.access === "manager";

  const dayBookings = useMemo(() => board.bookings.filter((b) => dayKey(b.startsAt, tz) === day), [board.bookings, day, tz]);
  const models = board.models.filter((m) => modelFilter === "all" || m.id === modelFilter);
  const dayCount = dayBookings.filter((b) => b.status !== "cancelled").length;

  const advance = async (b: Booking) => {
    const next = NEXT_STATUS[b.status];
    if (!next) return;
    setBusy(b.id);
    const r = await setBookingStatus(b.id, next);
    setBusy(null);
    if (!r.ok) setError(opsError(t, r.code));
    else {
      setError(null);
      await reload();
    }
  };

  const remove = async (b: Booking) => {
    if (!window.confirm(`${t.common.remove}?`)) return;
    const r = await deleteBooking(b.id);
    if (!r.ok) setError(opsError(t, r.code));
    else await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_GHOST} aria-label={t.board.prevDay} onClick={() => setDay((d) => shiftDay(d, -1))}><ChevronLeft className="size-4" /></button>
        <div className="min-w-[10rem] text-center">
          <p className="text-sm text-zinc-100">{fmtDay(zonedToIso(day, "12:00", tz) ?? new Date().toISOString(), tz, lang)}</p>
          <p className="text-[11px] text-zinc-500">{t.board.dayLoad(dayCount)}</p>
        </div>
        <button type="button" className={BTN_GHOST} aria-label={t.board.nextDay} onClick={() => setDay((d) => shiftDay(d, 1))}><ChevronRight className="size-4" /></button>
        <button type="button" className={BTN_GHOST} onClick={() => setDay(dayKey(new Date(), tz))}>{t.board.today}</button>
        <select className={`${INPUT} w-auto min-w-[10rem]`} value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} aria-label={t.form.model}>
          <option value="all">{t.board.allModels}</option>
          {board.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button type="button" className={BTN_GHOST} onClick={() => void reload()} aria-label={t.common.retry}><RefreshCw className="size-3.5" /></button>
        <div className="flex-1" />
        {!closed && board.models.length > 0 && (
          <button type="button" className={BTN_GOLD} onClick={() => setEditing("new")}><Plus className="size-3.5" /> {t.board.newBooking}</button>
        )}
      </div>

      {closed && <Notice>{t.board.readonlyClosed}</Notice>}
      {error && <Notice tone="rose">{error}</Notice>}
      {board.models.length === 0 && <Notice>{t.board.noModels}</Notice>}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {models.map((m) => {
          const items = dayBookings.filter((b) => b.modelId === m.id);
          const slots = withGaps(items, board.settings.bufferMinutes);
          return (
            <Panel key={m.id} className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-zinc-100">{m.name}</p>
                <span className="text-[11px] text-zinc-500">{t.board.dayLoad(items.filter((b) => b.status !== "cancelled").length)}</span>
              </div>
              {slots.length === 0 && <p className="text-[13px] text-zinc-500">{t.board.noBookingsDay}</p>}
              <ol className="space-y-2">
                {slots.map((s, i) =>
                  s.kind === "gap" ? (
                    <li
                      key={`gap-${i}`}
                      className={`rounded-xl border border-dashed px-3 py-1.5 text-[11px] ${s.tight ? "border-orange-400/50 text-orange-200" : "border-emerald-400/30 text-emerald-200/80"}`}
                    >
                      {s.minutes === 0
                        ? t.board.back2back
                        : s.tight
                          ? t.board.tight(fmtDuration(s.minutes, lang), board.settings.bufferMinutes)
                          : t.board.freeWindow(fmtDuration(s.minutes, lang))}
                    </li>
                  ) : (
                    <li key={s.item.id}>
                      <BookingCard
                        b={s.item}
                        board={board}
                        t={t}
                        lang={lang}
                        busy={busy === s.item.id}
                        onAdvance={() => advance(s.item)}
                        onCancel={() => setCancelling(s.item)}
                        onEdit={() => setEditing(s.item)}
                        onDelete={board.access === "owner" ? () => remove(s.item) : undefined}
                        locked={closed || ((s.item.status === "completed" || s.item.status === "cancelled") && !manage)}
                      />
                    </li>
                  ),
                )}
              </ol>
            </Panel>
          );
        })}
      </div>

      {editing && (
        <BookingForm
          board={board}
          booking={editing === "new" ? null : editing}
          defaultDay={day}
          defaultModel={modelFilter !== "all" ? modelFilter : board.models[0]?.id ?? ""}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
      {cancelling && (
        <CancelDialog
          booking={cancelling}
          t={t}
          onClose={() => setCancelling(null)}
          onDone={async () => {
            setCancelling(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function BookingCard({
  b,
  board,
  t,
  lang,
  busy,
  locked,
  onAdvance,
  onCancel,
  onEdit,
  onDelete,
}: {
  b: Booking;
  board: TourBoard;
  t: OpsDict;
  lang: UiLang;
  busy: boolean;
  locked: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const next = NEXT_STATUS[b.status];
  return (
    <article className={`rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 ${b.status === "cancelled" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <DualTime start={b.startsAt} end={b.endsAt} tourTz={board.settings.timezone} viewerTz={board.myTimezone} lang={lang} t={t} />
        <Chip className={STATUS_TONE[b.status]}>{t.status[b.status]}</Chip>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-400">
        <span className="text-zinc-200">{t.format[b.format]}</span>
        <span>{fmtDuration(minutesBetween(b.startsAt, b.endsAt), lang)}</span>
        <span>{t.board.total}: <span className="text-zinc-200">{fmtMoney(b.totalAmount, b.currency, lang)}</span></span>
        <span>{t.board.modelShare}: {fmtMoney(b.modelAmount, b.currency, lang)}</span>
        <span>{t.payment[b.paymentMethod]}</span>
      </div>
      {(b.guestLabel || b.guestStatus) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-zinc-300">
          <UserRound className="size-3.5 text-zinc-500" /> {b.guestLabel ?? "—"}
          {b.guestStatus && b.guestStatus !== "neutral" && <Chip className={GUEST_TONE[b.guestStatus]}>{t.guests.status[b.guestStatus]}</Chip>}
        </div>
      )}
      {b.format === "outcall" && b.outcallAddress && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-zinc-300"><MapPin className="mt-0.5 size-3.5 shrink-0 text-zinc-500" /> {b.outcallAddress}</p>
      )}
      {b.operatorName && <p className="mt-1 text-[11px] text-zinc-500">{t.board.operator}: {b.operatorName}</p>}
      {b.notes && <p className="mt-1 whitespace-pre-line text-[11px] text-zinc-500">{b.notes}</p>}
      {b.status === "cancelled" && b.cancelReason && <p className="mt-1 text-[11px] text-rose-200/80">{b.cancelReason}</p>}

      {!locked && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {next && (
            <button type="button" className={BTN_GOLD} disabled={busy} onClick={onAdvance}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t.nextAction[b.status]}
            </button>
          )}
          {b.status !== "completed" && b.status !== "cancelled" && (
            <button type="button" className={BTN_GHOST} onClick={onCancel}><Ban className="size-3.5" /> {t.board.cancelBooking}</button>
          )}
          <button type="button" className={BTN_GHOST} onClick={onEdit} aria-label={t.common.edit}><Pencil className="size-3.5" /></button>
          {onDelete && (
            <button type="button" className={BTN_GHOST} onClick={onDelete} aria-label={t.common.remove}><Trash2 className="size-3.5" /></button>
          )}
        </div>
      )}
    </article>
  );
}

function CancelDialog({ booking, t, onClose, onDone }: { booking: Booking; t: OpsDict; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (reason.trim().length < 3) {
      setError(t.errors.reason_required);
      return;
    }
    setBusy(true);
    const r = await setBookingStatus(booking.id, "cancelled", reason.trim());
    setBusy(false);
    if (!r.ok) setError(opsError(t, r.code));
    else onDone();
  };
  return (
    <Modal open title={t.board.confirmCancel} onClose={onClose}>
      <Field label={t.board.reasonPrompt}>
        <textarea className={`${INPUT} min-h-24 py-2`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.board.reasonPlaceholder} maxLength={300} />
      </Field>
      {error && <div className="mt-3"><Notice tone="rose">{error}</Notice></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={BTN_GOLD} disabled={busy} onClick={submit}>{busy ? t.common.saving : t.board.confirmCancel}</button>
        <button type="button" className={BTN_GHOST} onClick={onClose}>{t.common.close}</button>
      </div>
    </Modal>
  );
}

/* ── форма букинга ─────────────────────────────────────────────────── */

const DURATIONS = [30, 60, 90, 120, 180, 240, 360, 480, 720];

function BookingForm({
  board,
  booking,
  defaultDay,
  defaultModel,
  onClose,
  onSaved,
}: {
  board: TourBoard;
  booking: Booking | null;
  defaultDay: string;
  defaultModel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useOps();
  const tz = board.settings.timezone;
  const manage = board.access === "owner" || board.access === "manager";
  const [modelId, setModelId] = useState(booking?.modelId ?? defaultModel);
  const [day, setDay] = useState(booking ? dayKey(booking.startsAt, tz) : defaultDay);
  const [start, setStart] = useState(booking ? timeKey(booking.startsAt, tz) : "20:00");
  const [duration, setDuration] = useState(booking ? minutesBetween(booking.startsAt, booking.endsAt) : 60);
  const [format, setFormat] = useState<BookingFormat>(booking?.format ?? "incall");
  const [address, setAddress] = useState(booking?.outcallAddress ?? "");
  const [guestId, setGuestId] = useState<string | null>(booking?.guestId ?? null);
  const [guestLabel, setGuestLabel] = useState(booking?.guestLabel ?? "");
  const [guestPicked, setGuestPicked] = useState<GuestCard | null>(null);
  const [showLookup, setShowLookup] = useState(false);
  const [total, setTotal] = useState(String(booking?.totalAmount ?? ""));
  const [modelAmount, setModelAmount] = useState(String(booking?.modelAmount ?? ""));
  const [splitTouched, setSplitTouched] = useState(Boolean(booking));
  const [payment, setPayment] = useState<PaymentMethod>(booking?.paymentMethod ?? "cash");
  const [operatorId, setOperatorId] = useState<string>(booking?.operatorId ?? "");
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [slot, setSlot] = useState<{ overlap: boolean; tight: boolean; before: number | null; after: number | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);
  const startsIso = zonedToIso(day, start, tz);
  const endsIso = startsIso ? new Date(new Date(startsIso).getTime() + duration * 60000).toISOString() : null;
  const totalNum = Number(total.replace(",", "."));
  const modelNum = Number(modelAmount.replace(",", "."));
  const agencyNum = Number.isFinite(totalNum) && Number.isFinite(modelNum) ? Math.round((totalNum - modelNum) * 100) / 100 : NaN;

  // Доля модели по умолчанию — от настроек тура, пока менеджер не поправил вручную.
  useEffect(() => {
    if (splitTouched) return;
    if (Number.isFinite(totalNum) && totalNum > 0) setModelAmount(String(Math.round(totalNum * board.settings.modelSharePct) / 100));
  }, [totalNum, splitTouched, board.settings.modelSharePct]);

  useEffect(() => {
    if (!startsIso || !endsIso || !modelId) return;
    let alive = true;
    setChecking(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("voyage_booking_check_slot", {
        p_tour: board.tour.id,
        p_model: modelId,
        p_starts: startsIso,
        p_ends: endsIso,
        p_exclude: booking?.id ?? null,
      });
      if (!alive) return;
      setChecking(false);
      const s = obj(data);
      setSlot({
        overlap: s.overlap === true,
        tight: s.tight === true,
        before: s.gap_before_min === null || s.gap_before_min === undefined ? null : num(s.gap_before_min),
        after: s.gap_after_min === null || s.gap_after_min === undefined ? null : num(s.gap_after_min),
      });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [board.tour.id, modelId, startsIso, endsIso, booking?.id]);

  const submit = async (confirmTight: boolean) => {
    if (!startsIso || !endsIso) return;
    setBusy(true);
    setError(null);
    const r = await saveBooking({
      id: booking?.id ?? null,
      tourId: board.tour.id,
      modelId,
      operatorId: manage ? operatorId || null : null,
      guestId,
      guestLabel: guestLabel.trim() || null,
      format,
      startsAt: startsIso,
      endsAt: endsIso,
      outcallAddress: format === "outcall" ? address : null,
      totalAmount: totalNum,
      modelAmount: modelNum,
      agencyAmount: agencyNum,
      paymentMethod: payment,
      notes: notes.trim() || null,
      confirmTight,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.code === "slot_tight" ? null : opsError(t, r.code));
      if (r.code === "slot_tight") setSlot((s) => (s ? { ...s, tight: true } : { overlap: false, tight: true, before: null, after: null }));
      return;
    }
    onSaved();
  };

  const pickGuest = (g: GuestCard) => {
    setGuestId(g.id);
    setGuestPicked(g);
    if (!guestLabel.trim()) setGuestLabel(g.displayName ?? "");
    setShowLookup(false);
  };

  const operators = board.operators ?? [];

  return (
    <Modal open wide title={booking ? t.form.titleEdit : t.form.titleNew} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.form.model}>
          <select className={INPUT} value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {board.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label={t.form.format}>
          <div className="flex gap-1.5">
            {BOOKING_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
                className={`min-h-11 flex-1 rounded-xl border text-sm sm:min-h-10 ${format === f ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400"}`}
              >
                {t.format[f]}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t.form.day}><input type="date" className={INPUT} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.form.start}><input type="time" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} step={900} /></Field>
          <Field label={t.form.duration}>
            <select className={INPUT} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {durations.map((d) => <option key={d} value={d}>{fmtDuration(d, lang)}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {startsIso && (
        <div className="mt-3 rounded-xl border border-zinc-800 px-3 py-2">
          <DualTime start={startsIso} end={endsIso} tourTz={tz} viewerTz={board.myTimezone} lang={lang} t={t} withDay />
          {checking && <p className="mt-1 text-[11px] text-zinc-500">{t.form.checking}</p>}
        </div>
      )}
      {slot?.overlap && <div className="mt-2"><Notice tone="rose">{t.form.overlap}</Notice></div>}
      {slot && !slot.overlap && slot.tight && <div className="mt-2"><Notice tone="amber">{t.form.tightWarn(slot.before, slot.after, board.settings.bufferMinutes)}</Notice></div>}

      {format === "outcall" && (
        <div className="mt-3">
          <Field label={t.form.address} hint={t.form.addressHint}>
            <input className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
          </Field>
        </div>
      )}

      <div className="mt-4 space-y-2 rounded-2xl border border-zinc-800 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.form.guestContact}</span>
          {guestId ? (
            <span className="flex items-center gap-2 text-[12px] text-zinc-300">
              {t.guests.attached}
              {guestPicked && guestPicked.status !== "neutral" && <Chip className={GUEST_TONE[guestPicked.status]}>{t.guests.status[guestPicked.status]}</Chip>}
              <button type="button" className="text-amber-200/80 underline-offset-2 hover:underline" onClick={() => { setGuestId(null); setGuestPicked(null); setShowLookup(true); }}>{t.guests.detach}</button>
            </span>
          ) : (
            <button type="button" className="text-[12px] text-amber-200/80 underline-offset-2 hover:underline" onClick={() => setShowLookup((v) => !v)}>
              {showLookup ? t.common.close : t.guests.title}
            </button>
          )}
        </div>
        {!guestId && !showLookup && <p className="text-[11px] text-zinc-500">{t.form.guestContactHint}</p>}
        {showLookup && !guestId && <GuestDesk canModerate={manage} tourId={board.tour.id} onPick={pickGuest} />}
        <Field label={t.form.guestName} hint={t.form.guestNameHint}>
          <input className={INPUT} value={guestLabel} onChange={(e) => setGuestLabel(e.target.value)} maxLength={80} />
        </Field>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label={`${t.form.total}, ${board.settings.currency}`}>
          <input className={INPUT} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        </Field>
        <Field label={t.form.modelShare} hint={t.form.autoSplit(board.settings.modelSharePct)}>
          <input className={INPUT} inputMode="decimal" value={modelAmount} onChange={(e) => { setSplitTouched(true); setModelAmount(e.target.value); }} />
        </Field>
        <Field label={t.form.agencyShare}>
          <input className={`${INPUT} opacity-70`} readOnly value={Number.isFinite(agencyNum) ? String(agencyNum) : ""} />
        </Field>
        <Field label={t.form.payment}>
          <select className={INPUT} value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{t.payment[p]}</option>)}
          </select>
        </Field>
        {manage && (
          <Field label={t.form.operatorField}>
            <select className={INPUT} value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
              <option value="">{t.form.noOperator}</option>
              {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="mt-3">
        <Field label={t.form.notes}>
          <textarea className={`${INPUT} min-h-16 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
      </div>

      {error && <div className="mt-3"><Notice tone="rose">{error}</Notice></div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {slot?.tight && !slot.overlap ? (
          <button type="button" className={BTN_GOLD} disabled={busy || !startsIso} onClick={() => submit(true)}>{busy ? t.common.saving : t.form.forceTight}</button>
        ) : (
          <button type="button" className={BTN_GOLD} disabled={busy || !startsIso || slot?.overlap === true} onClick={() => submit(false)}>{busy ? t.common.saving : t.form.save}</button>
        )}
        <button type="button" className={BTN_GHOST} onClick={onClose}>{t.common.cancel}</button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КАССА (только менеджер тура и owner)
 * ══════════════════════════════════════════════════════════════════ */

function Cashbox({ tourId, board, t, lang }: { tourId: string; board: TourBoard; t: OpsDict; lang: UiLang }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("voyage_tour_cashbox", { p_tour: tourId, p_from: null, p_to: null }).then(({ data: d, error: e }) => {
      if (!alive) return;
      if (e) setError(opsError(t, errorCode(e.message)));
      else setData(obj(d));
    });
    return () => {
      alive = false;
    };
  }, [tourId, t]);
  if (error) return <Notice tone="rose">{error}</Notice>;
  if (!data) return <p className="text-sm text-zinc-500">{t.common.loading}</p>;

  const cur = str(data.currency) || board.settings.currency;
  const m = (v: unknown) => fmtMoney(num(v), cur, lang);
  const completed = obj(data.completed);
  const pipeline = obj(data.pipeline);
  const cancelled = obj(data.cancelled);
  const names = new Map(board.models.map((x) => [x.id, x.name]));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel className="p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.cashbox.completed}</p>
          <p className="mt-1 text-2xl text-zinc-50">{m(completed.total)}</p>
          <p className="mt-1 text-[12px] text-zinc-400">{t.cashbox.bookings(num(completed.count))}</p>
          <p className="mt-2 text-[12px] text-zinc-400">{t.cashbox.model}: {m(completed.model)} · {t.cashbox.agency}: <span className="text-amber-100">{m(completed.agency)}</span></p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.cashbox.pipeline}</p>
          <p className="mt-1 text-2xl text-zinc-50">{m(pipeline.total)}</p>
          <p className="mt-1 text-[12px] text-zinc-400">{t.cashbox.bookings(num(pipeline.count))}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.cashbox.cancelled}</p>
          <p className="mt-1 text-2xl text-zinc-400">{m(cancelled.total)}</p>
          <p className="mt-1 text-[12px] text-zinc-500">{t.cashbox.bookings(num(cancelled.count))}</p>
        </Panel>
      </div>
      <ScoutCashboxBlock scout={data.scout} agency={num(completed.agency)} currency={cur} modelNames={names} lang={lang} />
      {num(completed.count) === 0 && <Notice>{t.cashbox.noData}</Notice>}
      <div className="grid gap-4 lg:grid-cols-3">
        <CashList title={t.cashbox.byModel} rows={arr(data.by_model).map((r) => { const o = obj(r); return { label: names.get(str(o.model_id)) ?? "—", value: m(o.total), sub: `${t.cashbox.model} ${m(o.model)} · ${t.cashbox.agency} ${m(o.agency)}` }; })} />
        <CashList title={t.cashbox.byOperator} rows={arr(data.by_operator).map((r) => { const o = obj(r); return { label: str(o.name) || t.cashbox.withoutOperator, value: m(o.total), sub: t.cashbox.bookings(num(o.count)) }; })} />
        <CashList title={t.cashbox.byPayment} rows={Object.entries(obj(data.by_payment)).map(([k, v]) => ({ label: t.payment[k as PaymentMethod] ?? k, value: m(v), sub: "" }))} />
      </div>
    </div>
  );
}

function CashList({ title, rows }: { title: string; rows: { label: string; value: string; sub: string }[] }) {
  return (
    <Panel className="p-4">
      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-zinc-600">—</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-[13px]">
              <span className="min-w-0">
                <span className="block truncate text-zinc-200">{r.label}</span>
                {r.sub && <span className="block text-[11px] text-zinc-500">{r.sub}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-100">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * НАСТРОЙКИ ТУРА
 * ══════════════════════════════════════════════════════════════════ */

const CURRENCIES = ["USD", "EUR", "AED", "AUD", "THB", "IDR", "SGD", "HKD", "JPY", "TRY", "GBP", "RUB", "BRL"];

function SettingsPanel({ board, t, reload }: { board: TourBoard; t: OpsDict; reload: () => Promise<void> }) {
  const [timezone, setTimezone] = useState(board.settings.exists ? board.settings.timezone : "");
  const [currency, setCurrency] = useState(board.settings.currency);
  const [share, setShare] = useState(String(board.settings.modelSharePct));
  const [buffer, setBuffer] = useState(String(board.settings.bufferMinutes));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "rose" | "emerald"; text: string } | null>(null);

  const submit = async () => {
    if (!isValidTimezone(timezone)) {
      setMsg({ tone: "rose", text: t.errors.invalid_timezone });
      return;
    }
    setBusy(true);
    const r = await saveTourSettings(board.tour.id, { timezone, currency, modelSharePct: Number(share), bufferMinutes: Number(buffer) });
    setBusy(false);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    else {
      setMsg({ tone: "emerald", text: t.settings.saved });
      await reload();
    }
  };

  return (
    <Panel className="max-w-2xl space-y-4 p-5">
      <p className="text-base text-zinc-50">{t.settings.title}</p>
      <Field label={t.settings.timezone} hint={t.settings.timezoneHint}>
        <input className={INPUT} list="voyage-tz-list" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Dubai" />
        <datalist id="voyage-tz-list">{COMMON_TIMEZONES.map((z) => <option key={z} value={z} />)}</datalist>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.settings.currency}>
          <select className={INPUT} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={t.settings.modelShare} hint={t.settings.modelShareHint}>
          <input className={INPUT} inputMode="numeric" value={share} onChange={(e) => setShare(e.target.value)} />
        </Field>
        <Field label={t.settings.buffer} hint={t.settings.bufferHint}>
          <input className={INPUT} inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
        </Field>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button type="button" className={BTN_GOLD} disabled={busy} onClick={submit}>{busy ? t.common.saving : t.common.save}</button>
    </Panel>
  );
}
