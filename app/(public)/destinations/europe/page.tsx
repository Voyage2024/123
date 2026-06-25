"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  ShieldCheck,
  Plane,
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
// ─────────────────────────────────────────────────────────────
const MAP_W = 2232;
const MAP_H = 1208;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` }
    : { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` };

// ─────────────────────────────────────────────────────────────
// Data — координаты выверены по /map-europe.jpg (2232×1208).
// ─────────────────────────────────────────────────────────────
const HUBS: Hub[] = [
  { id: "paris",       name: { EN: "PARIS",          RU: "ПАРИЖ" },          subtitle: { EN: "Haute Couture & Soirées", RU: "Высокая мода и приёмы" }, x: 20.5, y: 44.5,
    body: { EN: "The capital of taste. Couture houses, private soirées, and the art of being seen at the right table. The benchmark for European elegance.", RU: "Столица вкуса. Дома высокой моды, приватные приёмы и искусство быть замеченным за нужным столом. Эталон европейской элегантности." } },
  { id: "nice",        name: { EN: "NICE",           RU: "НИЦЦА" },          subtitle: { EN: "Riviera Privée", RU: "Приватная Ривьера" }, x: 27.3, y: 65.2,
    body: { EN: "The Riviera at its most private. Sun, sea, and long afternoons that drift into golden evenings on the Côte d'Azur.", RU: "Ривьера в её самой закрытой форме. Солнце, море и долгие дни, перетекающие в золотые вечера на Лазурном берегу." } },
  { id: "monaco",      name: { EN: "MONACO",         RU: "МОНАКО" },         subtitle: { EN: "The Billionaire's Principality", RU: "Княжество миллиардеров" }, x: 28.2, y: 64.6,
    body: { EN: "A principality built for billionaires. Superyachts, casinos, and a skyline of quiet power. Old-world glamour at its peak.", RU: "Княжество, созданное для миллиардеров. Суперяхты, казино и силуэт тихой власти. Гламур старого света на пике." } },
  { id: "uk",          name: { EN: "UNITED KINGDOM", RU: "ВЕЛИКОБРИТАНИЯ" }, subtitle: { EN: "Members-Only London", RU: "Лондон только для своих" }, x: 15.5, y: 33.4,
    body: { EN: "London behind closed doors. Members-only clubs, old money, and introductions that open every room in the city.", RU: "Лондон за закрытыми дверями. Клубы для своих, старые деньги и знакомства, открывающие любые двери города." } },
  { id: "germany",     name: { EN: "GERMANY",        RU: "ГЕРМАНИЯ" },       subtitle: { EN: "Berlin After-Dark", RU: "Берлин после полуночи" }, x: 36.3, y: 29.5,
    body: { EN: "Berlin after dark. Underground glamour, fearless nights, and a scene that never asks for names. Freedom with an edge.", RU: "Берлин после полуночи. Подпольный гламур, бесстрашные ночи и сцена, которая не спрашивает имён. Свобода на грани." } },
  { id: "italy",       name: { EN: "ITALY",          RU: "ИТАЛИЯ" },         subtitle: { EN: "La Dolce Vita", RU: "Сладкая жизнь" }, x: 36.2, y: 72.9,
    body: { EN: "La dolce vita, perfected. Lake villas, fashion houses, and pleasure as a way of life — from Milan to the Amalfi coast.", RU: "Сладкая жизнь в совершенстве. Виллы у озёр, дома моды и удовольствие как образ жизни — от Милана до побережья Амальфи." } },
  { id: "spain",       name: { EN: "SPAIN",          RU: "ИСПАНИЯ" },        subtitle: { EN: "Sun-Drenched Soirées", RU: "Солнечные приёмы" }, x: 9.6, y: 77.6,
    body: { EN: "Sun-drenched and unhurried. Marbella terraces, island parties, and warm Mediterranean nights that never end too soon.", RU: "Залитая солнцем и неспешная. Террасы Марбельи, островные вечеринки и тёплые средиземноморские ночи, которые не заканчиваются слишком рано." } },
  { id: "switzerland", name: { EN: "SWITZERLAND",    RU: "ШВЕЙЦАРИЯ" },      subtitle: { EN: "Discreet Wealth", RU: "Тихое богатство" }, x: 29.6, y: 50.4,
    body: { EN: "Where wealth stays silent. Alpine privacy, private banking, and absolute discretion. Status without a single word.", RU: "Где богатство молчит. Альпийская приватность, частный банкинг и абсолютная конфиденциальность. Статус без единого слова." } },
  { id: "greece",      name: { EN: "GREECE",         RU: "ГРЕЦИЯ" },         subtitle: { EN: "Aegean Escapes", RU: "Эгейские уединения" }, x: 50.0, y: 86.5,
    body: { EN: "Aegean blue and white. Island-hopping by yacht, hidden coves, and escapes far from prying eyes.", RU: "Сине-белая Эгеида. Острова на яхте, скрытые бухты и уединения вдали от посторонних глаз." } },
  { id: "netherlands", name: { EN: "NETHERLANDS",    RU: "НИДЕРЛАНДЫ" },     subtitle: { EN: "Canal-Side Elite", RU: "Элита у каналов" }, x: 23.2, y: 30.3,
    body: { EN: "Canal-side refinement. A discreet elite that prizes culture, comfort, and quiet status over noise.", RU: "Изысканность у каналов. Тихая элита, ценящая культуру, комфорт и негромкий статус выше шума." } },
  { id: "belgium",     name: { EN: "BELGIUM",        RU: "БЕЛЬГИЯ" },        subtitle: { EN: "Quiet Luxury", RU: "Тихая роскошь" }, x: 22.6, y: 36.3,
    body: { EN: "The art of quiet luxury. Understated, cultured, and effortlessly refined — for those who never need to prove it.", RU: "Искусство тихой роскоши. Сдержанная, культурная и непринуждённо утончённая — для тех, кому не нужно ничего доказывать." } },
  { id: "luxembourg",  name: { EN: "LUXEMBOURG",     RU: "ЛЮКСЕМБУРГ" },     subtitle: { EN: "The Private Vault", RU: "Закрытый сейф" }, x: 25.6, y: 41.4,
    body: { EN: "A private vault of a country. Small, secure, and built for those who value confidentiality above all.", RU: "Страна-сейф. Маленькая, надёжная и созданная для тех, кто ценит конфиденциальность превыше всего." } },
  { id: "denmark",     name: { EN: "DENMARK",        RU: "ДАНИЯ" },          subtitle: { EN: "Nordic Refinement", RU: "Северная утончённость" }, x: 34.9, y: 14.5,
    body: { EN: "Nordic refinement and clean design. Calm, curated, and quietly exclusive. Copenhagen sophistication.", RU: "Скандинавская утончённость и чистый дизайн. Спокойствие, вкус и тихая эксклюзивность. Утончённость Копенгагена." } },
  { id: "norway",      name: { EN: "NORWAY",         RU: "НОРВЕГИЯ" },       subtitle: { EN: "Fjord Seclusion", RU: "Уединение фьордов" }, x: 25.2, y: 2.6,
    body: { EN: "Seclusion among the fjords. Dramatic nature and total privacy at the very edge of the map.", RU: "Уединение среди фьордов. Драматичная природа и полная приватность на самом краю карты." } },
  { id: "sweden",      name: { EN: "SWEDEN",         RU: "ШВЕЦИЯ" },         subtitle: { EN: "Scandinavian Cool", RU: "Скандинавский шик" }, x: 37.5, y: 8.5,
    body: { EN: "Effortless Scandinavian cool. Sleek, modern, and discreetly affluent. Stockholm style done right.", RU: "Непринуждённый скандинавский шик. Лаконичный, современный и негромко состоятельный. Стокгольмский стиль как надо." } },
  { id: "czech",       name: { EN: "CZECH REPUBLIC", RU: "ЧЕХИЯ" },          subtitle: { EN: "Bohemian Grandeur", RU: "Богемское величие" }, x: 38.6, y: 39.7,
    body: { EN: "Bohemian grandeur. Baroque palaces, hidden bars, and Prague nights with a real sense of theatre.", RU: "Богемское величие. Барочные дворцы, скрытые бары и пражские ночи с настоящим театральным размахом." } },
  { id: "albania",     name: { EN: "ALBANIA",        RU: "АЛБАНИЯ" },        subtitle: { EN: "The Rising Riviera", RU: "Восходящая Ривьера" }, x: 47.2, y: 74.1,
    body: { EN: "The Riviera on the rise. Unspoiled coast, fresh energy, and early access before the crowd arrives.", RU: "Восходящая Ривьера. Нетронутый берег, свежая энергия и доступ раньше, чем приходит толпа." } },
  { id: "bosnia",      name: { EN: "BOSNIA",         RU: "БОСНИЯ" },         subtitle: { EN: "The Hidden Gem", RU: "Скрытая жемчужина" }, x: 45.2, y: 64.1,
    body: { EN: "A hidden gem off the radar. Raw beauty, deep history, and privacy for the truly in-the-know.", RU: "Скрытая жемчужина вне радаров. Дикая красота, глубокая история и приватность для по-настоящему посвящённых." } },
  { id: "serbia",      name: { EN: "SERBIA",         RU: "СЕРБИЯ" },         subtitle: { EN: "Belgrade Nightlife", RU: "Ночная жизнь Белграда" }, x: 49.0, y: 62.5,
    body: { EN: "Belgrade never sleeps. River clubs, late nights, and a nightlife with no last call. Raw, electric energy.", RU: "Белград, который не спит. Клубы на реке, поздние ночи и ночная жизнь без последнего звонка. Дикая, электрическая энергия." } },
  { id: "montenegro",  name: { EN: "MONTENEGRO",     RU: "ЧЕРНОГОРИЯ" },     subtitle: { EN: "The Adriatic Secret", RU: "Адриатический секрет" }, x: 46.5, y: 69.7,
    body: { EN: "The Adriatic's best-kept secret. Marina life, mountain views, and quiet superyacht glamour around Porto Montenegro.", RU: "Главный секрет Адриатики. Жизнь у марины, виды на горы и тихий гламур суперяхт вокруг Порто-Монтенегро." } },
  { id: "georgia",     name: { EN: "GEORGIA",        RU: "ГРУЗИЯ" },         subtitle: { EN: "Caucasus Frontier", RU: "Кавказский рубеж" }, x: 87.8, y: 66.2,
    body: { EN: "A frontier of the Caucasus. Bold flavours, warm hospitality, and untamed luxury between mountains and sea.", RU: "Рубеж Кавказа. Смелые вкусы, тёплое гостеприимство и неприручённая роскошь между горами и морем." } },
  { id: "armenia",     name: { EN: "ARMENIA",        RU: "АРМЕНИЯ" },        subtitle: { EN: "Ancient Highlands", RU: "Древнее нагорье" }, x: 86.7, y: 72.5,
    body: { EN: "Ancient highlands and deep heritage. Soulful, storied, and quietly captivating for those who look beyond the obvious.", RU: "Древнее нагорье и глубокое наследие. Душевная, легендарная и негромко притягательная для тех, кто смотрит дальше очевидного." } },
  { id: "cyprus-gr",   name: { EN: "CYPRUS (GREEK)", RU: "КИПР (ГРЕЧ.)" },   subtitle: { EN: "Mediterranean Haven", RU: "Средиземноморская гавань" }, x: 68.5, y: 96.0,
    body: { EN: "A Mediterranean haven. Sun, sea, and a relaxed harbour for the well-connected. Easy luxury year-round.", RU: "Средиземноморская гавань. Солнце, море и спокойная пристань для своих. Лёгкая роскошь круглый год." } },
  { id: "cyprus-tr",   name: { EN: "CYPRUS (TURKISH)", RU: "КИПР (ТУР.)" },  subtitle: { EN: "Untouched Shores", RU: "Нетронутые берега" }, x: 67.5, y: 94.3,
    body: { EN: "Untouched shores and easy privacy. A quiet coast away from the crowds — discreet and unhurried.", RU: "Нетронутые берега и лёгкая приватность. Тихое побережье вдали от толпы — деликатно и неспешно." } },
  { id: "latvia",      name: { EN: "LATVIA",         RU: "ЛАТВИЯ" },         subtitle: { EN: "Baltic Elegance", RU: "Балтийская элегантность" }, x: 52.6, y: 9.8,
    body: { EN: "Baltic elegance with an Art Nouveau soul. Refined, walkable, and discreetly chic. Riga at its best.", RU: "Балтийская элегантность с душой модерна. Утончённая, уютная и негромко шикарная. Рига во всей красе." } },
  { id: "lithuania",   name: { EN: "LITHUANIA",      RU: "ЛИТВА" },          subtitle: { EN: "The Amber Coast", RU: "Янтарный берег" }, x: 54.5, y: 19.9,
    body: { EN: "The amber coast. Old-town charm, pine forests, and a calm, cultured pace away from the noise.", RU: "Янтарный берег. Очарование старого города, сосновые леса и спокойный, культурный ритм вдали от шума." } },
  { id: "estonia",     name: { EN: "ESTONIA",        RU: "ЭСТОНИЯ" },        subtitle: { EN: "Digital Aristocracy", RU: "Цифровая аристократия" }, x: 53.1, y: 3.1,
    body: { EN: "A digital aristocracy. Medieval beauty meets a sleek, frictionless modern life. Tallinn, quietly ahead.", RU: "Цифровая аристократия. Средневековая красота встречает гладкую, безбарьерную современность. Таллин, негромко впереди." } },
];

