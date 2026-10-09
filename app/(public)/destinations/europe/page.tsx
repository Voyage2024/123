"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  ShieldCheck,
  Plane,
  Crown,
  MapPin,
  ChevronRight,
  Loader2,
  UserRound,
  X,
  Lock,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
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

const STAGE_STYLE: React.CSSProperties = { width: "100%", height: "100%" };

const ARTERIES: string[] = [
  "30.0,41.6 35.0,52.3 46.5,59.4 55.0,77.6",
  "18.0,82.6 45.0,67.8 45.6,67.6 55.0,77.6",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    title: { EN: "Schengen Access", RU: "Шенгенская зона", ES: "Acceso Schengen", PT: "Acesso Schengen" },
    body: {
      EN: "Seamless borderless movement across the Schengen area on a single visa.",
      RU: "Свободное передвижение по Шенгенской зоне без границ — по единой визе.",
      ES: "Movilidad fluida por el espacio Schengen con un solo visado.",
      PT: "Mobilidade fluida por todo o espaço Schengen com um único visto.",
    },
  },
  {
    icon: <Plane className="w-7 h-7" />,
    title: { EN: "Euro Tours", RU: "Евро-туры", ES: "Euro Tours", PT: "Euro Tours" },
    body: {
      EN: "Private charters and curated residences linking every hub in one golden arc.",
      RU: "VIP-чартеры и подобранные резиденции, связывающие хабы в единую золотую дугу.",
      ES: "Vuelos privados y residencias seleccionadas que conectan todos los hubs en un mismo circuito.",
      PT: "Voos privados e residências selecionadas que conectam todos os hubs em um único circuito.",
    },
  },
  {
    icon: <Crown className="w-7 h-7" />,
    title: { EN: "Exclusive Parties", RU: "Закрытые вечеринки", ES: "Fiestas Exclusivas", PT: "Festas Exclusivas" },
    body: {
      EN: "Invitation-only access to elite image events behind unmarked doors.",
      RU: "Доступ по приглашению на закрытые имидж-мероприятия за неприметными дверями.",
      ES: "Acceso solo por invitación a eventos de imagen exclusivos tras puertas discretas.",
      PT: "Acesso por convite a eventos de imagem exclusivos atrás de portas discretas.",
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
        className={`relative z-10 inline-flex rounded-full transition-all duration-500 ${
          active
            ? "h-4 w-4 bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)]"
            : "h-2 w-2 bg-amber-200/40 backdrop-blur-sm"
        }`}
      />
    </div>
  );
}

