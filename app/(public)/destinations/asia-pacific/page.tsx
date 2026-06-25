"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  Home,
  Sparkles,
  Briefcase,
  MapPin,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Lang = "EN" | "RU";

interface Hub {
  id: string;
  name: { EN: string; RU: string };
  subtitle: { EN: string; RU: string };
  body: { EN: string; RU: string };
  x: number;
  y: number;
}

interface Highlight {
  icon: React.ReactNode;
  title: { EN: string; RU: string };
  body: { EN: string; RU: string };
}

// ─────────────────────────────────────────────────────────────
// Map — единый стандарт пропорций (4:3) + cover-«сцена».
// ВНИМАНИЕ: эта карта портретная (1152×1652). В едином 4:3 верх
// (Korea/China) и низ (Australia) уходят за кадр. Точки остаются
// привязаны к карте и доступны в списке/Drawer. Чтобы показать
// карту целиком — поставь TARGET_RATIO = IMG_RATIO.
// ─────────────────────────────────────────────────────────────
const MAP_W = 1152;
const MAP_H = 1652;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` }
    : { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` };

// ─────────────────────────────────────────────────────────────
// Data — координаты выверены по /map-apac.jpg (1152×1652).
// ─────────────────────────────────────────────────────────────
const HUBS: Hub[] = [
  { id: "korea",     name: { EN: "SOUTH KOREA", RU: "ЮЖНАЯ КОРЕЯ" }, subtitle: { EN: "Seoul Nightlife Elite", RU: "Элита ночного Сеула" }, x: 53.0, y: 13.7,
    body: { EN: "Seoul after midnight. Members-only lounges, flawless style, and an elite that moves fast. Where K-culture meets serious money.", RU: "Сеул после полуночи. Лаунжи для своих, безупречный стиль и элита, которая движется быстро. Где K-культура встречает серьёзные деньги." } },
  { id: "china",     name: { EN: "CHINA",     RU: "КИТАЙ" },     subtitle: { EN: "Shanghai High Society", RU: "Высший свет Шанхая" }, x: 43.1, y: 20.7,
    body: { EN: "Shanghai's high society. Skyline penthouses, private members' clubs, and capital at a scale few can match.", RU: "Высший свет Шанхая. Пентхаусы над городом, частные клубы и капитал такого масштаба, который мало кому под силу." } },
  { id: "cambodia",  name: { EN: "CAMBODIA",  RU: "КАМБОДЖА" },  subtitle: { EN: "The Hidden Riviera", RU: "Скрытая ривьера" }, x: 18.2, y: 43.1,
    body: { EN: "A hidden Riviera in the making. Untouched islands, fresh energy, and privacy well off the beaten path.", RU: "Зарождающаяся скрытая ривьера. Нетронутые острова, свежая энергия и приватность вдали от туристических троп." } },
  { id: "phuket",    name: { EN: "PHUKET",    RU: "ПХУКЕТ" },    subtitle: { EN: "Private Island Villas", RU: "Виллы на закрытых островах" }, x: 10.5, y: 48.0,
    body: { EN: "Private island villas and turquoise water. Barefoot luxury with a closed-door feel — the Andaman at its finest.", RU: "Виллы на закрытых островах и бирюзовая вода. Босоногая роскошь за закрытыми дверями — Андаманское море во всей красе." } },
  { id: "pattaya",   name: { EN: "PATTAYA",   RU: "ПАТТАЙЯ" },   subtitle: { EN: "Beachfront Afterparties", RU: "Афтерпати на побережье" }, x: 12.9, y: 42.2,
    body: { EN: "Beachfront afterparties that run till sunrise. High energy, low inhibition, and a scene that never stops.", RU: "Афтерпати на побережье до рассвета. Много энергии, минимум ограничений и сцена, которая не останавливается." } },
  { id: "bangkok",   name: { EN: "BANGKOK",   RU: "БАНГКОК" },   subtitle: { EN: "The Sleepless Capital", RU: "Город, который не спит" }, x: 11.8, y: 40.4,
    body: { EN: "The capital that never sleeps. Rooftop bars, hidden clubs, and endless nights. The pulse of Southeast Asia.", RU: "Столица, которая не спит. Бары на крышах, скрытые клубы и бесконечные ночи. Пульс Юго-Восточной Азии." } },
  { id: "vietnam",   name: { EN: "VIETNAM",   RU: "ВЬЕТНАМ" },   subtitle: { EN: "Emerging Yacht Scene", RU: "Новая яхтенная сцена" }, x: 21.1, y: 43.7,
    body: { EN: "An emerging yacht scene. Dramatic bays, new money, and fresh horizons along a fast-rising coast.", RU: "Новая яхтенная сцена. Эффектные бухты, новые деньги и свежие горизонты вдоль стремительно растущего побережья." } },
  { id: "bali",      name: { EN: "BALI",      RU: "БАЛИ" },      subtitle: { EN: "Cliffside Villa Estates", RU: "Виллы на скалах" }, x: 34.2, y: 63.7,
    body: { EN: "Cliffside estates above the surf. Spiritual calm meets curated, private luxury. The island of choice for the in-crowd.", RU: "Имения на скалах над прибоем. Духовное спокойствие и продуманная приватная роскошь. Остров для своих." } },
  { id: "malaysia",  name: { EN: "MALAYSIA",  RU: "МАЛАЙЗИЯ" },  subtitle: { EN: "Skyline Penthouses", RU: "Пентхаусы над городом" }, x: 13.4, y: 51.8,
    body: { EN: "Skyline penthouses and twin-tower views. A polished, cosmopolitan hub for discreet networking.", RU: "Пентхаусы над городом и виды на башни-близнецы. Отполированный космополитичный хаб для деликатного нетворкинга." } },
  { id: "australia", name: { EN: "AUSTRALIA", RU: "АВСТРАЛИЯ" }, subtitle: { EN: "Harbour Yacht Society", RU: "Яхт-клуб у гавани" }, x: 85.7, y: 89.0,
    body: { EN: "Harbour yacht society. Sun, sea, and an easy-going elite at the edge of the Pacific. Sydney glamour, unhurried.", RU: "Яхт-клуб у гавани. Солнце, море и непринуждённая элита на краю Тихого океана. Гламур Сиднея, без суеты." } },
];

