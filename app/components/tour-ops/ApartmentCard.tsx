"use client";

/* Карточка апартаментов: адрес, карта, коды, водитель. «Скопировать гостю» —
 * только адрес, карта, подъезд и домофон (код сейфа гостю не уходит). */

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { Apartment } from "@/lib/tour-ops/types";
import type { OpsDict } from "@/lib/tour-ops/i18n";
import { CopyButton } from "@/app/components/tour-ops/ops-ui";

export function guestDirections(a: Pick<Apartment, "address" | "mapUrl" | "entranceCode" | "intercomCode">, t: OpsDict): string {
  return [
    a.address,
    a.mapUrl,
    a.entranceCode ? `${t.apartment.entrance}: ${a.entranceCode}` : null,
    a.intercomCode ? `${t.apartment.intercom}: ${a.intercomCode}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ApartmentCard({
  a,
  t,
  onEdit,
  onDelete,
}: {
  a: Omit<Apartment, "tourId">;
  t: OpsDict;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const rows: [string, string | null][] = [
    [t.apartment.entrance, a.entranceCode],
    [t.apartment.intercom, a.intercomCode],
    [t.apartment.safe, a.safeCode],
    [t.apartment.wifi, a.wifi],
    [t.apartment.host, a.hostContact],
  ];
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-50">{a.title}</p>
          <p className="mt-0.5 text-[13px] text-zinc-300">{a.address}</p>
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button type="button" onClick={onEdit} aria-label={t.common.edit} className="inline-flex size-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"><Pencil className="size-3.5" /></button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label={t.common.remove} className="inline-flex size-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-rose-200"><Trash2 className="size-3.5" /></button>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="truncate font-mono text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
      {a.notes && <p className="mt-2 whitespace-pre-line text-[12px] text-zinc-400">{a.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={guestDirections(a, t)} label={t.apartment.copyForGuest} copied={t.common.copied} />
        {a.mapUrl && (
          <a href={a.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-700/80 px-3 text-[11px] text-zinc-300 hover:border-amber-200/40 hover:text-amber-100">
            {t.apartment.openMap} <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </article>
  );
}
