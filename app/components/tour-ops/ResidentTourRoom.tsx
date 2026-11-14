"use client";

/* ──────────────────────────────────────────────────────────────────────
 * Комната тура резидентки — /dashboard/tour-room/[id]
 *   «Моё расписание на тур» — только её заказы: время (двойное), формат,
 *     адрес при Outcall, сумма к получению, имя гостя (без телефона);
 *   «Документы и жильё» — её билет/посадочный (может загрузить сама),
 *     назначенные апартаменты с кодами, готовность.
 * Данные — voyage_tour_room_resident (только сама модель тура).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Download, KeyRound, Loader2, MapPin, Plane, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, SectionHeader } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { errorCode, parseResidentRoom, type DocKind, type ResidentRoom } from "@/lib/tour-ops/types";
import { opsError } from "@/lib/tour-ops/i18n";
import { dayKey, fmtDay, fmtDuration, fmtMoney, minutesBetween } from "@/lib/tour-ops/time";
import { Chip, DualTime, INPUT, Notice, STATUS_TONE, useOps } from "@/app/components/tour-ops/ops-ui";
import ApartmentCard from "@/app/components/tour-ops/ApartmentCard";
import { VAULT_TYPES, openVaultFile, uploadVaultFile, vaultError } from "@/app/components/tour-ops/VaultPanel";

export default function ResidentTourRoom({ tourId }: { tourId: string }) {
  const { t, lang } = useOps();
  const [room, setRoom] = useState<ResidentRoom | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<DocKind>("ticket");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error: rpcError }, { data: auth }] = await Promise.all([
      supabase.rpc("voyage_tour_room_resident", { p_tour: tourId }),
      supabase.auth.getUser(),
    ]);
    setLoading(false);
    setMe(auth.user?.id ?? null);
    if (rpcError) {
      setError(opsError(t, errorCode(rpcError.message)));
      return;
    }
    setRoom(parseResidentRoom(data));
  }, [tourId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File | null) => {
    if (!file || !me) return;
    setUploading(true);
    const code = await uploadVaultFile(tourId, me, kind, file);
    setUploading(false);
    if (code) setError(vaultError(t, code));
    else {
      setError(null);
      await load();
    }
  };

  if (loading) return <PageShell><p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p></PageShell>;
  if (!room) {
    return (
      <PageShell>
        <Link href="/dashboard" className={BTN_GHOST}><ArrowLeft className="size-3.5" /> {t.common.back}</Link>
        <div className="mt-6"><Notice tone="rose">{error ?? t.errors.forbidden}</Notice></div>
      </PageShell>
    );
  }

  const tz = room.timezone;
  const live = room.schedule.filter((b) => b.status !== "cancelled");
  const days = Array.from(new Set(room.schedule.map((b) => dayKey(b.startsAt, tz)))).sort();
  const total = live.reduce((sum, b) => sum + b.modelAmount, 0);
  const currency = room.schedule[0]?.currency ?? "USD";

  return (
    <PageShell>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-200"><ArrowLeft className="size-3.5" /> {t.common.back}</Link>
      <PageHeader
        eyebrow={t.resident.roomEyebrow}
        title={room.tour.city}
        subtitle={`${fmtDay(room.tour.departsAt, tz, lang)}${room.tour.returnsAt ? ` — ${fmtDay(room.tour.returnsAt, tz, lang)}` : ""} · ${t.resident.manager}: ${room.tour.managerName}`}
        aside={
          room.tour.flightNo || room.tour.iata ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300">
              <Plane className="size-3.5 text-amber-200/70" /> {t.resident.flight}: {[room.tour.flightNo, room.tour.iata].filter(Boolean).join(" · ")}
            </span>
          ) : undefined
        }
      />
      {error && <div className="mt-6"><Notice tone="rose">{error}</Notice></div>}

      <section className="mt-8 space-y-3">
        <SectionHeader eyebrow={t.resident.roomEyebrow} title={t.resident.scheduleTitle} icon={KeyRound} count={live.length} />
        {live.length > 0 && <p className="text-[13px] text-zinc-400">{t.resident.toReceive}: <span className="text-amber-100">{fmtMoney(total, currency, lang)}</span></p>}
        {room.schedule.length === 0 && <p className="text-sm text-zinc-500">{t.resident.scheduleEmpty}</p>}
        {days.map((d) => (
          <div key={d}>
            <p className="mb-2 mt-4 text-[11px] uppercase tracking-[0.22em] text-zinc-500">{fmtDay(room.schedule.find((b) => dayKey(b.startsAt, tz) === d)!.startsAt, tz, lang)}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {room.schedule.filter((b) => dayKey(b.startsAt, tz) === d).map((b) => (
                <Panel key={b.id} className={`p-4 ${b.status === "cancelled" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <DualTime start={b.startsAt} end={b.endsAt} tourTz={tz} viewerTz={room.myTimezone} lang={lang} t={t} size="lg" />
                    <Chip className={STATUS_TONE[b.status]}>{t.status[b.status]}</Chip>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-zinc-300">
                    <span>{t.format[b.format]}</span>
                    <span>{fmtDuration(minutesBetween(b.startsAt, b.endsAt), lang)}</span>
                    <span>{t.resident.toReceive}: <span className="text-amber-100">{fmtMoney(b.modelAmount, b.currency, lang)}</span></span>
                    {b.guestLabel && <span>{t.resident.guest}: {b.guestLabel}</span>}
                  </div>
                  {b.format === "outcall" && b.outcallAddress && (
                    <p className="mt-2 flex items-start gap-1.5 text-[13px] text-zinc-200"><MapPin className="mt-0.5 size-3.5 shrink-0 text-amber-200/70" /> {b.outcallAddress}</p>
                  )}
                  {b.status === "cancelled" && b.cancelReason && <p className="mt-1 text-[12px] text-rose-200/80">{b.cancelReason}</p>}
                </Panel>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10 space-y-3">
        <SectionHeader eyebrow={t.resident.roomEyebrow} title={t.resident.docsTitle} icon={Plane} />
        <Panel className="p-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.resident.readiness}</p>
          <div className="flex flex-wrap gap-4 text-[13px]">
            <span className={`inline-flex items-center gap-1.5 ${room.readiness.ticketUploaded ? "text-emerald-300" : "text-zinc-500"}`}>
              {room.readiness.ticketUploaded ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />} {t.resident.ticketReady}
            </span>
            <span className={`inline-flex items-center gap-1.5 ${room.readiness.checkedInAt ? "text-emerald-300" : "text-zinc-500"}`}>
              {room.readiness.checkedInAt ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />} {t.resident.checkedIn}
            </span>
          </div>
        </Panel>
        <Panel className="space-y-3 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.resident.ticket}</p>
          {room.documents.length === 0 && <p className="text-sm text-zinc-500">{t.resident.noDocs}</p>}
          <ul className="flex flex-wrap gap-2">
            {room.documents.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => openVaultFile(d.storagePath)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-800 px-3 text-[12px] text-zinc-200 hover:border-amber-200/40">
                  <Download className="size-3.5" /> {t.vault.kind[d.kind]} · {d.fileName}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${INPUT} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as DocKind)} aria-label={t.vault.title}>
              <option value="ticket">{t.vault.kind.ticket}</option>
              <option value="boarding_pass">{t.vault.kind.boarding_pass}</option>
            </select>
            <label className={`${BTN_GOLD} cursor-pointer`}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {uploading ? t.vault.uploading : t.resident.uploadMine}
              <input type="file" className="sr-only" accept={VAULT_TYPES.join(",")} disabled={uploading} onChange={(e) => void upload(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </Panel>
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.resident.housing}</p>
          {room.apartment ? <ApartmentCard a={room.apartment} t={t} /> : <p className="text-sm text-zinc-500">{t.resident.noHousing}</p>}
        </div>
      </section>
    </PageShell>
  );
}
