"use client";

import React, { useEffect, useState } from "react";
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
  rates: {
    split: string;
    shot: string;
    incall: string;
    outcall: string;
  };
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

type ApplicationState =
  | "checking"
  | "active"
  | "rejected"
  | "available"
  | "submitting";

const MAP_W = 2134;
const MAP_H = 1563;
const TARGET_RATIO = 4 / 3;
const IMG_RATIO = MAP_W / MAP_H;

const STAGE_STYLE: React.CSSProperties =
  IMG_RATIO >= TARGET_RATIO
    ? {
        height: "100%",
        width: `${(IMG_RATIO / TARGET_RATIO) * 100}%`,
      }
    : {
        width: "100%",
        height: `${(TARGET_RATIO / IMG_RATIO) * 100}%`,
      };

const l = (
  EN: string,
  RU: string,
  ES: string,
  PT: string
): Localized => ({
  EN,
  RU,
  ES,
  PT,
});

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <ShieldCheck className="h-7 w-7" />,
    title: l(
      "Visa-Free Access",
      "Безвизовый въезд",
      "Acceso sin visado",
      "Acesso sem visto"
    ),
    body: l(
      "Simplified entry protocols for club residents. Fast-track airport support.",
      "Упрощенные протоколы въезда для резидентов клуба. Fast-track поддержка в аэропорту.",
      "Protocolos de entrada simplificados para residentes del club. Soporte fast-track en el aeropuerto.",
      "Protocolos de entrada simplificados para residentes do clube. Suporte fast-track no aeroporto."
    ),
  },
  {
    icon: <CalendarCheck className="h-7 w-7" />,
    title: l(
      "Prime Season",
      "Высокий сезон",
      "Temporada alta",
      "Alta temporada"
    ),
    body: l(
      "Maximum activity and highest rates from October to April.",
      "Максимальная активность и пиковые ставки с октября по апрель.",
      "Máxima actividad y tarifas más altas de octubre a abril.",
      "Máxima atividade e tarifas mais altas de outubro a abril."
    ),
  },
  {
    icon: <Crown className="h-7 w-7" />,
    title: l(
      "VIP Security",
      "VIP-безопасность",
      "Seguridad VIP",
      "Segurança VIP"
    ),
    body: l(
      "Unmatched level of privacy. Closed residencies and private transportation.",
      "Беспрецедентный уровень приватности. Закрытые резиденции и личные трансферы.",
      "Máximo nivel de privacidad. Residencias privadas y transporte exclusivo.",
      "Nível máximo de privacidade. Residências privadas e transporte exclusivo."
    ),
  },
];

