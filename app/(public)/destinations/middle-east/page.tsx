"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  ShieldCheck,
  CalendarCheck,
  Crown,
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
  description: { EN: string; RU: string }; // Новое поле
  rates: { split: string; shot: string; incall: string; outcall: string }; // Новое поле
  accommodation: { EN: string; RU: string }; // Новое поле
  services: { EN: string; RU: string }; // Новое поле
  x: number;
  y: number;
}

interface Highlight {
  icon: React.ReactNode;
  title: { EN: string; RU: string };
  body: { EN: string; RU: string };
}

// ─────────────────────────────────────────────────────────────
// Map — единый стандарт пропорций для всех регионов (4:3).
// Карта кладётся во внутренний слой-«сцену», отмасштабированный
// под cover, поэтому коробка одинаковая на всех страницах, а точки
// остаются приклеены к самой карте (не сползают).
// ─────────────────────────────────────────────────────────────
const MAP_W = 2134;
const MAP_H = 1563;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` }
    : { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` };

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const HUBS: Hub[] = [
  {
  id: "dubai",
  name: { EN: "DUBAI", RU: "ДУБАЙ" },
  subtitle: { EN: "Premium Outcall", RU: "Премиум выезды" },
  description: {
    EN: "The Gulf's crown jewel. Sky-high penthouses, private yacht decks, and the heart of the region's nightlife. Premium outcall with flawless discretion.",
    RU: "Жемчужина Залива. Пентхаусы под небом, приватные яхты и сердце ночной жизни региона. Премиум-выезды с безупречной конфиденциальностью."
  },
  rates: {
    split: "Earnings depend on demand/client", // Гибкая система, как ты просил
    shot: "1-2 hours: $250",
    incall: "4-5 hours: $400+",
    outcall: "Bonuses, tips & extras are 100% yours"
  },
  accommodation: {
    EN: "Comfortable apartment ($1000/mo all-inclusive). Includes: groceries, home-cooked meals, internet, TV, maid service.",
    RU: "Уютная квартира (1000$ в месяц, всё включено). Включено: продукты, домашняя еда, интернет, ТВ, услуги горничной."
  },
  services: {
    EN: "Security & 24/7 support. Airport pick-up, medical assistance, vetted clients only. No public profiles.",
    RU: "Безопасность и поддержка 24/7. Встреча в аэропорту, медпомощь, только проверенные клиенты. Никаких публичных профилей."
  },
  x: 77, y: 56
},
  {
  id: "qatar",
  name: { EN: "QATAR", RU: "КАТАР" },
  subtitle: { EN: "High-End Hub", RU: "Элитный хаб" },
  description: {
    EN: "Quiet, ultra-wealthy, and exceptionally discreet. A high-end hub for those who value privacy above everything.",
    RU: "Тихий, сверхбогатый и предельно закрытый. Элитный хаб для тех, кто ценит приватность превыше всего."
  },
  rates: {
    split: "60/40",
    shot: "30m: $165 - $220",
    incall: "1h: $275 - $410",
    outcall: "Tips & gifts are 100% yours"
  },
  accommodation: {
    EN: "Tourist luxury hotels ($130-200/day). One person per room. Hotels are changed every 3-4 days for safety.",
    RU: "Туристические люкс-отели (130-200$ в сутки). Проживание по одному в номере. Смена отеля каждые 3-4 дня."
  },
  services: {
    EN: "Online-only work, vetted clients, 24/7 dispatcher support. Services: MBR, anal (extra fee).",
    RU: "Работа онлайн, проверенные клиенты, поддержка диспетчеров 24/7. Сервис: МБР, анал (доп. оплата)."
  },
  x: 66.2, y: 54.8
},
 {
  id: "saudi",
  name: { EN: "SAUDI ARABIA", RU: "САУДОВСКАЯ АРАВИЯ" },
  subtitle: { EN: "Exclusive Access", RU: "Эксклюзивный доступ" },
  description: {
    EN: "A market opening to the select few. Exclusive access, private gatherings, and connections at the very top. Discretion is non-negotiable.",
    RU: "Рынок, открывающийся лишь для избранных. Эксклюзивный доступ, закрытые встречи и связи на самом верху. Конфиденциальность — обязательна."
  },
  rates: {
    split: "50/50",
    shot: "$215 - $270",
    incall: "$400 - $560",
    outcall: "$560 - $670 + Taxi"
  },
  accommodation: {
    EN: "50/50 cost split, private elite apartments (personal selection).",
    RU: "Разделение расходов 50/50, приватные апартаменты в элитных районах (личный выбор)."
  },
  services: {
    EN: "Full security protocols, mbr, kissing, shower, massage, oral.",
    RU: "Полная безопасность и приватность. Сервис: mbr, поцелуи, душ, массаж, оральный."
  },
  x: 52, y: 56
},
{
  id: "bahrain",
  name: { EN: "BAHRAIN", RU: "БАХРЕЙН" },
  subtitle: { EN: "Private Events", RU: "Приватные ивенты" },
  description: {
    EN: "Island of discreet pleasure. Private events, intimate circles, and a relaxed pace away from the spotlight.",
    RU: "Остров негромких удовольствий. Приватные ивенты, закрытые круги и спокойный ритм вдали от софитов."
  },
  rates: {
    split: "60/40",
    shot: "30m: $105 - $210",
    incall: "1h: $210 - $340",
    outcall: "Night: $1,050 - $1,580"
  },
  accommodation: {
    EN: "Luxury apartments (~$925/mo or $40-53/day). Private accommodation, solo living.",
    RU: "Люксовые апартаменты (~925$ в месяц или 40-53$ в сутки). Проживание по одному в номере."
  },
  services: {
    EN: "Remote work, vetted clients, 24/7 support. Extras: Anal ($132), Golden Shower ($80).",
    RU: "Работа онлайн, проверенные клиенты, поддержка 24/7. Допы: Анал (132$), Золотой дождь (80$)."
  },
  x: 64.8, y: 52.5
},
 {
  id: "oman",
  name: { EN: "OMAN", RU: "ОМАН" },
  subtitle: { EN: "VIP Tours", RU: "VIP-туры" },
  description: {
    EN: "Untouched coastlines and curated VIP tours. Serene, understated luxury for those who prefer beauty without the crowd.",
    RU: "Нетронутые берега и продуманные VIP-туры. Спокойная, сдержанная роскошь для тех, кто ценит красоту без толпы."
  },
  rates: {
    split: "60/40",
    shot: "30m: $150 - $200",
    incall: "1h: $250 - $400",
    outcall: "Tips & gifts are 100% yours"
  },
  accommodation: {
    EN: "Luxury tourist hotels or private villas. Accommodation cost split 50/50.",
    RU: "Люксовые туристические отели или приватные виллы. Разделение расходов 50/50."
  },
  services: {
    EN: "Security & 24/7 support. Online-only work, vetted clients, full privacy protocols.",
    RU: "Безопасность и поддержка 24/7. Работа онлайн, только проверенные клиенты, полная приватность."
  },
  x: 82.2, y: 60.1
},
 {
  id: "lebanon",
  name: { EN: "LEBANON", RU: "ЛИВАН" },
  subtitle: { EN: "Party Hub", RU: "Клубная столица" },
  description: {
    EN: "The Mediterranean's nightlife capital. Rooftop parties, sea views, and a restless social scene that runs till dawn.",
    RU: "Ночная столица Средиземноморья. Вечеринки на крышах, вид на море и неугомонная светская жизнь до рассвета."
  },
  rates: {
    split: "50/50",
    shot: "30m: $100",
    incall: "1h: $200 / 2h: $300",
    outcall: "Rare (vetted regulars only, 5* hotels)"
  },
  accommodation: {
    EN: "Stay in hotels (~$90/day). Client entry via passport check. Video confirmation of hotel room may be required by clients.",
    RU: "Проживание в отеле (~90$/сутки). Вход клиентов по паспортам. Клиенты могут запрашивать видео подтверждение номера."
  },
  services: {
    EN: "High trust environment. 70% Christian / 30% Muslim clientele.",
    RU: "Высокое доверие. Клиентура: 70% христиане, 30% мусульмане."
  },
  x: 29, y: 31
},
  {
  id: "jordan",
  name: { EN: "JORDAN", RU: "ИОРДАНИЯ" },
  subtitle: { EN: "Closed Residencies", RU: "Закрытые резиденции" },
  description: {
    EN: "Ancient backdrops and modern privacy. Closed residencies for guests who prefer to stay unseen. Calm, secure, and exclusive.",
    RU: "Древние декорации и современная приватность. Закрытые резиденции для тех, кто предпочитает оставаться незамеченным. Спокойно, надёжно, эксклюзивно."
  },
  rates: {
    split: "50/50",
    shot: "30m: $100 - $150",
    incall: "1h: $200 / 2h: $350",
    outcall: "Optional (at discretion)"
  },
  accommodation: {
    EN: "5* Hotels ($100-$120/day). Flight & taxi costs split 50/50. Visa on arrival ($65).",
    RU: "Отели 5* (100-120$/сутки). Расходы на перелет и такси 50/50. Виза по прилету (65$)."
  },
  services: {
    EN: "Work hours: 12:00 PM – 12:00 AM. 2-week trip minimum. In-hotel work preferred.",
    RU: "Рабочий график: 12:00 – 00:00. Минимальный тур 2 недели. Предпочтительна работа в отеле."
  },
  x: 33, y: 38
},
  {
  id: "israel",
  name: { EN: "ISRAEL", RU: "ИЗРАИЛЬ" },
  subtitle: { EN: "Elite Community", RU: "Элитное комьюнити" },
  description: {
    EN: "A tight elite community where status and ambition meet. Fast networks, sharper connections, and a buzzing scene by the sea.",
    RU: "Сплочённое элитное комьюнити, где встречаются статус и амбиции. Быстрые связи, ещё быстрее знакомства и живая сцена у моря."
  },
  rates: {
    split: "50/50",
    shot: "30m: ~$160",
    incall: "1h: ~$270",
    outcall: "Incall only"
  },
  accommodation: {
    EN: "Comfortable private apartments (~$108/day). Solo accommodation.",
    RU: "Комфортабельные личные апартаменты (~108$ в сутки). Проживание по одному."
  },
  services: {
    EN: "100% border control support documents provided. 90% regular clients. Strictly incall.",
    RU: "Полная поддержка документами для прохождения границы. 90% постоянных клиентов. Только инколл."
  },
  x: 28, y: 35
},
  {
  id: "egypt",
  name: { EN: "EGYPT", RU: "ЕГИПЕТ" },
  subtitle: { EN: "Private Escapes", RU: "Приватный отдых" },
  description: {
    EN: "Red Sea hideaways and desert retreats. Private escapes for those who disappear in style — sun, silence, and total seclusion.",
    RU: "Укрытия на Красном море и уединение в пустыне. Приватный отдых для тех, кто исчезает со вкусом: солнце, тишина и полное уединение."
  },
  rates: {
    split: "50/50",
    shot: "30m: $100 - $200",
    incall: "1h: $200 - $400",
    outcall: "Available (driver provided)"
  },
  accommodation: {
    EN: "Private luxury accommodation. High standards of safety and comfort.",
    RU: "Приватное жилье высокого класса. Высокие стандарты безопасности и комфорта."
  },
  services: {
    EN: "Work hours: 15:00 – 03:00. Vetted client base (7 years experience). Photo privacy options available.",
    RU: "Рабочий график: 15:00 – 03:00. Проверенная база клиентов (7 лет опыта). Возможность работы без публичных фото."
  },
  x: 20, y: 40
},
 {
  id: "turkey",
  name: { EN: "TURKEY", RU: "ТУРЦИЯ" },
  subtitle: { EN: "Eurasian Hub", RU: "Евразийский хаб" },
  description: {
    EN: "Where Europe meets Asia. A vibrant hub bridging worlds, capital, and the right people.",
    RU: "Где Европа встречается с Азией. Яркий хаб, объединяющий миры, капитал и нужных людей."
  },
  rates: {
    split: "50/50",
    shot: "1h: $200",
    incall: "2h: $350 / 3h: $500",
    outcall: "Night (6-7h): $900 - $1000"
  },
  accommodation: {
    EN: "5* Hotels (~$25/day). Cost split 50/50.",
    RU: "Отели 5* (~25$/сутки). Разделение расходов 50/50."
  },
  services: {
    EN: "Incall + Outcall available. Flexible schedule (approx. 12:00 - 03:00).",
    RU: "Доступны Incall и Outcall. Гибкий график (примерно с 12:00 до 03:00)."
  },
  x: 75.5, y: 72.8
},
];
const HIGHLIGHTS: Highlight[] = [
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    title: { EN: "Visa-Free Access", RU: "Безвизовый въезд" },
    body: {
      EN: "Simplified entry protocols for club residents. Fast-track airport support.",
      RU: "Упрощенные протоколы въезда для резидентов клуба. Fast-track поддержка в аэропорту.",
    },
  },
  {
    icon: <CalendarCheck className="w-7 h-7" />,
    title: { EN: "Prime Season", RU: "Высокий сезон" },
    body: {
      EN: "Maximum activity and highest rates from October to April.",
      RU: "Максимальная активность и пиковые ставки с октября по апрель.",
    },
  },
  {
    icon: <Crown className="w-7 h-7" />,
    title: { EN: "VIP Security", RU: "VIP-безопасность" },
    body: {
      EN: "Unmatched level of privacy. Closed residencies and private transportation.",
      RU: "Беспрецедентный уровень приватности. Закрытые резиденции и личные трансферы.",
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
        style={{
          width: "calc(50% - 4px)",
          left: lang === "EN" ? "4px" : "calc(50%)",
        }}
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
      {/* Ping rings */}
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
      {/* Core dot */}
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

export default function MiddleEastPage() {
  const [lang, setLang] = useState<Lang>("EN");
  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);

  // Открыть Drawer по клику на локацию (из списка или с карты)
  const openHub = (hub: Hub) => {
    setActiveHub(hub.id);
    setSelected(hub);
  };

  // Блокируем скролл фона, пока открыт Drawer
  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const t = useMemo(
    () => ({
      back: { EN: "Back to Global Map", RU: "К глобальной карте" },
      heroTitle: { EN: "MIDDLE EAST", RU: "MIDDLE EAST" },
      heroSubtitle: {
        EN: "The epicenter of luxury. The highest checks, flawless security, and premium image events.",
        RU: "Эпицентр роскоши. Самые высокие чеки, безупречная безопасность и премиальные имиджевые мероприятия.",
      },
      hubsLabel: { EN: "Strategic Locations", RU: "Стратегические локации" },
      mapLabel: { EN: "Regional Overview", RU: "Обзор региона" },
      highlightsTitle: { EN: "Regional Highlights", RU: "Особенности региона" },
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
          <Link
            href="/"
            className="group flex items-center gap-2 text-xs uppercase tracking-widest font-medium text-zinc-400 transition-colors hover:text-amber-200"
          >
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="font-serif text-6xl font-light tracking-tight text-zinc-100 sm:text-7xl lg:text-8xl">
              {t.heroTitle[lang]}
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-zinc-400">
              {t.heroSubtitle[lang]}
            </p>
          </motion.div>
        </div>

        {/* Decorative gradient */}
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

              {/* Скроллбар скрыт во всех движках: WebKit/Blink, Firefox, старый Edge. */}
              <div className="space-y-1 pr-2 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {HUBS.map((hub, idx) => {
                  const isActive = activeHub === hub.id;
                  const num = String(idx + 1).padStart(2, "0");

                  return (
                    <motion.div
                      key={hub.id}
                      onMouseEnter={() => setActiveHub(hub.id)}
                      onMouseLeave={() => setActiveHub((cur) => (selected ? cur : null))}
                      onClick={() => openHub(hub)}
                      className={`group flex cursor-pointer items-center justify-between rounded-xl px-5 py-4 transition-all duration-300 ${
                        isActive ? "bg-zinc-900/60 border border-zinc-800/80" : "border border-transparent hover:bg-zinc-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <span
                          className={`font-mono text-sm transition-colors duration-300 ${
                            isActive ? "text-amber-200" : "text-zinc-700"
                          }`}
                        >
                          {num}
                        </span>
                        <div>
                          <h3
                            className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${
                              isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"
                            }`}
                          >
                            {hub.name[lang]}
                          </h3>
                          <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${
                            isActive ? "text-amber-200/70" : "text-zinc-600"
                          }`}>
                            {hub.subtitle[lang]}
                          </p>
                        </div>
                      </div>

                      <ChevronRight
                        className={`h-5 w-5 transition-all duration-300 ${
                          isActive
                            ? "translate-x-0 text-amber-200 opacity-100"
                            : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                        }`}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right: Actual Image Map */}
            <div className="lg:col-span-7">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <Globe className="h-3.5 w-3.5" />
                {t.mapLabel[lang]}
              </div>

              {/* Единый контейнер 4:3 для всех регионов. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 shadow-2xl">
                {/* «Сцена» под cover — карта + артерии + точки (точки приклеены к карте) */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={STAGE_STYLE}
                >
                  <Image
                    src="/map-mena.jpg"
                    alt="MENA Map"
                    fill
                    priority
                    className="object-cover opacity-80"
                  />

                  {/* Виньетка */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-zinc-950/40 to-zinc-950 pointer-events-none" />

                  {/* Линии связи */}
                  <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                        <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polyline
                      points="77,56 66.2,54.8 52,56 64.8,52.5 77,56"
                      fill="none"
                      stroke="url(#lineGrad)"
                      strokeWidth="0.5"
                    />
                    <line x1="66.2" y1="54.8" x2="29" y2="31" stroke="url(#lineGrad)" strokeWidth="0.3" />
                    <line x1="52" y1="56" x2="20" y2="40" stroke="url(#lineGrad)" strokeWidth="0.3" />
                    <line x1="82.2" y1="60.1" x2="52" y2="56" stroke="url(#lineGrad)" strokeWidth="0.3" />
                  </svg>

                  {/* Nodes (Точки городов) — клик открывает Drawer */}
                  {HUBS.map((hub) => {
                    const labelAbove = hub.y > 82;
                    return (
                      <div
                        key={hub.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                        style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
                      >
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
                              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-20 ${
                                labelAbove ? "bottom-full mb-3" : "top-full mt-3"
                              }`}
                            >
                              <div className="rounded-lg bg-zinc-950/90 px-4 py-2 text-[10px] tracking-widest uppercase font-medium text-amber-200 shadow-xl border border-amber-200/20 backdrop-blur-md">
                                {hub.name[lang]}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* Region label (на контейнере — всегда видна) */}
                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                  <span className="font-serif text-5xl font-light text-zinc-100/10 select-none tracking-widest">
                    MENA
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="border-t border-zinc-900 bg-zinc-950/50 px-6 py-24 relative z-10">
        <div className="mx-auto max-w-7xl">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-14 font-serif text-4xl font-light text-zinc-100"
          >
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
                <div className="mb-6 w-12 h-12 rounded-full border border-amber-200/20 flex items-center justify-center text-amber-200/70 transition-colors duration-500 group-hover:border-amber-200/40 group-hover:text-amber-200">
                  {item.icon}
                </div>
                <h3 className="mb-3 font-serif text-2xl font-light text-zinc-100">
                  {item.title[lang]}
                </h3>
                <p className="text-sm font-light leading-relaxed text-zinc-500">
                  {item.body[lang]}
                </p>

                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0 pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer spacer ── */}
      <div className="h-12" />

      {/* ── Location Drawer ── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            {/* Panel */}
 <motion.aside
  key="drawer-panel"
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", stiffness: 320, damping: 34 }}
  className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md overflow-y-auto border-l border-zinc-800/80 bg-zinc-950 p-8 sm:p-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
>
  <div className="flex items-start justify-between">
    <span className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">
      {t.drawerEyebrow[lang]}
    </span>
    <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-amber-200">
      <X className="h-5 w-5" />
    </button>
  </div>

  <h2 className="mt-10 font-serif text-5xl font-light leading-tight text-zinc-100">
    {selected.name[lang]}
  </h2>
  <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-amber-200/70">
    {selected.subtitle[lang]}
  </p>

  <div className="my-8 h-px w-16 bg-amber-200/30" />

  {/* Контент */}
  <div className="space-y-8">
    <div className="text-sm font-light leading-relaxed text-zinc-400">
      {selected.description[lang]}
    </div>

    {/* Блок Условий (rates) */}
    <div>
      <h4 className="text-amber-200 uppercase tracking-widest text-[10px] font-bold mb-3">Earnings & Rates</h4>
      <div className="grid grid-cols-2 gap-y-2 text-xs text-zinc-400">
        <span>Split:</span> <span className="text-zinc-100 text-right">{selected.rates.split}</span>
        <span>Shot:</span> <span className="text-zinc-100 text-right">{selected.rates.shot}</span>
        <span>Incall:</span> <span className="text-zinc-100 text-right">{selected.rates.incall}</span>
        <span>Outcall:</span> <span className="text-zinc-100 text-right">{selected.rates.outcall}</span>
      </div>
    </div>

    {/* Accommodation */}
    <div>
      <h4 className="text-amber-200 uppercase tracking-widest text-[10px] font-bold mb-2">Accommodation</h4>
      <p className="text-xs text-zinc-400">{selected.accommodation[lang]}</p>
    </div>

    {/* Services */}
    <div>
      <h4 className="text-amber-200 uppercase tracking-widest text-[10px] font-bold mb-2">Included Services</h4>
      <p className="text-xs text-zinc-400">{selected.services[lang]}</p>
    </div>
  </div>

  <Link
    href="/login"
    className="mt-10 flex w-full items-center justify-center rounded-full bg-amber-200 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-100"
  >
    {t.drawerCta[lang]}
  </Link>
</motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
