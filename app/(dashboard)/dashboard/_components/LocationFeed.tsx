"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · лента локаций — новые туры и открытые кастинги в городах,
 * на которые подписана резидентка
 * app/(dashboard)/dashboard/_components/LocationFeed.tsx
 *
 * Строки пишет база (resident_location_feed) в момент публикации тура или
 * открытия кастинга — со снимком условий. Та же запись уходит в Telegram
 * (шаблон location_update), если Telegram привязан и тумблер включён.
 * ──────────────────────────────────────────────────────────────────── */

import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCheck, HandCoins, Inbox, MapPin, Plane, Ruler, Sparkles } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { countryFlag, countryName } from "@/lib/countries";
import {
  REGION_PAGE,
  markLocationFeedRead,
  pickText,
  useLocationFeed,
  type FeedItem,
} from "@/lib/map-subscriptions";

type Payer = "manager" | "participant" | "split";

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  markAll: string;
  empty: string;
  emptyHint: string;
  loadError: string;
  tourNew: string;
  castingOpen: string;
  fee: string;
  dates: string;
  applyUntil: string;
  slots: (n: number) => string;
  height: (n: number) => string;
  flight: string;
  hotel: string;
  payers: Record<Payer, string>;
  openCasting: string;
  openRegion: string;
  isNew: string;
};

const T: Record<Lang, Copy> = {
  RU: {
    eyebrow: "Лента локаций",
    title: "Новое в ваших городах",
    subtitle: "Туры и кастинги в локациях, на которые вы подписаны, — с условиями на момент публикации.",
    markAll: "Прочитано",
    empty: "Пока тихо.",
    emptyHint: "Подпишитесь на города выше — новые туры и кастинги появятся здесь.",
    loadError: "Не удалось загрузить ленту.",
    tourNew: "Новый тур",
    castingOpen: "Открыт кастинг",
    fee: "Гонорар",
    dates: "Даты",
    applyUntil: "Отклик до",
    slots: (n) => `Мест: ${n}`,
    height: (n) => `Рост от ${n} см`,
    flight: "Перелёт",
    hotel: "Отель",
    payers: { manager: "за счёт организатора", participant: "за свой счёт", split: "50/50" },
    openCasting: "Откликнуться",
    openRegion: "Смотреть на карте",
    isNew: "Новое",
  },
  EN: {
    eyebrow: "Locations feed",
    title: "New in your cities",
    subtitle: "Tours and castings in the locations you follow — with the terms as published.",
    markAll: "Mark as read",
    empty: "All quiet for now.",
    emptyHint: "Subscribe to cities above — new tours and castings will appear here.",
    loadError: "Could not load the feed.",
    tourNew: "New tour",
    castingOpen: "Casting open",
    fee: "Fee",
    dates: "Dates",
    applyUntil: "Apply by",
    slots: (n) => `Slots: ${n}`,
    height: (n) => `Height from ${n} cm`,
    flight: "Flight",
    hotel: "Hotel",
    payers: { manager: "covered by organizer", participant: "self-paid", split: "50/50" },
    openCasting: "Respond",
    openRegion: "See on the map",
    isNew: "New",
  },
  ES: {
    eyebrow: "Feed de ubicaciones",
    title: "Novedades en tus ciudades",
    subtitle: "Tours y castings en las ubicaciones que sigues, con las condiciones publicadas.",
    markAll: "Marcar como leído",
    empty: "Todo tranquilo por ahora.",
    emptyHint: "Suscríbete a ciudades arriba: aquí aparecerán tours y castings nuevos.",
    loadError: "No se pudo cargar el feed.",
    tourNew: "Nuevo tour",
    castingOpen: "Casting abierto",
    fee: "Honorario",
    dates: "Fechas",
    applyUntil: "Solicitar hasta",
    slots: (n) => `Plazas: ${n}`,
    height: (n) => `Altura desde ${n} cm`,
    flight: "Vuelo",
    hotel: "Hotel",
    payers: { manager: "a cargo del organizador", participant: "por tu cuenta", split: "50/50" },
    openCasting: "Responder",
    openRegion: "Ver en el mapa",
    isNew: "Nuevo",
  },
  PT: {
    eyebrow: "Feed de localizações",
    title: "Novidades nas suas cidades",
    subtitle: "Tours e castings nas localizações que você segue, com as condições publicadas.",
    markAll: "Marcar como lido",
    empty: "Tudo calmo por enquanto.",
    emptyHint: "Assine cidades acima — tours e castings novos aparecerão aqui.",
    loadError: "Não foi possível carregar o feed.",
    tourNew: "Novo tour",
    castingOpen: "Casting aberto",
    fee: "Cachê",
    dates: "Datas",
    applyUntil: "Candidatura até",
    slots: (n) => `Vagas: ${n}`,
    height: (n) => `Altura a partir de ${n} cm`,
    flight: "Voo",
    hotel: "Hotel",
    payers: { manager: "pago pelo organizador", participant: "por sua conta", split: "50/50" },
    openCasting: "Responder",
    openRegion: "Ver no mapa",
    isNew: "Novo",
  },
};

const LOCALE: Record<Lang, string> = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-PT" };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function formatDate(value: unknown, lang: Lang): string {
  const raw = text(value);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short", timeZone: "UTC" });
}

