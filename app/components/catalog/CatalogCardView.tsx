"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталожная анкета (этап 2 → каталог 2.0, этап A)
 * app/components/catalog/CatalogCardView.tsx
 *
 * Одна и та же карточка у менеджера (каталог) и у резидентки («Так вас
 * видит менеджер»). Только поля белого списка из voyage_rcat_card_json.
 *
 * Этап A: фото — основа. Сверху галерея (главное фото + миниатюры +
 * полный экран). Переключатель «Фото · Видео» появляется, только если
 * видео есть и резидентка открыла его каталогу; иначе о видео в карточке
 * нет ни слова (никаких «Без видео» и «видео только для своих»).
 * Значки — только положительные: KYC, «Актуально», «Видео».
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useState, type ReactNode } from "react";
import { Images, MapPin, PlayCircle, Ruler, Shirt } from "lucide-react";
import ResidentVideoViewer from "@/app/components/media/ResidentVideoViewer";
import { CatalogGallery } from "@/app/components/catalog/CatalogGallery";
import { BusyLine, FreshnessChip, KycChip, LanguagesLine, UpdatedLine, VideoChip } from "@/app/components/catalog/catalog-ui";
import { catalogCopy, fmtDay, photoFirstCopy, type CatalogCard } from "@/lib/resident-catalog";

type Tab = "photos" | "video";

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
  const pf = photoFirstCopy(lang);
  // видео показываем, только если база сказала: есть и открыто каталогу
  const showVideo = card.videoAllowed && card.hasVideo;
  const [tab, setTab] = useState<Tab>("photos");
  useEffect(() => { setTab("photos"); }, [card.id]);
  const active: Tab = showVideo && tab === "video" ? "video" : "photos";

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
          {/* строка доверия: только то, что есть */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KycChip level={card.kycLevel} />
            <FreshnessChip value={card.freshness} c={c} />
            <VideoChip show={showVideo} label={pf.badgeVideo} />
            {card.photos.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><Images size={10} aria-hidden /> {pf.photos(card.photos.length)}</span>
            )}
          </div>
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </header>

      {showVideo && (
        <div role="tablist" aria-label={card.name} className="inline-flex rounded-full border border-zinc-800 bg-zinc-900/60 p-1">
          {(["photos", "video"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={active === t} onClick={() => setTab(t)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-xs transition ${active === t ? "bg-[#c9a961] font-semibold text-zinc-950" : "text-zinc-300 hover:text-amber-100"}`}>
              {t === "photos" ? <Images size={13} aria-hidden /> : <PlayCircle size={13} aria-hidden />}
              {t === "photos" ? pf.tabPhotos : pf.tabVideo}
            </button>
          ))}
        </div>
      )}

      {active === "video" ? (
        <ResidentVideoViewer residentId={card.id} context="catalog" contextId={null} lang={lang} title={card.name} recordView={false} watermark={watermark} />
      ) : (
        <CatalogGallery photos={card.photos} name={card.name} watermark={watermark} lang={lang} />
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
        {(card.updatedAt || card.inCatalogSince) && (
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{pf.actuality}</dt>
            <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              <UpdatedLine at={card.updatedAt} kind={card.updatedKind} lang={lang} />
              {card.inCatalogSince && <span className="text-[11px] text-zinc-500">{c.cardSince(fmtDay(card.inCatalogSince, lang))}</span>}
            </dd>
          </div>
        )}
      </dl>
      {watermark && <p className="text-[10px] text-zinc-600">{showVideo ? c.catWatermarkNote : pf.watermarkPhotos}</p>}
    </div>
  );
}

export default CatalogCardView;
