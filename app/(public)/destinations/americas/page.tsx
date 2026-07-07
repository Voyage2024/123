"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  Users,
  Gem,
  Sparkles,
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
// Карта 1928×1452 ≈ 4:3, поэтому кроп минимальный.
// ─────────────────────────────────────────────────────────────
const MAP_W = 1928;
const MAP_H = 1452;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` }
    : { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` };

// ─────────────────────────────────────────────────────────────
// Data — координаты выверены по /map-americas.jpg (1928×1452).
// ─────────────────────────────────────────────────────────────
const HUBS: Hub[] = [
  {
    id: "toronto",
    name: { EN: "TORONTO", RU: "ТОРОНТО" },
    subtitle: { EN: "Canadian Premium", RU: "Канадский премиум" },
    description: {
      EN: "Canada's financial heart. Massive verified client base guaranteeing $15k-$25k per month. High-end apartments and an honest, transparent partnership.",
      RU: "Финансовое сердце Канады. Огромная база проверенных гостей, гарантирующая от $15k до $25k в месяц. Лучшие районы и честное, прозрачное партнерство."
    },
    rates: {
      split: "50/50 (Income, Tickets, Housing)",
      shot: "30m: $200 - $250",
      incall: "1h: $350 - $400",
      outcall: "Optional (Tips & extras 100% yours)",
    },
    accommodation: {
      EN: "Premium apartments in top districts. 50/50 split.",
      RU: "Премиальные апартаменты в лучших районах. Оплата 50/50."
    },
    services: {
      EN: "Hours: 11:00-02:00 (Weekends till 04:00). Airport pickup, 24/7 support, and professional photoshoot provided.",
      RU: "График: 11:00-02:00 (Выходные до 04:00). Встреча в аэропорту, поддержка 24/7, предоставляется фотосессия."
    },
    x: 72.0,
    y: 31.1,
  },
  {
    id: "vancouver",
    name: { EN: "VANCOUVER", RU: "ВАНКУВЕР" },
    subtitle: { EN: "West Coast Luxury", RU: "Роскошь Западного побережья" },
    description: {
      EN: "Breathtaking Pacific wealth. A highly secure environment with extremely vetted guests. Perfect for well-groomed girls seeking long-term stability and top earnings.",
      RU: "Тихоокеанское богатство. Максимально безопасная среда со строго проверенными гостями. Идеально для ухоженных девушек, ищущих стабильность и топ-доходы."
    },
    rates: {
      split: "50/50 (Income, Tickets, Housing)",
      shot: "30m: $200 - $250",
      incall: "1h: $350 - $400",
      outcall: "Optional (Tips & extras 100% yours)",
    },
    accommodation: {
      EN: "Luxury apartments/hotels in top districts. 50/50 split.",
      RU: "Люксовые апартаменты/отели в лучших районах. Оплата 50/50."
    },
    services: {
      EN: "Min tour: 14 days. Absolute confidentiality and 24/7 personal support.",
      RU: "Мин. тур: 14 дней. Абсолютная конфиденциальность и личная поддержка 24/7."
    },
    x: 12.5,
    y: 20.0,
  },
  {
    id: "seattle",
    name: { EN: "SEATTLE", RU: "СИЭТЛ" },
    subtitle: { EN: "Tech Hub Elite", RU: "Элита IT-индустрии" },
    description: {
      EN: "The home of global tech giants. Incredibly wealthy, polite IT professionals and investors willing to pay top dollar for elite companionship.",
      RU: "Дом мировых IT-гигантов. Невероятно богатые и вежливые профессионалы и инвесторы, готовые щедро платить за элитную компанию."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "Strict safety protocols. Vetted high-net-worth individuals.",
      RU: "Строгие протоколы безопасности. Только проверенные состоятельные гости."
    },
    x: 11.9,
    y: 26.3,
  },
  {
    id: "portland",
    name: { EN: "PORTLAND", RU: "ПОРТЛЕНД" },
    subtitle: { EN: "Northwest Exclusivity", RU: "Эксклюзив Северо-Запада" },
    description: {
      EN: "A highly discreet market with a relaxed vibe but serious budgets. Perfect for exclusive meetings away from the spotlight.",
      RU: "Крайне закрытый рынок с расслабленным вайбом, но серьезными бюджетами. Идеально для эксклюзивных встреч вдали от посторонних глаз."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "High privacy standards. Premium hotel living.",
      RU: "Высочайшие стандарты приватности. Проживание в премиум-отелях."
    },
    x: 10.9,
    y: 33.8,
  },
  {
    id: "philadelphia",
    name: { EN: "PHILADELPHIA", RU: "ФИЛАДЕЛЬФИЯ" },
    subtitle: { EN: "East Coast Wealth", RU: "Богатство Восточного побережья" },
    description: {
      EN: "Historic wealth and massive business hubs. A very active market with generous regulars looking for top-tier aesthetics.",
      RU: "Исторический капитал и крупные бизнес-хабы. Очень активный рынок со щедрыми постоянниками, ценящими высшую эстетику."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "Consistent demand and high daily earnings. Complete security.",
      RU: "Стабильный спрос и высокие ежедневные доходы. Полная безопасность."
    },
    x: 77.3,
    y: 41.5,
  },
  {
    id: "washington",
    name: { EN: "WASHINGTON DC", RU: "ВАШИНГТОН" },
    subtitle: { EN: "Capital Prestige", RU: "Столичный престиж" },
    description: {
      EN: "The ultimate power center. Politicians, diplomats, and tycoons. Absolute confidentiality is mandatory, and the payouts match the status.",
      RU: "Абсолютный центр власти. Политики, дипломаты и магнаты. Требуется безупречная конфиденциальность, а выплаты полностью соответствуют статусу."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "NDA-level discretion. The most elite circle of clients in the USA.",
      RU: "Секретность уровня NDA. Самый элитный круг клиентов в США."
    },
    x: 75.8,
    y: 44.5,
  },
  {
    id: "los_angeles",
    name: { EN: "LOS ANGELES", RU: "ЛОС-АНДЖЕЛЕС" },
    subtitle: { EN: "Hollywood Glamour", RU: "Голливудский гламур" },
    description: {
      EN: "The entertainment capital of the world. Crazy budgets, celebrity-level guests, and a fast-paced luxury lifestyle.",
      RU: "Мировая столица развлечений. Сумасшедшие бюджеты, гости уровня селебрити и роскошный, динамичный лайфстайл."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "Extreme wealth concentration. High standards for visual aesthetics.",
      RU: "Экстремальная концентрация богатства. Высочайшие требования к визуальной эстетике."
    },
    x: 15.5,
    y: 54.8,
  },
  {
    id: "la_coast",
    name: { EN: "LA COAST", RU: "ПОБЕРЕЖЬЕ LA" },
    subtitle: { EN: "California Riviera", RU: "Калифорнийская Ривьера" },
    description: {
      EN: "Pasadena, Santa Barbara, Santa Monica, and Glendale. Relaxed beachfront wealth, private mansions, and incredibly generous locals.",
      RU: "Пасадена, Санта-Барбара, Санта-Моника. Расслабленная роскошь побережья, частные особняки и невероятно щедрые местные жители."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "Vip Outcalls and high-end hotel Incalls. Safe and highly profitable.",
      RU: "VIP-выезды и инколл в топовых отелях. Безопасно и крайне прибыльно."
    },
    x: 13.6,
    y: 51.1,
  },
  {
    id: "san_diego",
    name: { EN: "SAN DIEGO", RU: "САН-ДИЕГО" },
    subtitle: { EN: "Sunny Elite", RU: "Солнечная элита" },
    description: {
      EN: "Endless summer meets serious capital. A pristine market heavily favored by wealthy vacationers and local elites seeking the best.",
      RU: "Бесконечное лето и серьезные капиталы. Чистейший рынок, который обожают богатые туристы и местная элита, ищущая только лучшее."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "Excellent weather, perfect vibe, and massive cash flow.",
      RU: "Шикарная погода, идеальный вайб и колоссальный кэшфлоу."
    },
    x: 17.6,
    y: 57.7,
  },
  {
    id: "san_francisco",
    name: { EN: "SAN FRANCISCO", RU: "САН-ФРАНЦИСКО" },
    subtitle: { EN: "Silicon Valley Gold", RU: "Золото Кремниевой долины" },
    description: {
      EN: "The epicenter of global tech money. Unbelievable budgets, fast-paced bookings, and a clientele that does not look at the price tag.",
      RU: "Эпицентр мировых IT-денег. Невероятные бюджеты, быстрые букинги и клиентура, которая вообще не смотрит на ценник."
    },
    rates: {
      split: "50/50",
      shot: "30m: $400",
      incall: "1h: $500 / 2h: $1000",
      outcall: "Outcall: +$100",
    },
    accommodation: {
      EN: "4-5* Hotels ($100-$200/day). Split 50/50.",
      RU: "Отели 4-5* ($100-$200 в сутки). Оплата 50/50."
    },
    services: {
      EN: "Top-tier earning potential. 100% verified guests.",
      RU: "Потенциал заработка самого высшего уровня. 100% проверенные гости."
    },
    x: 11.0,
    y: 45.1,
  }
];