function formatFee(amount: unknown, currency: unknown, lang: Lang): string {
  const n = Number(text(amount));
  const cur = text(currency);
  if (!Number.isFinite(n) || !cur) return "";
  try {
    return new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}

function payer(value: unknown): Payer | null {
  return value === "manager" || value === "participant" || value === "split" ? value : null;
}

function FeedCard({ item, lang, t }: { item: FeedItem; lang: Lang; t: Copy }) {
  const p = item.payload;
  const isCasting = item.kind === "casting_open";
  const city = pickText(p.hub_name_i18n, lang, text(p.city));
  const cc = text(p.country_code);
  const title = pickText(p.title_i18n, lang);
  const conditions = isCasting ? pickText(p.brief_i18n, lang) : pickText(p.conditions_i18n, lang);
  const fee = formatFee(p.fee_amount, p.fee_currency, lang);
  const from = formatDate(p.starts_on, lang);
  const to = formatDate(p.ends_on, lang);
  const until = formatDate(p.closes_at, lang);
  const slots = Number(text(p.slots)) || 0;
  const height = Number(text(p.height_min)) || 0;
  const flight = payer(p.flight_paid_by);
  const hotel = payer(p.hotel_paid_by);
  const unread = !item.readAt;
  const href = isCasting ? "/dashboard/castings" : REGION_PAGE[text(p.region).toLowerCase()] ?? "/dashboard/map";

  return (
    <li
      className={`rounded-2xl border p-4 transition sm:p-5 ${
        unread ? "border-[#c9a961]/30 bg-[#c9a961]/[0.04]" : "border-white/[0.06] bg-zinc-900/25"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
        <span className={`inline-flex items-center gap-1.5 ${isCasting ? "text-[#e6d3a3]" : "text-sky-200/80"}`}>
          {isCasting ? <Sparkles size={11} /> : <Plane size={11} />}
          {isCasting ? t.castingOpen : t.tourNew}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-zinc-300">
          <MapPin size={11} className="text-zinc-500" />
          {countryFlag(cc)} {city}
          {cc ? `, ${countryName(cc, lang)}` : ""}
        </span>
        {unread && (
          <span className="ml-auto rounded-full bg-[#c9a961]/20 px-2 py-0.5 text-[9px] tracking-[0.2em] text-[#f1e3bd]">{t.isNew}</span>
        )}
      </div>

      {title && <h3 className="mt-2 font-serif text-xl font-light text-zinc-50">{title}</h3>}

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-zinc-400">
        {fee && (
          <div className="inline-flex items-center gap-1.5">
            <HandCoins size={12} className="text-zinc-500" />
            <dt className="sr-only">{t.fee}</dt>
            <dd className="text-zinc-200">{fee}</dd>
          </div>
        )}
        {from && (
          <div className="inline-flex items-center gap-1.5">
            <CalendarDays size={12} className="text-zinc-500" />
            <dt className="sr-only">{t.dates}</dt>
            <dd>{to && to !== from ? `${from} – ${to}` : from}</dd>
          </div>
        )}
        {until && (
          <div>
            <dt className="inline">{t.applyUntil}: </dt>
            <dd className="inline text-zinc-200">{until}</dd>
          </div>
        )}
        {slots > 0 && <div>{t.slots(slots)}</div>}
        {height > 0 && (
          <div className="inline-flex items-center gap-1.5">
            <Ruler size={12} className="text-zinc-500" />
            {t.height(height)}
          </div>
        )}
        {flight && (
          <div>
            {t.flight}: {t.payers[flight]}
          </div>
        )}
        {hotel && (
          <div>
            {t.hotel}: {t.payers[hotel]}
          </div>
        )}
      </dl>

      {conditions && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-zinc-400">{conditions}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] text-zinc-600">{formatDate(item.createdAt, lang)}</span>
        <Link
          href={href}
          onClick={() => {
            if (unread) void markLocationFeedRead([item.id]);
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#c9a961]/30 px-4 text-[10px] uppercase tracking-[0.2em] text-[#e6d3a3] transition hover:bg-[#c9a961]/10"
        >
          {isCasting ? t.openCasting : t.openRegion}
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </li>
  );
}

export default function LocationFeed() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.RU;
  const feed = useLocationFeed(30);
  const unread = feed.data.filter((item) => !item.readAt).length;

  return (
    <section id="location-feed" className="mt-8 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-[#c9a961]/80">
            <Inbox size={12} /> {t.eyebrow}
            {unread > 0 && <span className="rounded-full bg-[#c9a961] px-1.5 text-[9px] font-semibold tracking-normal text-zinc-950">{unread}</span>}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-light text-zinc-50">{t.title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{t.subtitle}</p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() =>
              void markLocationFeedRead().then((ok) => {
                if (ok) void feed.reload();
              })
            }
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 px-4 text-[10px] uppercase tracking-[0.2em] text-zinc-300 transition hover:border-[#c9a961]/40 hover:text-[#e6d3a3]"
          >
            <CheckCheck size={13} /> {t.markAll}
          </button>
        )}
      </div>

      {feed.loading ? (
        <div className="mt-5 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-900/60" />
          ))}
        </div>
      ) : feed.error ? (
        <p className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">{t.loadError}</p>
      ) : feed.data.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-300">{t.empty}</p>
          <p className="mt-1 text-xs text-zinc-500">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {feed.data.map((item) => (
            <FeedCard key={item.id} item={item} lang={lang} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}
