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
  description: { EN: string; RU: string };
  rates: { split: string; shot: string; incall: string; outcall: string };
  accommodation: { EN: string; RU: string };
  services: { EN: string; RU: string };
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
const MAP_W = 1280;
const MAP_H = 960;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` }
    : { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` };

// ─────────────────────────────────────────────────────────────
// Data — координаты выверены по /map-apac.jpg (1152×1652).
// ─────────────────────────────────────────────────────────────
const HUBS: Hub[] = [
  {
    id: "south_korea",
    name: { EN: "SOUTH KOREA", RU: "ЮЖНАЯ КОРЕЯ" },
    subtitle: { EN: "High-Volume Premium", RU: "Премиальный поток" },
    description: {
      EN: "Intensive and highly profitable market with a generous clientele. Perfect for energetic girls ready for a consistent daily flow of high-paying guests.",
      RU: "Интенсивный и высокодоходный рынок со щедрой клиентурой. Идеально для активных девушек, готовых к стабильному потоку платежеспособных гостей."
    },
    rates: {
      split: "50/50",
      shot: "30m: $200 / 1h: $300-$350",
      incall: "2h: $600-$650",
      outcall: "Night (7h): $1500-$2000",
    },
    accommodation: {
      EN: "Hotels (~$40/day). Cost split 50/50. Free return ticket provided after 1 month of work.",
      RU: "Отели (~$40/сутки). Оплата 50/50. При отработке полного месяца — обратный билет в подарок."
    },
    services: {
      EN: "3-4 guests daily. Classic service included, all extra services and tips are chosen and kept by the model.",
      RU: "3-4 гостя в день. Включена классика, дополнительные услуги на усмотрение девушки (доходы не делятся)."
    },
    x: 61.1,
    y: 11.5,
  },
  {
    id: "china",
    name: { EN: "CHINA", RU: "КИТАЙ" },
    subtitle: { EN: "Massive Clean Income", RU: "Колоссальный чистый доход" },
    description: {
      EN: "Exclusive access to wealthy Chinese clients across major cities (Guangzhou, Shanghai, Beijing). Incredible daily volume and VIP conditions with no hidden fees.",
      RU: "Эксклюзивный доступ к состоятельным китайским клиентам в мегаполисах (Гуанчжоу, Шанхай, Пекин). Невероятный поток и VIP-условия без скрытых комиссий."
    },
    rates: {
      split: "100% clean income to girl",
      shot: "1 shot (5-30m): 800 - 1100¥ (Clean)",
      incall: "2 shots: 1000 - 1300¥ (Clean)",
      outcall: "Night/Escort: Negotiable",
    },
    accommodation: {
      EN: "Free hotel and meals. Tickets fully credited and paid by agency for tours over 1 month.",
      RU: "Бесплатное проживание в отеле и питание. Кредитация билетов (при туре от месяца оплачиваются агентством)."
    },
    services: {
      EN: "Hours: 13:00 - 02:00. 5-6+ guests/day. Full visa support. Consumables provided for free.",
      RU: "График: 13:00 - 02:00. 5-6+ гостей в день. Виза под ключ. Все расходники за счет агентства."
    },
    x: 55.9,
    y: 18.2,
  },
  {
    id: "cambodia",
    name: { EN: "CAMBODIA", RU: "КАМБОДЖА" },
    subtitle: { EN: "Private Casino Hub", RU: "Закрытый казино-хаб" },
    description: {
      EN: "A discreet and rapidly growing market focused on VIP casino players, private investors, and exclusive private parties.",
      RU: "Приватный и быстрорастущий рынок, ориентированный на VIP-игроков казино, частных инвесторов и закрытые вечеринки."
    },
    rates: {
      split: "Premium Individual Rates",
      shot: "On demand",
      incall: "Custom bookings",
      outcall: "Escort & Casino accompaniment",
    },
    accommodation: {
      EN: "Luxury casino resort hotels and private villas.",
      RU: "Люксовые отели при казино и приватные виллы."
    },
    services: {
      EN: "Strictly vetted wealthy guests. Extreme discretion and high-end service required.",
      RU: "Строго проверенные состоятельные гости. Требуется максимальная конфиденциальность и высокий уровень сервиса."
    },
    x: 36.5,
    y: 42.3,
  },
  {
    id: "phuket",
    name: { EN: "PHUKET", RU: "ПХУКЕТ" },
    subtitle: { EN: "Island Luxury", RU: "Островной люкс" },
    description: {
      EN: "Tropical paradise with premium services for wealthy Asian tourists and expats. Relaxed resort atmosphere combined with serious earnings.",
      RU: "Тропический рай с премиальным сервисом для богатых азиатских туристов и экспатов. Расслабленная курортная атмосфера и серьезные доходы."
    },
    rates: {
      split: "50/50 (Tips 100% yours)",
      shot: "1h: $240+",
      incall: "2h: $350+",
      outcall: "Night: $800+",
    },
    accommodation: {
      EN: "4* Hotels. Island premium locations. Flight crediting available.",
      RU: "Отели 4*. Премиальные локации. Предоставляется кредитация билетов."
    },
    services: {
      EN: "Hours: 19:00 - 03:00. Target audience: Wealthy Chinese guests. Closed database, no internet ads.",
      RU: "График: 19:00 - 03:00. Аудитория: богатые китайские гости. Закрытая база, без рекламы в интернете."
    },
    x: 28.7,
    y: 46.2,
  },
  {
    id: "pattaya",
    name: { EN: "PATTAYA", RU: "ПАТТАЙЯ" },
    subtitle: { EN: "Resort Elite", RU: "Курортная элита" },
    description: {
      EN: "A mix of beach resort vibes and high-earning closed meetings. Focused heavily on high-paying Chinese clientele in a secure environment.",
      RU: "Микс курортного вайба и высокодоходных закрытых встреч. Плотная работа с платежеспособной китайской клиентурой в безопасной среде."
    },
    rates: {
      split: "Clean income per shot",
      shot: "1 shot: 800¥ (Clean to girl)",
      incall: "High frequency bookings",
      outcall: "Upon request",
    },
    accommodation: {
      EN: "Free hotel accommodation provided.",
      RU: "Бесплатное проживание в комфортном отеле."
    },
    services: {
      EN: "Min tour: 14 days. Incall focus with thoroughly verified guests.",
      RU: "Мин. тур: 14 дней. Фокус на работу в отеле с тщательно проверенными гостями."
    },
    x: 31.5,
    y: 41.0,
  },
  {
    id: "bangkok",
    name: { EN: "BANGKOK", RU: "БАНГКОК" },
    subtitle: { EN: "Asian Hub", RU: "Азиатский хаб" },
    description: {
      EN: "The vibrant capital of Thailand working directly with top-tier Asian expats. High dynamics, luxury conditions, and great tips.",
      RU: "Яркая столица Таиланда с прямым доступом к топовым азиатским экспатам. Высокая динамика, люксовые условия и отличные чаевые."
    },
    rates: {
      split: "50/50",
      shot: "1h: $240+",
      incall: "2h: $350+",
      outcall: "Night: $800+",
    },
    accommodation: {
      EN: "4* Hotels. Safe, comfortable, and discreet.",
      RU: "Отели 4*. Безопасно, комфортно и конфиденциально."
    },
    services: {
      EN: "Hours: 19:00 - 03:00. Airport pickup provided. Zero public advertising to ensure probability of leaks is minimal.",
      RU: "График: 19:00 - 03:00. Встреча в аэропорту. Отправка фото только по базе, вероятность сливов минимальная."
    },
    x: 31.0,
    y: 40.0,
  },
  {
    id: "vietnam",
    name: { EN: "VIETNAM", RU: "ВЬЕТНАМ" },
    subtitle: { EN: "VIP Outcall", RU: "VIP-выезды" },
    description: {
      EN: "Exclusive outcall service for high-ranking clients and VIPs. Complete peace of mind, excellent conditions, and 100% rate retention for models.",
      RU: "Эксклюзивный выездной сервис для высокопоставленных лиц и VIP-гостей. Полное спокойствие, отличные условия и 100% ставки на руки."
    },
    rates: {
      split: "100% to model (Hourly rate)",
      shot: "Clean income: $20k - $25k / month",
      incall: "Focus on Outcall",
      outcall: "1h: $140 - $170",
    },
    accommodation: {
      EN: "Free comfortable hotel provided. Ticket crediting is available.",
      RU: "Бесплатное проживание в комфортабельном отеле. Возможна кредитация билетов."
    },
    services: {
      EN: "Hours: 18:00 - 06:00. 6 days off/month. White/European look required. Kissing and joint shower mandatory.",
      RU: "График: 18:00 - 06:00. 6 выходных в месяц. Белая/европейская внешность. Обязательны поцелуи и совместный душ."
    },
    x: 40.5,
    y: 40.0,
  },
  {
    id: "bali",
    name: { EN: "BALI", RU: "БАЛИ" },
    subtitle: { EN: "Tropical Elite", RU: "Тропическая элита" },
    description: {
      EN: "Luxury villa parties, yacht trips, and wealthy crypto-investors. A perfect mix of high-end resort living and top-tier earnings.",
      RU: "Закрытые вечеринки на виллах, яхты и состоятельные крипто-инвесторы. Идеальный микс шикарного курортного отдыха и топовых доходов."
    },
    rates: {
      split: "50/50 (Tips & extras 100% yours)",
      shot: "1h: $250 - $300",
      incall: "2h: $400 - $500",
      outcall: "Night/Yacht: $1000 - $1500+",
    },
    accommodation: {
      EN: "Premium villas or 5* hotels. Costs split 50/50.",
      RU: "Премиальные виллы или отели 5*. Расходы делятся 50/50."
    },
    services: {
      EN: "High demand for atmospheric and relaxed vibe. Focus on rich expats and tourists.",
      RU: "Высокий спрос на атмосферность и расслабленный вайб. Фокус на богатых экспатах и туристах."
    },
    x: 46.5,
    y: 65.8,
  },
  {
    id: "malaysia",
    name: { EN: "MALAYSIA", RU: "МАЛАЙЗИЯ" },
    subtitle: { EN: "Asian Business Hub", RU: "Азиатский бизнес-хаб" },
    description: {
      EN: "The business heart of Southeast Asia. Skyscrapers, luxury condos, and wealthy Asian businessmen who value discretion and premium service.",
      RU: "Деловое сердце Юго-Восточной Азии. Небоскребы, люксовые кондоминиумы и богатые азиатские бизнесмены, ценящие приватность и премиум-сервис."
    },
    rates: {
      split: "50/50 (Tips & gifts 100% yours)",
      shot: "1h: $200 - $250",
      incall: "2h: $350 - $400",
      outcall: "Night: $800 - $1000",
    },
    accommodation: {
      EN: "Luxury high-rise apartments with infinity pools (50/50 split).",
      RU: "Люксовые апартаменты в небоскребах с инфинити-бассейнами (оплата 50/50)."
    },
    services: {
      EN: "Strict confidentiality. Vetted clientele only. Professional and polished look required.",
      RU: "Строгая конфиденциальность. Только проверенная клиентура. Требуется ухоженный и профессиональный вид."
    },
    x: 32.1,
    y: 52.5,
  },
  {
    id: "australia",
    name: { EN: "AUSTRALIA", RU: "АВСТРАЛИЯ" },
    subtitle: { EN: "Ultimate Premium", RU: "Абсолютный премиум" },
    description: {
      EN: "Incredibly high rates, 100% safety, and official student visas. Stunning luxury apartments and a highly professional security protocol.",
      RU: "Невероятно высокие ставки, 100% безопасность и официальные студенческие визы. Шикарные апартаменты и максимально профессиональный подход."
    },
    rates: {
      split: "50/50 (Base rate)",
      shot: "1h: $500 - $700",
      incall: "Clean income: $6k-$9k / week",
      outcall: "Extras (MBR +$100, Anal +$200-300) 100% yours",
    },
    accommodation: {
      EN: "Luxury private apartments with pools and gyms provided. Flights paid for 1+ month tours.",
      RU: "Предоставляются личные шикарные апартаменты с бассейнами и залом. Билеты оплачиваются при туре от 1 месяца."
    },
    services: {
      EN: "15-25 meetings/week. 80% incall. Backup security team of 30+ ready 24/7. Total safety.",
      RU: "15-25 встреч в неделю. 80% инколл. Группа быстрого реагирования 24/7, абсолютная безопасность."
    },
    x: 85.2,
    y: 93.1,
  }
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
      ratesLabel: { EN: "Rates", RU: "Тарифы" },
      accommodationLabel: { EN: "Accommodation", RU: "Проживание" },
      servicesLabel: { EN: "Services", RU: "Условия" },
      splitLabel: { EN: "Split", RU: "Дележ" },
      shotLabel: { EN: "Shot", RU: "Shot" },
      incallLabel: { EN: "Incall", RU: "Incall" },
      outcallLabel: { EN: "Outcall", RU: "Outcall" },
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
              <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.description[lang]}</p>

              {/* Rates */}
              <div className="mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.ratesLabel[lang]}</h4>
                <div className="space-y-2 text-sm text-zinc-400">
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-500">{t.splitLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.split}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-500">{t.shotLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.shot}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-500">{t.incallLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.incall}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{t.outcallLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.outcall}</span>
                  </div>
                </div>
              </div>

              {/* Accommodation */}
              <div className="mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.accommodationLabel[lang]}</h4>
                <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.accommodation[lang]}</p>
              </div>

              {/* Services */}
              <div className="mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.servicesLabel[lang]}</h4>
                <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.services[lang]}</p>
              </div>

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