function LanguageToggle({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
}) {
  const languages: Lang[] = ["EN", "RU", "ES", "PT"];

  return (
    <div className="relative flex items-center rounded-full border border-zinc-800 bg-zinc-900/80 p-1">
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className="absolute inset-y-1 rounded-full bg-zinc-800"
        style={{
          width: "calc(25% - 2px)",
          left: `calc(${languages.indexOf(lang) * 25}% + 4px)`,
        }}
      />

      {languages.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLang(item)}
          aria-pressed={lang === item}
          className={`relative z-10 min-w-[42px] px-2 py-1.5 text-[10px] font-medium tracking-widest transition-colors duration-200 ${
            lang === item
              ? "text-amber-200"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {item}
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
          <motion.div
            key="waves"
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 0.4, 0],
                scale: [1, 2.5, 3.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute inline-flex h-4 w-4 rounded-full bg-amber-400/40"
            />

            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 0.3, 0],
                scale: [1, 2, 3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.4,
              }}
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

export default function MiddleEastPage() {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();

  const currentLang = lang as Lang;

  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);

  const [applicationState, setApplicationState] =
    useState<ApplicationState>("available");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(true);

  const t = {
    back: l(
      "Back to Global Map",
      "К глобальной карте",
      "Volver al mapa global",
      "Voltar ao mapa global"
    ),

    heroTitle: l(
      "MIDDLE EAST",
      "БЛИЖНИЙ ВОСТОК",
      "ORIENTE MEDIO",
      "ORIENTE MÉDIO"
    ),

    heroSubtitle: l(
      "The epicenter of luxury. The highest checks, flawless security, and premium image events.",
      "Эпицентр роскоши. Высокие чеки, безупречная безопасность и премиальные имиджевые мероприятия.",
      "El epicentro del lujo. Altos ingresos, seguridad impecable y eventos premium.",
      "O epicentro do luxo. Altos ganhos, segurança impecável e eventos premium."
    ),

    hubsLabel: l(
      "Strategic Locations",
      "Стратегические локации",
      "Ubicaciones estratégicas",
      "Localizações estratégicas"
    ),

    loadingLocations: l(
      "Loading locations...",
      "Загрузка локаций...",
      "Cargando ubicaciones...",
      "Carregando localizações..."
    ),

    mapLabel: l(
      "Regional Overview",
      "Обзор региона",
      "Vista regional",
      "Visão regional"
    ),

    highlightsTitle: l(
      "Regional Highlights",
      "Особенности региона",
      "Aspectos destacados",
      "Destaques regionais"
    ),

    drawerEyebrow: l(
      "Location Dossier",
      "Досье локации",
      "Dossier de ubicación",
      "Dossiê da localização"
    ),

    profile: l(
      "Profile",
      "Профиль",
      "Perfil",
      "Perfil"
    ),

    residentLogin: l(
      "Resident Login",
      "Вход для резидента",
      "Acceso de residente",
      "Login do residente"
    ),

    earningsRates: l(
      "Earnings & Rates",
      "Доходы и ставки",
      "Ingresos y tarifas",
      "Ganhos e tarifas"
    ),

    split: l(
      "Split",
      "Разделение",
      "División",
      "Divisão"
    ),

    shot: l(
      "Short Session",
      "Короткая сессия",
      "Sesión corta",
      "Sessão curta"
    ),

    incall: l(
      "Incall",
      "Incall",
      "Incall",
      "Incall"
    ),

    outcall: l(
      "Outcall",
      "Outcall",
      "Outcall",
      "Outcall"
    ),

    accommodation: l(
      "Accommodation",
      "Проживание",
      "Alojamiento",
      "Alojamento"
    ),

    includedServices: l(
      "Included Services",
      "Включённые услуги",
      "Servicios incluidos",
      "Serviços incluídos"
    ),

    checking: l(
      "Checking...",
      "Проверка...",
      "Comprobando...",
      "Verificando..."
    ),

    active: l(
      "Application Active",
      "Заявка активна",
      "Solicitud activa",
      "Solicitação ativa"
    ),

    rejected: l(
      "Rejected (Wait 1 month)",
      "Отказано (ожидание 1 месяц)",
      "Rechazada (espera 1 mes)",
      "Rejeitada (aguarde 1 mês)"
    ),

    submitting: l(
      "Submitting...",
      "Отправка...",
      "Enviando...",
      "Enviando..."
    ),

    apply: l(
      "Apply for Tour",
      "Подать заявку",
      "Solicitar tour",
      "Solicitar tour"
    ),

    loginRequired: l(
      "Resident access is required to apply.",
      "Для подачи заявки необходим доступ резидента.",
      "Se requiere acceso de residente para solicitar.",
      "É necessário acesso de residente para solicitar."
    ),

    commercialAccess: l(
      "Detailed financial terms, rates, and logistics are available only to club residents. Please sign in to access them.",
      "Детальные финансовые условия, тарифы и логистика доступны только резидентам клуба. Пожалуйста, войдите в систему, чтобы получить доступ.",
      "Los detalles financieros, las tarifas y la logística están disponibles solo para los residentes del club. Inicia sesión para obtener acceso.",
      "As condições financeiras detalhadas, as tarifas e a logística estão disponíveis apenas para residentes do clube. Inicie sessão para obter acesso."
    ),
  };

  const openHub = (hub: Hub) => {
    setActiveHub(hub.id);
    setSelected(hub);
    setApplicationState(user ? "checking" : "available");
  };

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    const loadHubs = async () => {
      setLoadingHubs(true);

      const { data, error } = await supabase
        .from("map_hubs")
        .select("*")
        .eq("region", "mena")
        .eq("is_active", true)
        .order("id");

      if (cancelled) return;

      if (error) {
        console.error("Map hubs fetch error:", error);
        setHubs([]);
        setLoadingHubs(false);
        return;
      }

      setHubs((data ?? []) as Hub[]);
      setLoadingHubs(false);
    };

    void loadHubs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkApplication = async () => {
      if (!selected) return;

      if (!user?.id) {
        setApplicationState("available");
        return;
      }

      setApplicationState("checking");

      const { data, error } = await supabase
        .from("applications")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .eq("hub_id", selected.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Application check error:", error);
        setApplicationState("available");
        return;
      }

      if (!data) {
        setApplicationState("available");
        return;
      }

      if (
        data.status === "pending" ||
        data.status === "approved"
      ) {
        setApplicationState("active");
        return;
      }

      if (data.status === "rejected") {
        const createdAt = new Date(data.created_at);
        const cooldownEnds = new Date(createdAt);

        cooldownEnds.setMonth(
          cooldownEnds.getMonth() + 1
        );

        if (new Date() < cooldownEnds) {
          setApplicationState("rejected");
        } else {
          setApplicationState("available");
        }

        return;
      }

      setApplicationState("available");
    };

    void checkApplication();

    return () => {
      cancelled = true;
    };
  }, [selected, user?.id]);

  const handleApply = async () => {
    if (!selected || !user?.id) return;

    if (
      applicationState === "checking" ||
      applicationState === "active" ||
      applicationState === "rejected" ||
      applicationState === "submitting" ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setApplicationState("submitting");

    try {
      const { data: existingApplication, error: checkError } =
        await supabase
          .from("applications")
          .select("id, status, created_at")
          .eq("user_id", user.id)
          .eq("hub_id", selected.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (checkError) {
        console.error(
          "Application pre-submit check error:",
          checkError
        );

        setApplicationState("available");
        return;
      }

      if (existingApplication) {
        if (
          existingApplication.status === "pending" ||
          existingApplication.status === "approved"
        ) {
          setApplicationState("active");
          return;
        }

        if (
          existingApplication.status === "rejected"
        ) {
          const createdAt = new Date(
            existingApplication.created_at
          );

          const cooldownEnds = new Date(createdAt);

          cooldownEnds.setMonth(
            cooldownEnds.getMonth() + 1
          );

          if (new Date() < cooldownEnds) {
            setApplicationState("rejected");
            return;
          }
        }
      }

      const { error: insertError } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          hub_id: selected.id,
          status: "pending",
        });

      if (insertError) {
        console.error(
          "Application insert error:",
          insertError
        );

        const { data: latestApplication } =
          await supabase
            .from("applications")
            .select("id, status, created_at")
            .eq("user_id", user.id)
            .eq("hub_id", selected.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (
          latestApplication?.status === "pending" ||
          latestApplication?.status === "approved"
        ) {
          setApplicationState("active");
        } else if (
          latestApplication?.status === "rejected"
        ) {
          const createdAt = new Date(
            latestApplication.created_at
          );

          const cooldownEnds = new Date(createdAt);

          cooldownEnds.setMonth(
            cooldownEnds.getMonth() + 1
          );

          setApplicationState(
            new Date() < cooldownEnds
              ? "rejected"
              : "available"
          );
        } else {
          setApplicationState("available");
        }

        return;
      }

      setApplicationState("active");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderApplicationButton = () => {
    if (!user) {
      return (
        <div className="space-y-3">
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-full bg-amber-200 px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 transition-all duration-300 hover:bg-amber-100 hover:shadow-[0_0_30px_rgba(251,191,36,0.12)]"
          >
            {t.residentLogin[currentLang]}
          </Link>

          <p className="text-center text-[10px] uppercase tracking-widest text-zinc-600">
            {t.loginRequired[currentLang]}
          </p>
        </div>
      );
    }

    const config: Record<
      ApplicationState,
      {
        label: string;
        disabled: boolean;
        className: string;
      }
    > = {
      checking: {
        label: t.checking[currentLang],
        disabled: true,
        className:
          "cursor-wait border border-zinc-800 bg-zinc-900 text-zinc-500",
      },

      active: {
        label: t.active[currentLang],
        disabled: true,
        className:
          "cursor-not-allowed border border-amber-200/20 bg-amber-200/5 text-amber-200",
      },

      rejected: {
        label: t.rejected[currentLang],
        disabled: true,
        className:
          "cursor-not-allowed border border-red-400/10 bg-red-400/5 text-zinc-500",
      },

      submitting: {
        label: t.submitting[currentLang],
        disabled: true,
        className:
          "cursor-wait border border-amber-200/20 bg-amber-200/10 text-amber-200",
      },

      available: {
        label: t.apply[currentLang],
        disabled: false,
        className:
          "border border-amber-200/20 bg-amber-200 text-zinc-950 hover:bg-amber-100 hover:shadow-[0_0_35px_rgba(251,191,36,0.12)]",
      },
    };

    const current = config[applicationState];

    return (
      <button
        type="button"
        onClick={handleApply}
        disabled={
          current.disabled || isSubmitting
        }
        className={`mt-10 flex w-full items-center justify-center rounded-full px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${current.className}`}
      >
        {current.label}
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-200/20 selection:text-amber-100">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-900/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="group flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-400 transition-colors hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />

            <span className="hidden sm:inline">
              {t.back[currentLang]}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageToggle
              lang={currentLang}
              setLang={(nextLang) =>
                setLang(nextLang)
              }
            />

            <Link
              href={
                user ? "/profile" : "/login"
              }
              aria-label={
                user
                  ? t.profile[currentLang]
                  : t.residentLogin[currentLang]
              }
              className="group flex h-9 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 text-zinc-400 backdrop-blur-md transition-all duration-300 hover:border-amber-200/20 hover:text-amber-200"
            >
              <UserRound className="h-4 w-4" />

              <span className="hidden text-[10px] font-medium uppercase tracking-widest sm:inline">
                {user
                  ? t.profile[currentLang]
                  : t.residentLogin[currentLang]}
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 pb-16 pt-32">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.8,
              ease: "easeOut",
            }}
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
                  hubs.map((hub, index) => {
                  const isActive =
                    activeHub === hub.id;

                  const number = String(
                    index + 1
                  ).padStart(2, "0");

                  return (
                    <motion.div
                      key={hub.id}
                      onMouseEnter={() =>
                        setActiveHub(hub.id)
                      }
                      onMouseLeave={() =>
                        setActiveHub((current) =>
                          selected
                            ? current
                            : null
                        )
                      }
                      onClick={() =>
                        openHub(hub)
                      }
                      className={`group flex cursor-pointer items-center justify-between rounded-xl px-5 py-4 transition-all duration-300 ${
                        isActive
                          ? "border border-zinc-800/80 bg-zinc-900/60"
                          : "border border-transparent hover:bg-zinc-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <span
                          className={`font-mono text-sm transition-colors duration-300 ${
                            isActive
                              ? "text-amber-200"
                              : "text-zinc-700"
                          }`}
                        >
                          {number}
                        </span>

                        <div>
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
                        className={`h-5 w-5 transition-all duration-300 ${
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
                    src="/map-mena.jpg"
                    alt={
                      t.heroTitle[
                        currentLang
                      ]
                    }
                    fill
                    priority
                    className="object-cover opacity-80"
                  />

                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-zinc-950/40 to-zinc-950" />

                  {hubs.map((hub) => {
                    const labelAbove =
                      hub.y > 82;

                    return (
                      <div
                        key={hub.id}
                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${hub.x}%`,
                          top: `${hub.y}%`,
                        }}
                      >
                        <button
                          type="button"
                          onMouseEnter={() =>
                            setActiveHub(
                              hub.id
                            )
                          }
                          onMouseLeave={() =>
                            setActiveHub(
                              (current) =>
                                selected
                                  ? current
                                  : null
                            )
                          }
                          onClick={() =>
                            openHub(hub)
                          }
                          aria-label={
                            hub.name[
                              currentLang
                            ]
                          }
                          className="flex h-7 w-7 cursor-pointer items-center justify-center"
                        >
                          <RadarNode
                            active={
                              activeHub ===
                              hub.id
                            }
                          />
                        </button>

                        <AnimatePresence>
                          {activeHub ===
                            hub.id && (
                            <motion.div
                              key={`tooltip-${hub.id}`}
                              initial={{
                                opacity: 0,
                                y: labelAbove
                                  ? -10
                                  : 10,
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                              }}
                              exit={{
                                opacity: 0,
                                y: labelAbove
                                  ? -10
                                  : 10,
                              }}
                              transition={{
                                duration: 0.2,
                              }}
                              className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap ${
                                labelAbove
                                  ? "bottom-full mb-3"
                                  : "top-full mt-3"
                              }`}
                            >
                              <div className="rounded-lg border border-amber-200/20 bg-zinc-950/90 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-amber-200 shadow-xl backdrop-blur-md">
                                {
                                  hub.name[
                                    currentLang
                                  ]
                                }
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
                    MENA
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
            initial={{
              opacity: 0,
              y: 12,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              duration: 0.6,
            }}
            className="mb-14 font-serif text-4xl font-light text-zinc-100"
          >
            {t.highlightsTitle[currentLang]}
          </motion.h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item, index) => (
              <motion.div
                key={index}
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                }}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 transition-all duration-500 hover:border-amber-200/30 hover:bg-zinc-900/50"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 text-amber-200/70 transition-colors duration-500 group-hover:border-amber-200/40 group-hover:text-amber-200">
                  {item.icon}
                </div>

                <h3 className="mb-3 font-serif text-2xl font-light text-zinc-100">
                  {
                    item.title[
                      currentLang
                    ]
                  }
                </h3>

                <p className="text-sm font-light leading-relaxed text-zinc-500">
                  {
                    item.body[
                      currentLang
                    ]
                  }
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
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: 0.3,
              }}
              onClick={() =>
                setSelected(null)
              }
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />

            <motion.aside
              key="drawer-panel"
              initial={{
                x: "100%",
              }}
              animate={{
                x: 0,
              }}
              exit={{
                x: "100%",
              }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 34,
              }}
              className="fixed bottom-0 right-0 top-0 z-[70] w-full max-w-md overflow-y-auto border-l border-zinc-800/80 bg-zinc-950 p-8 sm:p-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">
                  {
                    t.drawerEyebrow[
                      currentLang
                    ]
                  }
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSelected(null)
                  }
                  aria-label="Close"
                  className="text-zinc-500 transition-colors hover:text-amber-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2 className="mt-10 font-serif text-5xl font-light leading-tight text-zinc-100">
                {
                  selected.name[
                    currentLang
                  ]
                }
              </h2>

              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-amber-200/70">
                {
                  selected.subtitle[
                    currentLang
                  ]
                }
              </p>

              <div className="my-8 h-px w-16 bg-amber-200/30" />

              <div className="space-y-8">
                <div className="text-sm font-light leading-relaxed text-zinc-400">
                  {
                    selected.description[
                      currentLang
                    ]
                  }
                </div>

                {user ? (
                  <>
                    <div>
                      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                        {
                          t.earningsRates[
                            currentLang
                          ]
                        }
                      </h4>

                      <div className="grid grid-cols-2 gap-y-2 text-xs text-zinc-400">
                        <span>
                          {
                            t.split[
                              currentLang
                            ]
                          }
                          :
                        </span>

                        <span className="text-right text-zinc-100">
                          {
                            selected.rates
                              .split
                          }
                        </span>

                        <span>
                          {
                            t.shot[
                              currentLang
                            ]
                          }
                          :
                        </span>

                        <span className="text-right text-zinc-100">
                          {
                            selected.rates
                              .shot
                          }
                        </span>

                        <span>
                          {
                            t.incall[
                              currentLang
                            ]
                          }
                          :
                        </span>

                        <span className="text-right text-zinc-100">
                          {
                            selected.rates
                              .incall
                          }
                        </span>

                        <span>
                          {
                            t.outcall[
                              currentLang
                            ]
                          }
                          :
                        </span>

                        <span className="text-right text-zinc-100">
                          {
                            selected.rates
                              .outcall
                          }
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                        {
                          t.accommodation[
                            currentLang
                          ]
                        }
                      </h4>

                      <p className="text-xs leading-relaxed text-zinc-400">
                        {
                          selected.accommodation[
                            currentLang
                          ]
                        }
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                        {
                          t.includedServices[
                            currentLang
                          ]
                        }
                      </h4>

                      <p className="text-xs leading-relaxed text-zinc-400">
                        {
                          selected.services[
                            currentLang
                          ]
                        }
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
                        {
                          t.commercialAccess[
                            currentLang
                          ]
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {renderApplicationButton()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}