export default function EuropePage() {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const currentLang = lang as Lang;

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(true);

  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  const [applicationChecking, setApplicationChecking] = useState(false);
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [applicationError, setApplicationError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadHubs = async () => {
      setLoadingHubs(true);
      const { data, error } = await supabase
        .from("map_hubs")
        .select("*")
        .eq("region", "europe")
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

  const t = useMemo(
    () => ({
      back: {
        EN: "Back to Global Map",
        RU: "К глобальной карте",
        ES: "Volver al mapa global",
        PT: "Voltar ao mapa global",
      },
      heroTitle: {
        EN: "EUROPE & GREAT BRITAIN",
        RU: "ЕВРОПА И ВЕЛИКОБРИТАНИЯ",
        ES: "EUROPA Y GRAN BRETAÑA",
        PT: "EUROPA E GRÃ-BRETANHA",
      },
      heroSubtitle: {
        EN: "Twenty destinations curated for VIP travel, image events and private gatherings.",
        RU: "Двадцать направлений для VIP-туров, имидж-вечеринок и закрытых мероприятий.",
        ES: "Veinte destinos seleccionados para viajes VIP, eventos de imagen y reuniones privadas.",
        PT: "Vinte destinos selecionados para viagens VIP, eventos de imagem e encontros privados.",
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
      residentLogin: {
        EN: "Resident Login",
        RU: "Вход для резидентов",
        ES: "Acceso de residentes",
        PT: "Entrada de residentes",
      },
      profile: {
        EN: "Profile",
        RU: "Профиль",
        ES: "Perfil",
        PT: "Perfil",
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
        PT: "Candidatura ativa",
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
      applyForTour: {
        EN: "Apply for Tour",
        RU: "Подать заявку",
        ES: "Solicitar tour",
        PT: "Candidatar-se ao tour",
      },
      applicationError: {
        EN: "Unable to submit the application. Please try again.",
        RU: "Не удалось отправить заявку. Попробуйте еще раз.",
        ES: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
        PT: "Não foi possível enviar a candidatura. Tente novamente.",
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

  const checkApplicationStatus = useCallback(
    async (hubId: string) => {
      if (!user?.id) {
        setApplicationStatus(null);
        setApplicationChecking(false);
        return;
      }

      setApplicationChecking(true);
      setApplicationError(false);

      const { data, error } = await supabase
        .from("applications")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("hub_id", hubId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Application check failed:", error);
        setApplicationStatus(null);
        setApplicationError(true);
        setApplicationChecking(false);
        return;
      }

      if (!data) {
        setApplicationStatus(null);
        setApplicationChecking(false);
        return;
      }

      if (data.status === "pending" || data.status === "approved") {
        setApplicationStatus(data.status);
        setApplicationChecking(false);
        return;
      }

      if (data.status === "rejected") {
        const createdAt = new Date(data.created_at);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        setApplicationStatus(createdAt > oneMonthAgo ? "rejected" : null);
      } else {
        setApplicationStatus(null);
      }

      setApplicationChecking(false);
    },
    [user?.id]
  );

  const openHub = (hub: Hub) => {
    setActiveHub(hub.id);
    setSelected(hub);
    setApplicationStatus(null);
    setApplicationError(false);
    setApplicationChecking(Boolean(user?.id));
  };

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  useEffect(() => {
    if (!selected?.id || !user?.id) {
      setApplicationStatus(null);
      setApplicationChecking(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setApplicationChecking(true);
      setApplicationError(false);

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
        console.error("Application check failed:", error);
        setApplicationStatus(null);
        setApplicationError(true);
        setApplicationChecking(false);
        return;
      }

      if (!data) {
        setApplicationStatus(null);
        setApplicationChecking(false);
        return;
      }

      if (data.status === "pending" || data.status === "approved") {
        setApplicationStatus(data.status);
        setApplicationChecking(false);
        return;
      }

      if (data.status === "rejected") {
        const createdAt = new Date(data.created_at);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        setApplicationStatus(createdAt > oneMonthAgo ? "rejected" : null);
      } else {
        setApplicationStatus(null);
      }

      setApplicationChecking(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [selected?.id, user?.id]);

  const handleApply = async () => {
    if (!user?.id || !selected || applicationSubmitting) return;

    setApplicationSubmitting(true);
    setApplicationError(false);

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      hub_id: selected.id,
      status: "pending",
    });

    if (error) {
      console.error("Application submit failed:", error);
      setApplicationError(true);
      await checkApplicationStatus(selected.id);
      setApplicationSubmitting(false);
      return;
    }

    setApplicationStatus("pending");
    setApplicationSubmitting(false);
  };

  const applicationDisabled =
    applicationChecking ||
    applicationSubmitting ||
    applicationStatus === "pending" ||
    applicationStatus === "approved" ||
    applicationStatus === "rejected";

  const applicationLabel = applicationChecking
    ? t.checking[currentLang]
    : applicationSubmitting
      ? t.submitting[currentLang]
      : applicationStatus === "pending" || applicationStatus === "approved"
        ? t.applicationActive[currentLang]
        : applicationStatus === "rejected"
          ? t.rejectedWait[currentLang]
          : t.applyForTour[currentLang];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-200/20 selection:text-amber-100">
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
              <span>
                {user ? t.profile[currentLang] : t.residentLogin[currentLang]}
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 pb-16 pt-32">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="font-serif text-6xl font-light tracking-tight text-zinc-100 sm:text-7xl lg:text-8xl">
              {t.heroTitle[currentLang]}
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-zinc-400">
              {t.heroSubtitle[currentLang]}
            </p>
          </motion.div>
        </div>

        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-amber-400/5 blur-[120px]" />
      </section>

      <section className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <MapPin className="h-3.5 w-3.5" />
                {t.hubsLabel[currentLang]}
              </div>

              <div className="max-h-[600px] space-y-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                        onMouseLeave={() =>
                          setActiveHub((cur) => (selected ? cur : null))
                        }
                        onClick={() => openHub(hub)}
                        className={`group flex cursor-pointer items-center justify-between rounded-xl px-5 py-4 transition-all duration-300 ${
                          isActive
                            ? "border border-zinc-800/80 bg-zinc-900/60"
                            : "border border-transparent hover:bg-zinc-900/30"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-5">
                          <span
                            className={`font-mono text-sm transition-colors duration-300 ${
                              isActive ? "text-amber-200" : "text-zinc-700"
                            }`}
                          >
                            {num}
                          </span>
                          <div className="min-w-0">
                            <h3
                              className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${
                                isActive
                                  ? "text-amber-200"
                                  : "text-zinc-300 group-hover:text-zinc-100"
                              }`}
                            >
                              {hub.name[currentLang]}
                            </h3>
                            <p
                              className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${
                                isActive
                                  ? "text-amber-200/70"
                                  : "text-zinc-600"
                              }`}
                            >
                              {hub.subtitle[currentLang]}
                            </p>
                          </div>
                        </div>

                        <ChevronRight
                          className={`h-5 w-5 shrink-0 transition-all duration-300 ${
                            isActive
                              ? "translate-x-0 text-amber-200 opacity-100"
                              : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                          }`}
                        />
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <Globe className="h-3.5 w-3.5" />
                {t.mapLabel[currentLang]}
              </div>

              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 shadow-2xl">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={STAGE_STYLE}
                >
                  <Image
                    src="/map-europe.jpg"
                    alt="Europe Map"
                    fill
                    priority
                    className="object-contain opacity-80"
                  />

                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-zinc-950/40 to-zinc-950" />

                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                        <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {ARTERIES.map((points, i) => (
                      <polyline
                        key={i}
                        points={points}
                        fill="none"
                        stroke="url(#lineGrad)"
                        strokeWidth="0.4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>

                  {hubs.map((hub) => {
                    const labelAbove = hub.y > 82;

                    return (
                      <div
                        key={hub.id}
                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
                      >
                        <button
                          type="button"
                          onMouseEnter={() => setActiveHub(hub.id)}
                          onMouseLeave={() =>
                            setActiveHub((cur) => (selected ? cur : null))
                          }
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
                              className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap ${
                                labelAbove
                                  ? "bottom-full mb-3"
                                  : "top-full mt-3"
                              }`}
                            >
                              <div className="rounded-lg border border-amber-200/20 bg-zinc-950/90 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-amber-200 shadow-xl backdrop-blur-md">
                                {hub.name[currentLang]}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <div className="pointer-events-none absolute left-6 top-6 z-10">
                  <span className="select-none font-serif text-5xl font-light tracking-widest text-zinc-100/10">
                    EUROPE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-zinc-900 bg-zinc-950/50 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-14 font-serif text-4xl font-light text-zinc-100"
          >
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
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 text-amber-200/70 transition-colors duration-500 group-hover:border-amber-200/40 group-hover:text-amber-200">
                  {item.icon}
                </div>
                <h3 className="mb-3 font-serif text-2xl font-light text-zinc-100">
                  {item.title[currentLang]}
                </h3>
                <p className="text-sm font-light leading-relaxed text-zinc-500">
                  {item.body[currentLang]}
                </p>
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-12" />

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
              className="fixed bottom-0 right-0 top-0 z-[70] w-full max-w-md overflow-y-auto border-l border-zinc-800/80 bg-zinc-950 p-8 sm:p-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">
                  {t.drawerEyebrow[currentLang]}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="-mr-2 -mt-2 rounded-full p-2 text-zinc-500 transition-colors hover:text-amber-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2 className="mt-10 font-serif text-5xl font-light leading-tight text-zinc-100">
                {selected.name[currentLang]}
              </h2>
              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-amber-200/70">
                {selected.subtitle[currentLang]}
              </p>
              <div className="my-8 h-px w-16 bg-amber-200/30" />
              
              <div className="space-y-8">
                <p className="text-sm font-light leading-relaxed text-zinc-400">
                  {selected.description[currentLang]}
                </p>

                {user ? (
                  <>
                    <div>
                      <h4 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
                        {t.ratesLabel[currentLang]}
                      </h4>
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

                    <div>
                      <h4 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
                        {t.accommodationLabel[currentLang]}
                      </h4>
                      <p className="text-sm font-light leading-relaxed text-zinc-400">
                        {selected.accommodation[currentLang]}
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
                        {t.servicesLabel[currentLang]}
                      </h4>
                      <p className="text-sm font-light leading-relaxed text-zinc-400">
                        {selected.services[currentLang]}
                      </p>
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

              <div className="mt-10">
                {!user ? (
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-full bg-amber-200 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-100"
                  >
                    {t.residentLogin[currentLang]}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={applicationDisabled}
                      aria-busy={applicationChecking || applicationSubmitting}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                        applicationDisabled
                          ? "cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500"
                          : "bg-amber-200 text-zinc-950 hover:bg-amber-100 hover:shadow-[0_0_24px_rgba(251,191,36,0.12)]"
                      }`}
                    >
                      {(applicationChecking || applicationSubmitting) && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {applicationLabel}
                    </button>

                    {applicationError && (
                      <p className="mt-3 text-center text-xs leading-relaxed text-red-300/80">
                        {t.applicationError[currentLang]}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}