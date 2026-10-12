"use client";

import Link from "next/link";
import { ArrowUpRight, Compass, Globe2, MapPin, Sparkles } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";

type Region = { title: string; subtitle: string; href: string; map: string };
type Copy = { eyebrow: string; title: string; subtitle: string; openMap: string; regions: Region[]; note: string };

const T: Record<Lang, Copy> = {
  EN: {
    eyebrow: "VOYAGE / DISCOVERY", title: "Interactive map", subtitle: "Choose a region to explore the club's destination network and available locations.", openMap: "Explore region", note: "Event cards link directly to the relevant regional map whenever the location can be identified.",
    regions: [
      { title: "The Americas", subtitle: "North and South America", href: "/destinations/americas", map: "/map-americas.jpg" },
      { title: "Asia Pacific", subtitle: "Asia, islands and Pacific destinations", href: "/destinations/asia-pacific", map: "/map-apac.jpg" },
      { title: "Europe", subtitle: "European hubs and routes", href: "/destinations/europe", map: "/map-europe.jpg" },
      { title: "Middle East", subtitle: "Gulf and MENA destinations", href: "/destinations/middle-east", map: "/map-mena.jpg" },
    ],
  },
  RU: {
    eyebrow: "VOYAGE / ОТКРЫТИЯ", title: "Интерактивная карта", subtitle: "Выберите регион, чтобы изучить географию клуба, направления и доступные локации.", openMap: "Открыть регион", note: "Карточки мероприятий ведут на региональную карту, когда регион можно определить по локации.",
    regions: [
      { title: "Америка", subtitle: "Северная и Южная Америка", href: "/destinations/americas", map: "/map-americas.jpg" },
      { title: "Азиатско-Тихоокеанский регион", subtitle: "Азия, острова и Тихоокеанский регион", href: "/destinations/asia-pacific", map: "/map-apac.jpg" },
      { title: "Европа", subtitle: "Европейские хабы и маршруты", href: "/destinations/europe", map: "/map-europe.jpg" },
      { title: "Ближний Восток", subtitle: "Персидский залив и MENA", href: "/destinations/middle-east", map: "/map-mena.jpg" },
    ],
  },
  ES: {
    eyebrow: "VOYAGE / DESCUBRIR", title: "Mapa interactivo", subtitle: "Elige una región para explorar los destinos y las ubicaciones disponibles del club.", openMap: "Explorar región", note: "Las tarjetas de eventos enlazan al mapa regional correspondiente cuando se puede identificar la ubicación.",
    regions: [
      { title: "Américas", subtitle: "América del Norte y del Sur", href: "/destinations/americas", map: "/map-americas.jpg" },
      { title: "Asia-Pacífico", subtitle: "Asia, islas y destinos del Pacífico", href: "/destinations/asia-pacific", map: "/map-apac.jpg" },
      { title: "Europa", subtitle: "Centros y rutas europeas", href: "/destinations/europe", map: "/map-europe.jpg" },
      { title: "Oriente Medio", subtitle: "Golfo y destinos MENA", href: "/destinations/middle-east", map: "/map-mena.jpg" },
    ],
  },
  PT: {
    eyebrow: "VOYAGE / DESCOBRIR", title: "Mapa interativo", subtitle: "Escolha uma região para explorar destinos e localizações disponíveis do clube.", openMap: "Explorar região", note: "Os cartões de eventos direcionam ao mapa regional correspondente quando a localização pode ser identificada.",
    regions: [
      { title: "Américas", subtitle: "América do Norte e do Sul", href: "/destinations/americas", map: "/map-americas.jpg" },
      { title: "Ásia-Pacífico", subtitle: "Ásia, ilhas e destinos do Pacífico", href: "/destinations/asia-pacific", map: "/map-apac.jpg" },
      { title: "Europa", subtitle: "Hubs e rotas europeias", href: "/destinations/europe", map: "/map-europe.jpg" },
      { title: "Oriente Médio", subtitle: "Golfo e destinos MENA", href: "/destinations/middle-east", map: "/map-mena.jpg" },
    ],
  },
};

export default function DashboardMapPage() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 px-4 py-9 text-zinc-100 sm:px-7 lg:px-10 lg:py-12">
      <div aria-hidden className="pointer-events-none absolute -top-36 left-1/2 h-96 w-[min(900px,100vw)] -translate-x-1/2 rounded-full bg-amber-200/[0.055] blur-[115px]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-8 max-w-3xl">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-amber-200/70"><Sparkles size={13} />{t.eyebrow}</p>
          <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-50 sm:text-5xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{t.subtitle}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {t.regions.map((region) => (
            <Link key={region.href} href={region.href} className="group overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/35 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-amber-200/25 hover:bg-zinc-900/60">
              <div className="relative h-44 overflow-hidden border-b border-zinc-800/50 sm:h-52">
                {/* regional map images are local site assets */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={region.map} alt="" aria-hidden className="h-full w-full object-cover opacity-45 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent" />
                <div className="absolute bottom-4 left-5 flex items-center gap-2 text-amber-200/70"><Globe2 size={15} /><span className="text-[10px] uppercase tracking-[0.25em]">VOYAGE MAPS</span></div>
                <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-950/45 text-zinc-200 transition group-hover:border-amber-200/35 group-hover:text-amber-100"><ArrowUpRight size={16} /></div>
              </div>
              <div className="flex items-end justify-between gap-4 p-5">
                <div><h2 className="text-lg font-medium text-zinc-100">{region.title}</h2><p className="mt-1 text-xs text-zinc-500">{region.subtitle}</p></div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-amber-100/75"><MapPin size={13} />{t.openMap}</span>
              </div>
            </Link>
          ))}
        </section>
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-4 text-xs leading-5 text-zinc-500"><Compass size={15} className="mt-0.5 shrink-0 text-amber-200/50" />{t.note}</p>
      </div>
    </main>
  );
}