const ARTERIES: string[] = [
  "12.5,20 11.9,26.3 10.9,33.8 11,45.1 13.6,51.1 15.5,54.8 17.6,57.7",
  "72,31.1 77.3,41.5 75.8,44.5",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <Users className="w-7 h-7" />,
    title: { EN: "Elite Networking", RU: "Элитный нетворкинг" },
    body: {
      EN: "Access to closed business communities and private clubs.",
      RU: "Доступ в закрытые бизнес-сообщества и частные клубы.",
    },
  },
  {
    icon: <Gem className="w-7 h-7" />,
    title: { EN: "Premium Lifestyle", RU: "Люксовый лайфстайл" },
    body: {
      EN: "Penthouse residencies, superyachts, and private jet charters.",
      RU: "Резиденции в пентхаусах, суперяхты и чартеры частных джетов.",
    },
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    title: { EN: "Exclusive Parties", RU: "Закрытые вечеринки" },
    body: {
      EN: "VIP access to the most high-profile image events.",
      RU: "VIP-доступ на самые громкие имиджевые мероприятия.",
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

export default function AmericasPage() {
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
      heroTitle: { EN: "AMERICAS", RU: "АМЕРИКА" },
      heroSubtitle: {
        EN: "An elite closed community across the United States & Canada — networking, premium lifestyle and private image events.",
        RU: "Элитное закрытое комьюнити в США и Канаде — нетворкинг, люксовый лайфстайл и приватные имидж-мероприятия.",
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
                      <div className="flex items-center gap-5 min-w-0">
                        <span className={`font-mono text-sm transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-700"}`}>{num}</span>
                        <div className="min-w-0">
                          <h3 className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"}`}>{hub.name[lang]}</h3>
                          <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-amber-200/70" : "text-zinc-600"}`}>{hub.subtitle[lang]}</p>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 shrink-0 transition-all duration-300 ${isActive ? "translate-x-0 text-amber-200 opacity-100" : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`} />
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
                  <Image src="/map-americas.jpg" alt="Americas Map" fill priority className="object-cover opacity-80" />

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
                  <span className="font-serif text-5xl font-light text-zinc-100/10 select-none tracking-widest">AMERICAS</span>
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