"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ИНТЕРАКТИВНАЯ КАРТА — app/(dashboard)/dashboard/map/page.tsx
 *
 * Единый стиль кабинета: шапка-объяснялка (PageExplainerHeader) →
 * четыре региона с живым числом открытых локаций (map_hubs.is_active) →
 * подсказки «как читать карту» → путь от отклика до баллов.
 *
 * Менеджер видит заглушку (ManagerMapGate): карта — пространство резиденток.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  BedDouble,
  Compass,
  Globe2,
  HandCoins,
  Map as MapIcon,
  MapPin,
  MousePointerClick,
  Plane,
  Send,
  Stamp,
} from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import ManagerMapGate from "@/app/components/ManagerMapGate";
import PageExplainerHeader, {
  ResidentPageShell,
  type ExplainerDict,
} from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";

type RegionKey = "americas" | "apac" | "europe" | "mena";
type Region = { key: RegionKey; title: string; subtitle: string; href: string; map: string; mood: string };
type Copy = {
  regions: Region[];
  open: string;
  locations: (n: number) => string;
  soon: string;
  hintsTitle: string;
  hints: { title: string; text: string }[];
  journeyTitle: string;
  journey: { title: string; text: string }[];
  applications: string;
};

const HEADER: ExplainerDict = {
  RU: {
    eyebrow: "VOYAGE · Карта клуба",
    title: "Интерактивная карта",
    subtitle:
      "Вся география клуба на одном экране: регионы, города и открытые локации с условиями. Выберите направление, изучите карточку и откликнитесь в одно касание — ответственный менеджер увидит заявку сразу.",
    steps: ["Выберите регион", "Откройте точку на карте", "Нажмите «Откликнуться»"],
    cards: [
      {
        title: "Карточка локации · всё заранее",
        text: "Ставки, проживание и сервисы указаны до отклика — никаких сюрпризов на месте. Одобрение заявки приходит в Telegram, если оповещения включены в настройках.",
        cta: "Мои заявки",
      },
      {
        title: "Тур · баллы и штамп",
        text: "Завершённый тур приносит баллы Influence Index, а первая поездка в страну — штамп в паспорт. Несколько нужных стран открывают легендарное комбо.",
        cta: "Паспорт и баллы",
      },
    ],
  },
  EN: {
    eyebrow: "VOYAGE · Club map",
    title: "Interactive map",
    subtitle:
      "The club's whole geography on one screen: regions, cities and open locations with their terms. Pick a destination, study the card and apply in one tap — the responsible manager sees it instantly.",
    steps: ["Choose a region", "Open a point on the map", "Tap “Apply”"],
    cards: [
      {
        title: "Location card · everything upfront",
        text: "Rates, accommodation and services are listed before you apply — no surprises on arrival. Approval arrives in Telegram if notifications are on in settings.",
        cta: "My applications",
      },
      {
        title: "Tour · points and a stamp",
        text: "A completed tour earns Influence Index points, and the first trip to a country adds a passport stamp. The right set of countries unlocks a legendary combo.",
        cta: "Passport & points",
      },
    ],
  },
  ES: {
    eyebrow: "VOYAGE · Mapa del club",
    title: "Mapa interactivo",
    subtitle:
      "Toda la geografía del club en una pantalla: regiones, ciudades y ubicaciones abiertas con sus condiciones. Elige un destino, revisa la tarjeta y solicita con un toque.",
    steps: ["Elige una región", "Abre un punto del mapa", "Pulsa «Solicitar»"],
    cards: [
      {
        title: "Tarjeta de ubicación · todo por adelantado",
        text: "Tarifas, alojamiento y servicios se muestran antes de solicitar. La aprobación llega por Telegram si tienes los avisos activados.",
        cta: "Mis solicitudes",
      },
      {
        title: "Tour · puntos y sello",
        text: "Un tour completado suma puntos al Influence Index y el primer viaje a un país añade un sello al pasaporte.",
        cta: "Pasaporte y puntos",
      },
    ],
  },
  PT: {
    eyebrow: "VOYAGE · Mapa do clube",
    title: "Mapa interativo",
    subtitle:
      "Toda a geografia do clube em uma tela: regiões, cidades e localizações abertas com as condições. Escolha um destino, veja o cartão e candidate-se com um toque.",
    steps: ["Escolha uma região", "Abra um ponto no mapa", "Toque em «Candidatar-se»"],
    cards: [
      {
        title: "Cartão da localização · tudo antes",
        text: "Cachês, hospedagem e serviços aparecem antes da candidatura. A aprovação chega no Telegram se os avisos estiverem ativos.",
        cta: "Minhas candidaturas",
      },
      {
        title: "Tour · pontos e carimbo",
        text: "Um tour concluído soma pontos ao Influence Index e a primeira viagem a um país adiciona um carimbo ao passaporte.",
        cta: "Passaporte e pontos",
      },
    ],
  },
};

