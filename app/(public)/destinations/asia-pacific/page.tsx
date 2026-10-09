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
  Loader2,
  UserRound,
  Lock,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

type Lang = "EN" | "RU" | "ES" | "PT";

type Localized = Record<Lang, string>;

interface Hub {
  id: string;
  name: Localized;
  subtitle: Localized;
  description: Localized;
  rates: { split: string; shot: string; incall: string; outcall: string };
  accommodation: Localized;
  services: Localized;
  x: number;
  y: number;
}

interface Highlight {
  icon: React.ReactNode;
  title: Localized;
  body: Localized;
}

const MAP_W = 1280;
const MAP_H = 960;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` }
    : { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` };

const ARTERIES: string[] = [
  "53,13.7 43.1,20.7 11.8,40.4 13.4,51.8 34.2,63.7 85.7,89",
  "10.5,48 11.8,40.4 18.2,43.1 21.1,43.7",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <Home className="w-7 h-7" />,
    title: { EN: "Exotic Residencies", RU: "Экзотические резиденции", ES: "Residencias exóticas", PT: "Residências exóticas" },
    body: { EN: "Private villas and premium hospitality across the region's most coveted shores.", RU: "Приватные виллы и премиальный сервис на самых желанных берегах региона.", ES: "Villas privadas y hospitalidad premium en las costas más exclusivas de la región.", PT: "Villas privadas e hospitalidade premium nas costas mais desejadas da região." },
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    title: { EN: "Image Parties", RU: "Имидж-вечеринки", ES: "Fiestas de imagen", PT: "Festas de imagem" },
    body: { EN: "Exclusive access to closed community events behind unmarked doors.", RU: "Эксклюзивный доступ к мероприятиям закрытого комьюнити.", ES: "Acceso exclusivo a eventos de la comunidad privada tras puertas cerradas.", PT: "Acesso exclusivo a eventos da comunidade privada atrás de portas fechadas." },
  },
  {
    icon: <Briefcase className="w-7 h-7" />,
    title: { EN: "Asian Business Hub", RU: "Азиатский нетворкинг", ES: "Hub de negocios asiático", PT: "Hub de negócios asiático" },
    body: { EN: "High-net-worth connections and discreet introductions across Asia & Pacific.", RU: "Связи на высшем уровне и деликатные знакомства по всему региону.", ES: "Conexiones de alto nivel e introducciones discretas por toda Asia y el Pacífico.", PT: "Conexões de alto patrimônio e apresentações discretas por toda a Ásia e o Pacífico." },
  },
];

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
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const currentLang = lang as Lang;

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(true);

  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);
  const [applicationState, setApplicationState] = useState<
    "idle" | "checking" | "available" | "active" | "cooldown" | "submitting" | "error"
  >("idle");
  const [applicationError, setApplicationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadHubs = async () => {
      setLoadingHubs(true);
      const { data, error } = await supabase
        .from("map_hubs")
        .select("*")
        .eq("region", "apac")
        .eq("is_active", true)
        .order("id");

      if (cancelled) return;

      if (error) {
        console.error("Map hubs fetch error:", error);
        setHubs([]);
      } else {
        setHubs(
          (data ?? []).map((hub) => ({
            ...hub,
            x: Number(hub.x),
            y: Number(hub.y),
          })) as Hub[]
        );
      }
      setLoadingHubs(false);
    };

    void loadHubs();
    return () => { cancelled = true; };
  }, []);

  const openHub = (hub: Hub) => {
    setActiveHub(hub.id);
    setSelected(hub);
    setApplicationState(user ? "checking" : "idle");
    setApplicationError(null);
  };

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    const checkApplication = async () => {
      if (!selected || !user) {
        setApplicationState("idle");
        setApplicationError(null);
        return;
      }

      setApplicationState("checking");
      setApplicationError(null);

      const { data, error } = await supabase
        .from("applications")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("hub_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setApplicationState("error");
        setApplicationError(error.message);
        return;
      }

      if (!data) {
        setApplicationState("available");
        return;
      }

      if (data.status === "pending" || data.status === "approved") {
        setApplicationState("active");
        return;
      }

      if (data.status === "rejected") {
        const rejectedAt = new Date(data.created_at);
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 1);

        if (rejectedAt > cutoff) {
          setApplicationState("cooldown");
        } else {
          setApplicationState("available");
        }
      }
    };

    void checkApplication();
    return () => { cancelled = true; };
  }, [selected, user]);

  const submitApplication = async () => {
    if (!selected || !user || applicationState !== "available") return;

    setApplicationState("submitting");
    setApplicationError(null);

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      hub_id: selected.id,
      status: "pending",
    });

    if (error) {
      const message = error.message.toLowerCase();

      if (
        message.includes("active application") ||
        message.includes("one month") ||
        message.includes("duplicate")
      ) {
        setApplicationState("checking");
        const { data } = await supabase
          .from("applications")
          .select("status, created_at")
          .eq("user_id", user.id)
          .eq("hub_id", selected.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.status === "pending" || data?.status === "approved") {
          setApplicationState("active");
          return;
        }

        if (data?.status === "rejected") {
          const rejectedAt = new Date(data.created_at);
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - 1);
          setApplicationState(rejectedAt > cutoff ? "cooldown" : "available");
          return;
        }
      }

      setApplicationState("error");
      setApplicationError(error.message);
      return;
    }

    setApplicationState("active");
  };

  const t = useMemo(
    () => ({
      back: {
        EN: "Back to Global Map",
        RU: "К глобальной карте",
        ES: "Volver al mapa global",
        PT: "Voltar ao mapa global",
      },
      heroTitle: {
        EN: "ASIA & PACIFIC",
        RU: "АЗИЯ И ТИХИЙ ОКЕАН",
        ES: "ASIA Y PACÍFICO",
        PT: "ÁSIA E PACÍFICO",
      },
      heroSubtitle: {
        EN: "An elite closed community across the region - image events, VIP gatherings and premium networking.",
        RU: "Элитное закрытое комьюнити региона - имидж-вечеринки, VIP-ивенты и премиальный нетворкинг.",
        ES: "Una comunidad privada de élite en toda la región - eventos de imagen, encuentros VIP y networking premium.",
        PT: "Uma comunidade privada de elite em toda a região - eventos de imagem, encontros VIP e networking premium.",
      },
      hubsLabel: {
        EN: "Member Destinations",
        RU: "Направления клуба",
        ES: "Destinos del club",
        PT: "Destinos do clube",
      },
      loadingLocations: {
        EN: "Loading locations...",
        RU: "Загрузка локаций...",
        ES: "Cargando ubicaciones...",
        PT: "Carregando localizações..."
      },
      mapLabel: {
        EN: "Regional Overview",
        RU: "Обзор региона",
        ES: "Vista regional",
        PT: "Visão regional",
      },
      highlightsTitle: {
        EN: "Membership Privileges",
        RU: "Привилегии членства",
        ES: "Privilegios de membresía",
        PT: "Privilégios de membro",
      },
      drawerEyebrow: {
        EN: "Location Dossier",
        RU: "Досье локации",
        ES: "Dossier de ubicación",
        PT: "Dossiê da localização",
      },
      profile: {
        EN: "Profile",
        RU: "Профиль",
        ES: "Perfil",
        PT: "Perfil",
      },
      residentLogin: {
        EN: "Resident Login",
        RU: "Вход для резидентов",
        ES: "Acceso de residentes",
        PT: "Entrada de residentes",
      },
      applyForTour: {
        EN: "Apply for Tour",
        RU: "Подать заявку",
        ES: "Solicitar tour",
        PT: "Solicitar tour",
      },
      checking: {
        EN: "Checking...",
        RU: "Проверка...",
        ES: "Comprobando...",
        PT: "Verificando...",
      },
      applicationActive: {
        EN: "Application Active",
        RU: "Заявка активна",
        ES: "Solicitud activa",
        PT: "Solicitação ativa",
      },
      rejectedWait: {
        EN: "Rejected (Wait 1 month)",
        RU: "Отказ (повтор через месяц)",
        ES: "Rechazada (espera 1 mes)",
        PT: "Rejeitada (aguarde 1 mês)",
      },
      submitting: {
        EN: "Submitting...",
        RU: "Отправка...",
        ES: "Enviando...",
        PT: "Enviando...",
      },
      applicationError: {
        EN: "We could not submit the application. Please try again.",
        RU: "Не удалось отправить заявку. Попробуйте ещё раз.",
        ES: "No pudimos enviar la solicitud. Inténtalo de nuevo.",
        PT: "Não foi possível enviar a solicitação. Tente novamente.",
      },
      ratesLabel: {
        EN: "Rates",
        RU: "Тарифы",
        ES: "Tarifas",
        PT: "Tarifas",
      },
      accommodationLabel: {
        EN: "Accommodation",
        RU: "Проживание",
        ES: "Alojamiento",
        PT: "Alojamento",
      },
      servicesLabel: {
        EN: "Services",
        RU: "Условия",
        ES: "Condiciones",
        PT: "Condições",
      },
      splitLabel: {
        EN: "Split",
        RU: "Дележ",
        ES: "Reparto",
        PT: "Divisão",
      },
      shotLabel: {
        EN: "Shot",
        RU: "Shot",
        ES: "Servicio",
        PT: "Serviço",
      },
      incallLabel: {
        EN: "Incall",
        RU: "Incall",
        ES: "Incall",
        PT: "Incall",
      },
      outcallLabel: {
        EN: "Outcall",
        RU: "Outcall",
        ES: "Outcall",
        PT: "Outcall",
      },
      commercialAccess: {
        EN: "Detailed financial terms, rates, and logistics are available only to club residents. Please sign in to access them.",
        RU: "Детальные финансовые условия, тарифы и логистика доступны только резидентам клуба. Пожалуйста, войдите в систему, чтобы получить доступ.",
        ES: "Los detalles financieros, las tarifas y la logística están disponibles solo para los residentes del club. Inicia sesión para obtener acceso.",
        PT: "As condições financeiras detalhadas, as tarifas e a logística estão disponíveis apenas para residentes do clube. Inicie sessão para obter acesso."
      }
    }),
    []
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-200/20 selection:text-amber-100">
      {/* ── Navigation ── */}
      <nav className="fixed inset-x-0 top-0 z-50 h-16 min-h-16 border-b border-zinc-900/50 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-full min-h-16 max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="group flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-400 transition-colors hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t.back[currentLang]}
          </Link>

          <div className="flex items-center gap-3">
            <div
              aria-label="Language"
              className="hidden items-center gap-1 rounded-full border border-zinc-800/70 bg-zinc-900/60 p-1 sm:flex"
            >
              {(["EN", "RU", "ES", "PT"] as Lang[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLang(item)}
                  aria-pressed={currentLang === item}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-medium tracking-widest transition-all duration-200 ${
                    currentLang === item
                      ? "bg-zinc-800 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.08)]"
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <Link
              href={user ? "/profile" : "/login"}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-amber-200/20 bg-zinc-900/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200 transition-all duration-300 hover:border-amber-200/40 hover:bg-zinc-900 hover:text-amber-100"
            >
              <UserRound className="h-3.5 w-3.5" />
              <span>{user ? t.profile[currentLang] : t.residentLogin[currentLang]}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-16 px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <h1 className="font-serif text-6xl font-light tracking-tight text-zinc-100 sm:text-7xl lg:text-8xl">{t.heroTitle[currentLang]}</h1>
            <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-zinc-400">{t.heroSubtitle[currentLang]}</p>
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
                {t.hubsLabel[currentLang]}
              </div>
              <div className="space-y-1 pr-2 max-h-[680px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {loadingHubs ? (
                  <div className="px-5 py-6 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                    {t.loadingLocations[currentLang]}
                  </div>
                ) : (
                  hubs.map((hub, idx) => {
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
                            <h3 className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"}`}>{hub.name[currentLang]}</h3>
                            <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-amber-200/70" : "text-zinc-600"}`}>{hub.subtitle[currentLang]}</p>
                          </div>
                        </div>
                        <ChevronRight className={`h-5 w-5 transition-all duration-300 ${isActive ? "translate-x-0 text-amber-200 opacity-100" : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`} />
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Map */}
            <div className="lg:col-span-7">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <Globe className="h-3.5 w-3.5" />
                {t.mapLabel[currentLang]}
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

                  {hubs.map((hub) => {
                    const labelAbove = hub.y > 82;
                    return (
                      <div key={hub.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${hub.x}%`, top: `${hub.y}%` }}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveHub(hub.id)}
                          onMouseLeave={() => setActiveHub((cur) => (selected ? cur : null))}
                          onClick={() => openHub(hub)}
                          aria-label={hub.name[currentLang]}
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
                              <div className="rounded-lg bg-zinc-950/90 px-4 py-2 text-[10px] tracking-widest uppercase font-medium text-amber-200 shadow-xl border border-amber-200/20 backdrop-blur-md">{hub.name[currentLang]}</div>
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
            {t.highlightsTitle[currentLang]}
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
                <h3 className="mb-3 font-serif text-2xl font-light text-zinc-100">{item.title[currentLang]}</h3>
                <p className="text-sm font-light leading-relaxed text-zinc-500">{item.body[currentLang]}</p>
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
                <span className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">{t.drawerEyebrow[currentLang]}</span>
                <button onClick={() => setSelected(null)} aria-label="Close" className="-mr-2 -mt-2 rounded-full p-2 text-zinc-500 transition-colors hover:text-amber-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h2 className="mt-10 font-serif text-5xl font-light leading-tight text-zinc-100">{selected.name[currentLang]}</h2>
              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-amber-200/70">{selected.subtitle[currentLang]}</p>
              <div className="my-8 h-px w-16 bg-amber-200/30" />
              
              <div className="space-y-8">
                <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.description[currentLang]}</p>

                {user ? (
                  <>
                    {/* Rates */}
                    <div>
                      <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.ratesLabel[currentLang]}</h4>
                      <div className="space-y-2 text-sm text-zinc-400">
                        <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                          <span className="text-zinc-500">{t.splitLabel[currentLang]}</span>
                          <span className="text-right text-zinc-300">{selected.rates.split}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                          <span className="text-zinc-500">{t.shotLabel[currentLang]}</span>
                          <span className="text-right text-zinc-300">{selected.rates.shot}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                          <span className="text-zinc-500">{t.incallLabel[currentLang]}</span>
                          <span className="text-right text-zinc-300">{selected.rates.incall}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t.outcallLabel[currentLang]}</span>
                          <span className="text-right text-zinc-300">{selected.rates.outcall}</span>
                        </div>
                      </div>
                    </div>

                    {/* Accommodation */}
                    <div>
                      <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.accommodationLabel[currentLang]}</h4>
                      <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.accommodation[currentLang]}</p>
                    </div>

                    {/* Services */}
                    <div>
                      <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.servicesLabel[currentLang]}</h4>
                      <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.services[currentLang]}</p>
                    </div>
                  </>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-amber-200/20 bg-zinc-900/30 p-6 backdrop-blur-md">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.08),_transparent_45%)]" />
                    <div className="relative flex flex-col items-center text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 bg-zinc-950/60 text-amber-200/80 shadow-[0_0_25px_rgba(251,191,36,0.06)] backdrop-blur-sm">
                        <Lock className="h-5 w-5" />
                      </div>
                      <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
                        {t.commercialAccess[currentLang]}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!user ? (
                <Link
                  href="/login"
                  className="mt-10 inline-flex items-center justify-center rounded-full bg-amber-200 px-8 py-3 w-full text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-100 hover:shadow-[0_0_30px_rgba(251,191,36,0.12)]"
                >
                  {t.residentLogin[currentLang]}
                </Link>
              ) : (
                <div className="mt-10">
                  <button
                    type="button"
                    onClick={submitApplication}
                    disabled={
                      applicationState === "checking" ||
                      applicationState === "active" ||
                      applicationState === "cooldown" ||
                      applicationState === "submitting" ||
                      applicationState === "error"
                    }
                    className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                      applicationState === "available"
                        ? "bg-amber-200 text-zinc-950 hover:bg-amber-100 hover:shadow-[0_0_24px_rgba(251,191,36,0.14)]"
                        : "cursor-not-allowed border border-zinc-800 bg-zinc-900/70 text-zinc-500"
                    }`}
                  >
                    {applicationState === "checking" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.checking[currentLang]}
                      </>
                    )}

                    {applicationState === "active" && t.applicationActive[currentLang]}

                    {applicationState === "cooldown" && t.rejectedWait[currentLang]}

                    {applicationState === "submitting" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.submitting[currentLang]}
                      </>
                    )}

                    {applicationState === "available" && t.applyForTour[currentLang]}

                    {applicationState === "error" && t.applicationError[currentLang]}
                  </button>

                  {applicationError && applicationState === "error" && (
                    <p className="mt-3 text-center text-xs leading-relaxed text-red-300/70">
                      {t.applicationError[currentLang]}
                    </p>
                  )}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}