const ARTERIES: string[] = [
  "53,13.7 43.1,20.7 11.8,40.4 13.4,51.8 34.2,63.7 85.7,89",
  "10.5,48 11.8,40.4 18.2,43.1 21.1,43.7",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <Home className="w-7 h-7" />,
    title: { EN: "Exotic Residencies", RU: "Экзотические резиденции" },
    body: {
      EN: "Private villas and premium hospitality across the region's most coveted shores.",
      RU: "Приватные виллы и премиальный сервис на самых желанных берегах региона.",
    },
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    title: { EN: "Image Parties", RU: "Имидж-вечеринки" },
    body: {
      EN: "Exclusive access to closed community events behind unmarked doors.",
      RU: "Эксклюзивный доступ к мероприятиям закрытого комьюнити.",
    },
  },
  {
    icon: <Briefcase className="w-7 h-7" />,
    title: { EN: "Asian Business Hub", RU: "Азиатский нетворкинг" },
    body: {
      EN: "High-net-worth connections and discreet introductions across Asia & Pacific.",
      RU: "Связи на высшем уровне и деликатные знакомства по всему региону.",
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="relative flex items-center bg-zinc-900/80 border border-zinc-800 rounded-full p-1 w-fit">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute top-1 bottom-1 rounded-full bg-zinc-800"
        style={{ width: "calc(50% - 4px)", left: lang === "EN" ? "4px" : "calc(50%)" }}
      />
      {(["EN", "RU"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`relative z-10 px-5 py-1.5 text-xs font-medium tracking-widest transition-colors duration-200 ${
            lang === l ? "text-amber-200" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function RadarNode({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {active && (
          <motion.div key="waves" className="absolute inset-0 flex items-center justify-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.4, 0], scale: [1, 2.5, 3.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inline-flex h-4 w-4 rounded-full bg-amber-400/40"
            />
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.3, 0], scale: [1, 2, 3] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
              className="absolute inline-flex h-4 w-4 rounded-full bg-amber-400/20"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <span
        className={`relative inline-flex rounded-full transition-all duration-500 z-10 ${
          active
            ? "h-4 w-4 bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)]"
            : "h-2 w-2 bg-amber-200/40 backdrop-blur-sm"
        }`}
      />
    </div>
  );
}

export default function AsiaPacificPage() {
  const [lang, setLang] = useState<Lang>("EN");
  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);

  const openHub = (hub: Hub) => {
    setActiveHub(hub.id);
    setSelected(hub);
  };

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const t = useMemo(
    () => ({
      back: { EN: "Back to Global Map", RU: "К глобальной карте" },
      heroTitle: { EN: "ASIA & PACIFIC", RU: "АЗИЯ И ТИХИЙ ОКЕАН" },
      heroSubtitle: {
        EN: "An elite closed community across the region — image events, VIP gatherings and premium networking.",
        RU: "Элитное закрытое комьюнити региона — имидж-вечеринки, VIP-ивенты и премиальный нетворкинг.",
      },
      hubsLabel: { EN: "Member Destinations", RU: "Направления клуба" },
      mapLabel: { EN: "Regional Overview", RU: "Обзор региона" },
      highlightsTitle: { EN: "Membership Privileges", RU: "Привилегии членства" },
      drawerEyebrow: { EN: "Location Dossier", RU: "Досье локации" },
      drawerCta: { EN: "Resident Access", RU: "Вход для резидентов" },
    }),
    []
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-200/20 selection:text-amber-100">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-900/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-2 text-xs uppercase tracking-widest font-medium text-zinc-400 transition-colors hover:text-amber-200">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t.back[lang]}
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-36 pb-16 px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <h1 className="font-serif text-6xl font-light tracking-tight text-zinc-100 sm:text-7xl lg:text-8xl">{t.heroTitle[lang]}</h1>
            <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-zinc-400">{t.heroSubtitle[lang]}</p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-amber-400/5 blur-[120px]" />
      </section>

      {/* ── Split Section ── */}
      <section className="px-6 pb-24 relative z-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left: Hub List */}
            <div className="lg:col-span-5">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <MapPin className="h-3.5 w-3.5" />
                {t.hubsLabel[lang]}
              </div>
              <div className="space-y-1 pr-2 max-h-[680px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {HUBS.map((hub, idx) => {
                  const isActive = activeHub === hub.id;
                  const num = String(idx + 1).padStart(2, "0");
                  return (
                    <motion.div
                      key={hub.id}
                      onMouseEnter={() => setActiveHub(hub.id)}
                      onMouseLeave={() => setActiveHub((cur) => (selected ? cur : null))}
                      onClick={() => openHub(hub)}
                      className={`group flex cursor-pointer items-center justify-between rounded-xl px-5 py-4 transition-all duration-300 ${isActive ? "bg-zinc-900/60 border border-zinc-800/80" : "border border-transparent hover:bg-zinc-900/30"}`}
                    >
                      <div className="flex items-center gap-5">
                        <span className={`font-mono text-sm transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-700"}`}>{num}</span>
                        <div>
                          <h3 className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"}`}>{hub.name[lang]}</h3>
                          <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-amber-200/70" : "text-zinc-600"}`}>{hub.subtitle[lang]}</p>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 transition-all duration-300 ${isActive ? "translate-x-0 text-amber-200 opacity-100" : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`} />
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right: Map */}
            <div className="lg:col-span-7">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <Globe className="h-3.5 w-3.5" />
                {t.mapLabel[lang]}
              </div>

              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 shadow-2xl">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={STAGE_STYLE}>
                  <Image src="/map-apac.jpg" alt="Asia & Pacific Map" fill priority className="object-cover opacity-80" />

                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-zinc-950/40 to-zinc-950 pointer-events-none" />

                  <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                        <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {ARTERIES.map((points, i) => (
                      <polyline key={i} points={points} fill="none" stroke="url(#lineGrad)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>

                  {HUBS.map((hub) => {
                    const labelAbove = hub.y > 82;
                    return (
                      <div key={hub.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${hub.x}%`, top: `${hub.y}%` }}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveHub(hub.id)}
                          onMouseLeave={() => setActiveHub((cur) => (selected ? cur : null))}
                          onClick={() => openHub(hub)}
                          aria-label={hub.name[lang]}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center"
                        >
                          <RadarNode active={activeHub === hub.id} />
                        </button>
                        <AnimatePresence>
                          {activeHub === hub.id && (
                            <motion.div
                              key={`tooltip-${hub.id}`}
                              initial={{ opacity: 0, y: labelAbove ? -10 : 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: labelAbove ? -10 : 10 }}
                              transition={{ duration: 0.2 }}
                              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-20 ${labelAbove ? "bottom-full mb-3" : "top-full mt-3"}`}
                            >
                              <div className="rounded-lg bg-zinc-950/90 px-4 py-2 text-[10px] tracking-widest uppercase font-medium text-amber-200 shadow-xl border border-amber-200/20 backdrop-blur-md">{hub.name[lang]}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                  <span className="font-serif text-5xl font-light text-zinc-100/10 select-none tracking-widest">APAC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="border-t border-zinc-900 bg-zinc-950/50 px-6 py-24 relative z-10">
        <div className="mx-auto max-w-7xl">
          <motion.h2 initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14 font-serif text-4xl font-light text-zinc-100">
            {t.highlightsTitle[lang]}
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 transition-all duration-500 hover:border-amber-200/30 hover:bg-zinc-900/50"
              >
                <div className="mb-6 w-12 h-12 rounded-full border border-amber-200/20 flex items-center justify-center text-amber-200/70 transition-colors duration-500 group-hover:border-amber-200/40 group-hover:text-amber-200">{item.icon}</div>
                <h3 className="mb-3 font-serif text-2xl font-light text-zinc-100">{item.title[lang]}</h3>
                <p className="text-sm font-light leading-relaxed text-zinc-500">{item.body[lang]}</p>
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0 pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-12" />

      {/* ── Location Drawer ── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              key="drawer-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md overflow-y-auto border-l border-zinc-800/80 bg-zinc-950 p-8 sm:p-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">{t.drawerEyebrow[lang]}</span>
                <button onClick={() => setSelected(null)} aria-label="Close" className="-mr-2 -mt-2 rounded-full p-2 text-zinc-500 transition-colors hover:text-amber-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h2 className="mt-10 font-serif text-5xl font-light leading-tight text-zinc-100">{selected.name[lang]}</h2>
              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-amber-200/70">{selected.subtitle[lang]}</p>
              <div className="my-8 h-px w-16 bg-amber-200/30" />
              <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.body[lang]}</p>
              <Link href="/login" className="mt-10 inline-flex items-center justify-center rounded-full bg-amber-200 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-100">
                {t.drawerCta[lang]}
              </Link>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