const T: Record<Lang, Copy> = {
  RU: {
    regions: [
      { key: "europe", title: "Европа", subtitle: "Столицы моды, Лазурный берег, острова", href: "/destinations/europe", map: "/map-europe.jpg", mood: "Показы · съёмки · яхты" },
      { key: "mena", title: "Ближний Восток", subtitle: "Персидский залив и MENA", href: "/destinations/middle-east", map: "/map-mena.jpg", mood: "Ивенты · кампейны · резиденции" },
      { key: "apac", title: "Азия и Тихий океан", subtitle: "Азия, острова и Океания", href: "/destinations/asia-pacific", map: "/map-apac.jpg", mood: "Съёмки · курорты · длинные туры" },
      { key: "americas", title: "Америка", subtitle: "Северная и Южная Америка", href: "/destinations/americas", map: "/map-americas.jpg", mood: "Кампейны · шоу · сезоны" },
    ],
    open: "Открыть регион",
    locations: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "локация" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "локации" : "локаций"} открыто`,
    soon: "Скоро новые локации",
    hintsTitle: "Как читать карту",
    hints: [
      { title: "Золотая точка", text: "Открытая локация: можно откликнуться прямо сейчас." },
      { title: "Ставки", text: "Вилка гонорара за день или проект — до отклика." },
      { title: "Проживание", text: "Тип размещения и кто его оплачивает." },
      { title: "Штамп", text: "Первая поездка в страну добавляет штамп и бонусные баллы." },
    ],
    journeyTitle: "От отклика до баллов",
    journey: [
      { title: "Отклик", text: "Заявка уходит ответственному менеджеру локации." },
      { title: "Одобрение", text: "Статус меняется в «Мои заявки», в Telegram — уведомление." },
      { title: "Тур", text: "После завершения клуб закрывает заявку." },
      { title: "Баллы", text: "Начисляются автоматически: тур, штамп, комбо — с источником в выписке." },
    ],
    applications: "Мои заявки",
  },
  EN: {
    regions: [
      { key: "europe", title: "Europe", subtitle: "Fashion capitals, the Riviera, islands", href: "/destinations/europe", map: "/map-europe.jpg", mood: "Shows · shoots · yachts" },
      { key: "mena", title: "Middle East", subtitle: "The Gulf and MENA", href: "/destinations/middle-east", map: "/map-mena.jpg", mood: "Events · campaigns · residences" },
      { key: "apac", title: "Asia Pacific", subtitle: "Asia, islands and Oceania", href: "/destinations/asia-pacific", map: "/map-apac.jpg", mood: "Shoots · resorts · long tours" },
      { key: "americas", title: "The Americas", subtitle: "North and South America", href: "/destinations/americas", map: "/map-americas.jpg", mood: "Campaigns · shows · seasons" },
    ],
    open: "Explore region",
    locations: (n) => `${n} open location${n === 1 ? "" : "s"}`,
    soon: "New locations coming soon",
    hintsTitle: "How to read the map",
    hints: [
      { title: "Gold point", text: "An open location: you can apply right now." },
      { title: "Rates", text: "The fee range per day or project — before you apply." },
      { title: "Accommodation", text: "Type of stay and who covers it." },
      { title: "Stamp", text: "Your first trip to a country adds a stamp and bonus points." },
    ],
    journeyTitle: "From application to points",
    journey: [
      { title: "Apply", text: "The application goes to the location's responsible manager." },
      { title: "Approval", text: "The status updates in “My applications”, with a Telegram alert." },
      { title: "Tour", text: "Once it's done, the club completes the application." },
      { title: "Points", text: "Awarded automatically: tour, stamp, combo — each with its source." },
    ],
    applications: "My applications",
  },
  ES: {
    regions: [
      { key: "europe", title: "Europa", subtitle: "Capitales de la moda, la Riviera, islas", href: "/destinations/europe", map: "/map-europe.jpg", mood: "Desfiles · sesiones · yates" },
      { key: "mena", title: "Oriente Medio", subtitle: "El Golfo y MENA", href: "/destinations/middle-east", map: "/map-mena.jpg", mood: "Eventos · campañas · residencias" },
      { key: "apac", title: "Asia-Pacífico", subtitle: "Asia, islas y Oceanía", href: "/destinations/asia-pacific", map: "/map-apac.jpg", mood: "Sesiones · resorts · tours largos" },
      { key: "americas", title: "Américas", subtitle: "América del Norte y del Sur", href: "/destinations/americas", map: "/map-americas.jpg", mood: "Campañas · shows · temporadas" },
    ],
    open: "Explorar región",
    locations: (n) => `${n} ubicaci${n === 1 ? "ón abierta" : "ones abiertas"}`,
    soon: "Pronto habrá nuevas ubicaciones",
    hintsTitle: "Cómo leer el mapa",
    hints: [
      { title: "Punto dorado", text: "Ubicación abierta: puedes solicitar ahora." },
      { title: "Tarifas", text: "Rango de honorarios por día o proyecto." },
      { title: "Alojamiento", text: "Tipo de estancia y quién la paga." },
      { title: "Sello", text: "El primer viaje a un país añade un sello y puntos extra." },
    ],
    journeyTitle: "De la solicitud a los puntos",
    journey: [
      { title: "Solicitud", text: "Llega al gerente responsable de la ubicación." },
      { title: "Aprobación", text: "El estado cambia en «Mis solicitudes», con aviso en Telegram." },
      { title: "Tour", text: "Al terminar, el club completa la solicitud." },
      { title: "Puntos", text: "Se suman solos: tour, sello, combo — con su origen." },
    ],
    applications: "Mis solicitudes",
  },
  PT: {
    regions: [
      { key: "europe", title: "Europa", subtitle: "Capitais da moda, Riviera, ilhas", href: "/destinations/europe", map: "/map-europe.jpg", mood: "Desfiles · ensaios · iates" },
      { key: "mena", title: "Oriente Médio", subtitle: "Golfo e MENA", href: "/destinations/middle-east", map: "/map-mena.jpg", mood: "Eventos · campanhas · residências" },
      { key: "apac", title: "Ásia-Pacífico", subtitle: "Ásia, ilhas e Oceania", href: "/destinations/asia-pacific", map: "/map-apac.jpg", mood: "Ensaios · resorts · tours longos" },
      { key: "americas", title: "Américas", subtitle: "América do Norte e do Sul", href: "/destinations/americas", map: "/map-americas.jpg", mood: "Campanhas · shows · temporadas" },
    ],
    open: "Explorar região",
    locations: (n) => `${n} localiza${n === 1 ? "ção aberta" : "ções abertas"}`,
    soon: "Novas localizações em breve",
    hintsTitle: "Como ler o mapa",
    hints: [
      { title: "Ponto dourado", text: "Localização aberta: candidate-se agora." },
      { title: "Cachês", text: "Faixa de cachê por dia ou projeto." },
      { title: "Hospedagem", text: "Tipo de estadia e quem paga." },
      { title: "Carimbo", text: "A primeira viagem a um país adiciona carimbo e pontos extras." },
    ],
    journeyTitle: "Da candidatura aos pontos",
    journey: [
      { title: "Candidatura", text: "Vai para o gerente responsável da localização." },
      { title: "Aprovação", text: "O status muda em «Minhas candidaturas», com aviso no Telegram." },
      { title: "Tour", text: "Ao final, o clube conclui a candidatura." },
      { title: "Pontos", text: "Somados automaticamente: tour, carimbo, combo — com a origem." },
    ],
    applications: "Minhas candidaturas",
  },
};

const HINT_ICONS = [MapPin, HandCoins, BedDouble, Stamp] as const;
const JOURNEY_ICONS = [Send, BadgeCheck, Plane, Stamp] as const;

/** Число открытых локаций по регионам; null — не удалось загрузить (счётчик не показываем) */
function useOpenLocations() {
  const [counts, setCounts] = useState<Partial<Record<RegionKey, number>> | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase
      .from("map_hubs")
      .select("region")
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (!alive || error) return;
        const next: Partial<Record<RegionKey, number>> = {};
        for (const row of data ?? []) {
          const key = String((row as { region?: unknown }).region ?? "") as RegionKey;
          next[key] = (next[key] ?? 0) + 1;
        }
        setCounts(next);
      });
    return () => {
      alive = false;
    };
  }, []);
  return counts;
}

function MapContent() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.RU;
  const counts = useOpenLocations();

  return (
    <ResidentPageShell>
      <PageExplainerHeader
        copy={HEADER}
        icon={MapIcon}
        eyebrowIcon={Compass}
        stepIcons={[Globe2, MousePointerClick, Send]}
        cards={[
          { icon: BedDouble, href: "/dashboard/applications" },
          { icon: Stamp, href: "/dashboard/gamification" },
        ]}
      />

      {/* ── Регионы ─────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        {t.regions.map((region) => {
          const n = counts?.[region.key] ?? 0;
          return (
            <Link
              key={region.key}
              href={region.href}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-zinc-950 transition duration-500 hover:-translate-y-0.5 hover:border-[#c9a961]/35 hover:shadow-[0_24px_60px_-30px_rgba(201,169,97,0.35)]"
            >
              <div className="relative h-48 overflow-hidden sm:h-56">
                {/* регионы — локальные изображения сайта */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={region.map}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover opacity-40 saturate-[0.8] transition duration-700 group-hover:scale-[1.04] group-hover:opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(201,169,97,0.12),transparent_70%)]" />
                <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/55 px-3 py-1 text-[9px] uppercase tracking-[0.3em] text-[#e6d3a3]/80 backdrop-blur">
                  <Globe2 size={11} />
                  {region.mood}
                </div>
                <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/55 text-zinc-200 backdrop-blur transition group-hover:border-[#c9a961]/40 group-hover:text-[#e6d3a3]">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <div className="relative -mt-14 p-5 sm:p-6">
                <h2 className="font-serif text-3xl font-light tracking-tight text-zinc-50">{region.title}</h2>
                <p className="mt-1 text-xs text-zinc-500">{region.subtitle}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                  {counts === null ? (
                    <span className="h-3 w-28 animate-pulse rounded bg-zinc-800/70" />
                  ) : (
                    <span className={`flex items-center gap-2 text-[11px] ${n > 0 ? "text-[#e6d3a3]" : "text-zinc-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${n > 0 ? "bg-[#c9a961] shadow-[0_0_10px_rgba(201,169,97,0.8)]" : "bg-zinc-600"}`} />
                      {n > 0 ? t.locations(n) : t.soon}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 transition group-hover:text-[#e6d3a3]">{t.open}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* ── Как читать карту ───────────────────────────────── */}
      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[#c9a961]/70">{t.hintsTitle}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.hints.map((hint, i) => {
            const Icon = HINT_ICONS[i];
            return (
              <div key={hint.title} className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-4">
                <Icon size={16} className="text-[#c9a961]/80" />
                <p className="mt-3 text-sm text-zinc-100">{hint.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{hint.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Путь заявки ────────────────────────────────────── */}
      <section className="mt-12 rounded-3xl border border-[#c9a961]/15 bg-gradient-to-br from-[#c9a961]/[0.05] via-zinc-950 to-zinc-950 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-light text-zinc-50">{t.journeyTitle}</h2>
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a961]/30 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#e6d3a3] transition hover:bg-[#c9a961]/10"
          >
            {t.applications}
            <ArrowUpRight size={12} />
          </Link>
        </div>
        <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.journey.map((step, i) => {
            const Icon = JOURNEY_ICONS[i];
            return (
              <li key={step.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a961]/25 bg-zinc-950 text-[#e6d3a3]">
                    <Icon size={15} />
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600">0{i + 1}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-100">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </ResidentPageShell>
  );
}

export default function DashboardMapPage() {
  return (
    <ManagerMapGate>
      <MapContent />
    </ManagerMapGate>
  );
}