const ARTERIES: string[] = [
  "15.5,33.4 20.5,44.5 36.3,29.5 36.2,72.9",
  "9.6,77.6 27.3,65.2 28.2,64.6 36.2,72.9",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    title: { EN: "Schengen Access", RU: "Шенгенская зона" },
    body: {
      EN: "Seamless borderless movement across the Schengen area on a single visa.",
      RU: "Свободное передвижение по Шенгенской зоне без границ — по единой визе.",
    },
  },
  {
    icon: <Plane className="w-7 h-7" />,
    title: { EN: "Euro Tours", RU: "Евро-туры" },
    body: {
      EN: "Private charters and curated residences linking every hub in one golden arc.",
      RU: "VIP-чартеры и подобранные резиденции, связывающие хабы в единую золотую дугу.",
    },
  },
  {
    icon: <Crown className="w-7 h-7" />,
    title: { EN: "Exclusive Parties", RU: "Закрытые вечеринки" },
    body: {
      EN: "Invitation-only access to elite image events behind unmarked doors.",
      RU: "Доступ по приглашению на закрытые имидж-мероприятия за неприметными дверями.",
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

export default function EuropePage() {
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
      heroTitle: { EN: "EUROPE & GREAT BRITAIN", RU: "ЕВРОПА И ВЕЛИКОБРИТАНИЯ" },
      heroSubtitle: {
        EN: "Twenty-seven destinations curated for VIP travel, image events and private gatherings.",
        RU: "Двадцать семь направлений для VIP-туров, имидж-вечеринок и закрытых мероприятий.",
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
                        <span className={`font-mono text-sm transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-700"}`}>
                          {num}
                        </span>
                        <div>
                          <h3 className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"}`}>
                            {hub.name[lang]}
                          </h3>
                          <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-amber-200/70" : "text-zinc-600"}`}>
                            {hub.subtitle[lang]}
                          </p>
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
                  <Image src="/map-europe.jpg" alt="Europe Map" fill priority className="object-cover opacity-80" />

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

                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                  <span className="font-serif text-5xl font-light text-zinc-100/10 select-none tracking-widest">EUROPE</span>
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
