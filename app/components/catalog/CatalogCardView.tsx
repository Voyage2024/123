"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталожная анкета (этап 2)
 * app/components/catalog/CatalogCardView.tsx
 *
 * Одна и та же карточка у менеджера (каталог) и у резидентки («Так вас
 * видит менеджер»). Только поля белого списка из voyage_rcat_card_json.
 * Сверху Визитка и Moments тем же плеером этапа 1; фото и видео — под
 * именным водяным знаком (D3).
 * ──────────────────────────────────────────────────────────────────── */

import type { ReactNode } from "react";
import { EyeOff, Lock, MapPin, Ruler, Shirt } from "lucide-react";
import ResidentVideoViewer from "@/app/components/media/ResidentVideoViewer";
import { WatermarkLayer } from "@/app/components/media/WatermarkLayer";
import { BusyLine, FreshnessChip, KycChip, LanguagesLine } from "@/app/components/catalog/catalog-ui";
import { catalogCopy, fmtDay, type CatalogCard } from "@/lib/resident-catalog";

export function CatalogCardView({
  card,
  lang,
  watermark,
  toolbar,
}: {
  card: CatalogCard;
  lang: string;
  watermark: string | null;
  toolbar?: ReactNode;
}) {
  const c = catalogCopy(lang);
  const hasVideo = card.hasIntro || card.moments > 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-3xl leading-tight text-zinc-50">{card.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            {card.age !== null && <span>{c.years(card.age)}</span>}
            {card.city && <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden /> {card.city}</span>}
            {card.height !== null && <span className="inline-flex items-center gap-1"><Ruler size={11} aria-hidden /> {card.height} {c.cm}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KycChip level={card.kycLevel} />
            <FreshnessChip value={card.freshness} c={c} />
            {card.inCatalogSince && <span className="text-[10px] text-zinc-500">{c.cardSince(fmtDay(card.inCatalogSince, lang))}</span>}
          </div>
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </header>

      {card.videoAllowed && hasVideo ? (
        <ResidentVideoViewer residentId={card.id} context="catalog" contextId={null} lang={lang} title={card.name} recordView={false} watermark={watermark} />
      ) : (
        <p className="flex items-center gap-2 rounded-2xl border border-zinc-800/70 bg-black/20 px-3 py-3 text-xs text-zinc-500">
          {hasVideo ? <Lock size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />} {hasVideo ? c.cardVideoPrivate : c.cardNoVideo}
        </p>
      )}

      {card.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {card.photos.map((src, i) => (
            <figure key={src} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900" onContextMenu={(e) => e.preventDefault()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${card.name} · ${i + 1}`} className="h-full w-full select-none object-cover" draggable={false} loading="lazy" />
              <WatermarkLayer text={watermark} dense />
            </figure>
          ))}
        </div>
      )}

      <dl className="grid gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.cardParams}</dt>
          <dd className="mt-1 text-zinc-200">
            {card.height !== null ? `${card.height} ${c.cm}` : "—"}
            {card.bodyShown ? (
              <>{card.weight !== null && ` · ${card.weight} ${c.kg}`}{card.measurements && ` · ${card.measurements}`}</>
            ) : (
              <span className="mt-0.5 block text-[11px] text-zinc-500">{c.cardBodyHidden}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.cardSizes}</dt>
          <dd className="mt-1 inline-flex items-center gap-1 text-zinc-200"><Shirt size={12} aria-hidden /> {card.clothingSize ?? "—"}{card.shoeSize !== null ? ` · EU ${card.shoeSize}` : ""}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.cardLanguages}</dt>
          <dd className="mt-1">{card.languages.length ? <LanguagesLine languages={card.languages} /> : "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.cardBusy}</dt>
          <dd className="mt-1"><BusyLine busy={card.busy} lang={lang} c={c} /></dd>
        </div>
      </dl>
      {watermark && <p className="text-[10px] text-zinc-600">{c.catWatermarkNote}</p>}
    </div>
  );
}

export default CatalogCardView;
