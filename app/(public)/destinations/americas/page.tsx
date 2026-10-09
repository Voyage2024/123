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

const MAP_W = 1928;
const MAP_H = 1452;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;
const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? { height: "100%", width: `${(IMG_RATIO / TARGET_RATIO) * 100}%` }
    : { width: "100%", height: `${(TARGET_RATIO / IMG_RATIO) * 100}%` };

const ARTERIES: string[] = [
  "12.5,20 11.9,26.3 10.9,33.8 11,45.1 13.6,51.1 15.5,54.8 17.6,57.7",
  "72,31.1 77.3,41.5 75.8,44.5",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <Users className="w-7 h-7" />,
    title: { EN: "Elite Networking", RU: "Элитный нетворкинг", ES: "Networking de élite", PT: "Networking de elite" },
    body: {
      EN: "Access to closed business communities and private clubs.",
      RU: "Доступ в закрытые бизнес-сообщества и частные клубы.",
      ES: "Acceso a comunidades empresariales cerradas y clubes privados.",
      PT: "Acesso a comunidades empresariais fechadas e clubes privados.",
    },
  },
  {
    icon: <Gem className="w-7 h-7" />,
    title: { EN: "Premium Lifestyle", RU: "Люксовый лайфстайл", ES: "Estilo de vida premium", PT: "Estilo de vida premium" },
    body: {
      EN: "Penthouse residencies, superyachts, and private jet charters.",
      RU: "Резиденции в пентхаусах, суперяхты и чартеры частных джетов.",
      ES: "Residencias en áticos, superyates y vuelos chárter en jets privados.",
      PT: "Residências em coberturas, superiates e fretamento de jatos particulares.",
    },
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    title: { EN: "Exclusive Parties", RU: "Закрытые вечеринки", ES: "Fiestas exclusivas", PT: "Festas exclusivas" },
    body: {
      EN: "VIP access to the most high-profile image events.",
      RU: "VIP-доступ на самые громкие имиджевые мероприятия.",
      ES: "Acceso VIP a los eventos de imagen más destacados.",
      PT: "Acesso VIP aos eventos de imagem de maior destaque.",
    },
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

export default function AmericasPage() {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const currentLang = lang as Lang;

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(true);

  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<
    "idle" | "checking" | "active" | "rejected_wait" | "submitting" | "error"
  >("idle");
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [applicationErrorType, setApplicationErrorType] = useState<"check" | "submit" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadHubs = async () => {
      setLoadingHubs(true);
      const { data, error } = await supabase
        .from("map_hubs")
        .select("*")
        .eq("region", "americas")
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
        setApplicationStatus("idle");
        setApplicationError(null);
        setApplicationErrorType(null);
        return;
      }

      setApplicationStatus("checking");
      setApplicationError(null);
      setApplicationErrorType(null);

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
        setApplicationStatus("error");
        setApplicationError(error.message);
        setApplicationErrorType("check");
        return;
      }

      if (!data) {
        setApplicationStatus("idle");
        return;
      }

      if (data.status === "pending" || data.status === "approved") {
        setApplicationStatus("active");
        return;
      }

      if (data.status === "rejected") {
        const rejectedAt = new Date(data.created_at);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        setApplicationStatus(rejectedAt > oneMonthAgo ? "rejected_wait" : "idle");
        return;
      }

      setApplicationStatus("idle");
    };

    void checkApplication();
    return () => { cancelled = true; };
  }, [selected, user]);

  const applyForTour = async () => {
    if (!selected || !user || applicationStatus !== "idle") return;

    setApplicationStatus("submitting");
    setApplicationError(null);
    setApplicationErrorType(null);

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      hub_id: selected.id,
      status: "pending",
    });

    if (error) {
      setApplicationError(error.message);
      setApplicationErrorType("submit");
      setApplicationStatus("idle");
      return;
    }

    setApplicationStatus("active");
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
        EN: "AMERICAS",
        RU: "АМЕРИКА",
        ES: "AMÉRICAS",
        PT: "AMÉRICAS",
      },
      heroSubtitle: {
        EN: "An elite closed community across the United States & Canada — networking, premium lifestyle and private image events.",
        RU: "Элитное закрытое комьюнити в США и Канаде — нетворкинг, люксовый лайфстайл и приватные имидж-мероприятия.",
        ES: "Una comunidad privada de élite en Estados Unidos y Canadá — networking, estilo de vida premium y eventos privados.",
        PT: "Uma comunidade privada de elite nos Estados Unidos e Canadá — networking, estilo de vida premium e eventos privados.",
      },
      hubsLabel: {
        EN: "Member Destinations",
        RU: "Направления клуба",
        ES: "Destinos para miembros",
        PT: "Destinos para membros",
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
        PT: "Privilégios da associação",
      },
      drawerEyebrow: {
        EN: "Location Dossier",
        RU: "Досье локации",
        ES: "Dossier de ubicación",
        PT: "Dossiê da localização",
      },
      residentLogin: {
        EN: "Resident Access",
        RU: "Вход для резидентов",
        ES: "Acceso de residentes",
        PT: "Acesso para residentes",
      },
      profile: {
        EN: "Profile",
        RU: "Профиль",
        ES: "Perfil",
        PT: "Perfil",
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
        PT: "Inscrição ativa",
      },
      rejectedWait: {
        EN: "Rejected (Wait 1 month)",
        RU: "Отказ (повтор через месяц)",
        ES: "Rechazada (espera 1 mes)",
        PT: "Rejeitada (aguarde 1 mês)",
      },
      applyForTour: {
        EN: "Apply for Tour",
        RU: "Подать заявку",
        ES: "Solicitar tour",
        PT: "Candidatar-se ao tour",
      },
      submitting: {
        EN: "Submitting...",
        RU: "Отправка...",
        ES: "Enviando...",
        PT: "Enviando...",
      },
      checkError: {
        EN: "Unable to check application",
        RU: "Не удалось проверить заявку",
        ES: "No se pudo comprobar la solicitud",
        PT: "Não foi possível verificar a solicitação",
      },
      submitError: {
        EN: "Application could not be submitted. Please try again.",
        RU: "Не удалось отправить заявку. Попробуйте еще раз.",
        ES: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
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
        PT: "Acomodação",
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
        ES: "Sesión",
        PT: "Sessão",
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
                        <div className="flex items-center gap-5 min-w-0">
                          <span className={`font-mono text-sm transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-700"}`}>{num}</span>
                          <div className="min-w-0">
                            <h3 className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"}`}>{hub.name[currentLang]}</h3>
                            <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-amber-200/70" : "text-zinc-600"}`}>{hub.subtitle[currentLang]}</p>
                          </div>
                        </div>
                        <ChevronRight className={`h-5 w-5 shrink-0 transition-all duration-300 ${isActive ? "translate-x-0 text-amber-200 opacity-100" : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`} />
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
                    onClick={applyForTour}
                    disabled={applicationStatus !== "idle"}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all ${
                      applicationStatus === "idle"
                        ? "bg-amber-200 text-zinc-950 hover:bg-amber-100"
                        : "cursor-not-allowed border border-zinc-800 bg-zinc-900/60 text-zinc-500"
                    }`}
                  >
                    {applicationStatus === "checking" || applicationStatus === "submitting" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}

                    {applicationStatus === "checking"
                      ? t.checking[currentLang]
                      : applicationStatus === "active"
                        ? t.applicationActive[currentLang]
                        : applicationStatus === "rejected_wait"
                          ? t.rejectedWait[currentLang]
                          : applicationStatus === "submitting"
                            ? t.submitting[currentLang]
                            : applicationStatus === "error"
                              ? t.checkError[currentLang]
                              : t.applyForTour[currentLang]}
                  </button>

                  {applicationError && (
                    <p className="mt-3 text-center text-[11px] leading-relaxed text-red-300/70">
                      {applicationErrorType === "check"
                        ? t.checkError[currentLang]
                        : t.submitError[currentLang]}
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