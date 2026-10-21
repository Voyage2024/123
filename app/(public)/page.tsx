"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Lock,
  BadgeDollarSign,
  Key,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext"; // <-- ДОБАВИЛИ ИМПОРТ ГЛОБАЛЬНОГО ЯЗЫКА
import GuidesSection from "./_components/GuidesSection";

// next/font переименовывает шрифт, поэтому берём его через CSS-переменную
const SERIF = "var(--font-cormorant), Georgia, serif";

export default function HomePage() {
  // Подключаем наш новый глобальный язык
  const { lang } = useLanguage();

  // --- Словарь переводов на 4 языка ---
  const translations = {
    EN: {
      logo: "VOYAGE",
      navEyebrow: "Private Membership",
      heroEyebrow: "Private Membership",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Exclusive community. Premium image events and residencies worldwide.",
      ctaExplore: "Explore Destinations",
      ctaApply: "Apply via Telegram",
      sectionResidencies: "Residencies",
      sectionDestinations: "Current Destinations",
      macroRegion: "Macro Region",
      regionMiddleEast: "Middle East",
      regionEuropeUK: "Europe & UK",
      regionAsiaPacific: "APAC & Australia",
      regionAmericas: "The Americas",
      exploreRegion: "Explore Region",
      sectionWhy: "Why Voyage",
      sectionTrust: "Built on Trust",
      value1Title: "Verified Network",
      value1Desc: "Only verified VIP clients. Each participant undergoes strict verification before joining the club.",
      value2Title: "Flawless Security",
      value2Desc: "24/7 protection protocols. Confidentiality and security of every participant is our top priority.",
      value3Title: "100% Tips Retention",
      value3Desc: "100% retention of tips. Everything you earn above the rate stays with you only.",
      footerRights: "Private Members Only — All Rights Reserved",
      footerAccess: "Member Access →",
      missionEyebrow: "Mission & Positioning",
      manifesto: "We do not just organize travel. Voyage is a private, invitation-only club. A place where the world's elite, the right connections, and impeccable aesthetics converge.",
      pillar1Title: "The Inner Circle",
      pillar1Desc: "Access is everything. Become part of an exclusive network. From closed after-parties in Hollywood to private yacht charters in Monaco, we put you in the right room with the right people.",
      pillar2Title: "Impeccable Image",
      pillar2Desc: "Aesthetic is our currency. We host high-end image parties and elite gatherings where absolute beauty meets undeniable status.",
      pillar3Title: "Ultimate Discretion",
      pillar3Desc: "Your privacy is our highest priority. Flawless security, non-disclosure protocols, and a seamless VIP experience across 4 continents.",
      formEyebrow: "Join The Club",
      formTitle: "Registration Through Telegram Only",
      formDesc: "VOYAGE is a private community. New resident applications and verification are handled exclusively through our official Telegram bot.",
      formSubmit: "Apply via Telegram",
    },
    RU: {
      logo: "VOYAGE",
      navEyebrow: "Приватное членство",
      heroEyebrow: "Приватное членство",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Эксклюзивное комьюнити. Премиальные имиджевые мероприятия и резиденции по всему миру.",
      ctaExplore: "Смотреть направления",
      ctaApply: "Подать заявку через Telegram",
      sectionResidencies: "Резиденции",
      sectionDestinations: "Актуальные направления",
      macroRegion: "Макрорегион",
      regionMiddleEast: "Middle East",
      regionEuropeUK: "Europe & UK",
      regionAsiaPacific: "APAC и Австралия",
      regionAmericas: "The Americas",
      exploreRegion: "Исследовать регион",
      sectionWhy: "Почему Voyage",
      sectionTrust: "Основано на доверии",
      value1Title: "Закрытая сеть",
      value1Desc: "Только проверенные VIP-клиенты. Каждый участник проходит строгую верификацию перед вступлением в клуб.",
      value2Title: "Безупречная защита",
      value2Desc: "24/7 протоколы защиты. Конфиденциальность и безопасность каждого участника — наш главный приоритет.",
      value3Title: "100% сохранение чаевых",
      value3Desc: "Полное сохранение чаевых. Всё, что вы зарабатываете сверх тарифа, остаётся только у вас.",
      footerRights: "Только для членов клуба — Все права защищены",
      footerAccess: "Вход для резидентов →",
      missionEyebrow: "Миссия и позиционирование",
      manifesto: "Мы не просто организуем поездки. Voyage — это закрытый клуб по приглашениям. Место, где пересекаются мировая элита, правильные связи и безупречная эстетика.",
      pillar1Title: "Закрытое комьюнити",
      pillar1Desc: "Доступ решает всё. Станьте частью эксклюзивного нетворка. От закрытых after-party в Голливуде до чартеров в Монако — мы открываем двери в правильные комнаты к нужным людям.",
      pillar2Title: "Безупречный имидж",
      pillar2Desc: "Эстетика — наша валюта. Мы организуем премиальные имидж-вечеринки и элитные собрания, где абсолютная красота встречается с непререкаемым статусом.",
      pillar3Title: "Абсолютная приватность",
      pillar3Desc: "Ваша приватность — наш абсолютный приоритет. Безупречная безопасность, протоколы конфиденциальности и бесшовный VIP-сервис на 4 континентах.",
      formEyebrow: "Вступление в клуб",
      formTitle: "Регистрация только через Telegram",
      formDesc: "VOYAGE - закрытое сообщество. Регистрация и верификация новых резиденток проходит исключительно через нашего официального Telegram-бота.",
      formSubmit: "Подать заявку",
    },
    ES: {
      logo: "VOYAGE",
      navEyebrow: "Membresía Privada",
      heroEyebrow: "Membresía Privada",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Comunidad exclusiva. Eventos de imagen premium y residencias en todo el mundo.",
      ctaExplore: "Explorar Destinos",
      ctaApply: "Solicitar por Telegram",
      sectionResidencies: "Residencias",
      sectionDestinations: "Destinos Actuales",
      macroRegion: "Macro Región",
      regionMiddleEast: "Medio Oriente",
      regionEuropeUK: "Europa y Reino Unido",
      regionAsiaPacific: "APAC y Australia",
      regionAmericas: "Las Américas",
      exploreRegion: "Explorar Región",
      sectionWhy: "Por qué Voyage",
      sectionTrust: "Basado en la Confianza",
      value1Title: "Red Verificada",
      value1Desc: "Solo clientes VIP verificados. Cada participante pasa por una estricta verificación antes de unirse al club.",
      value2Title: "Seguridad Impecable",
      value2Desc: "Protocolos de protección 24/7. La confidencialidad y seguridad de cada participante es nuestra máxima prioridad.",
      value3Title: "100% Retención de Propinas",
      value3Desc: "Conservas el 100% de tus propinas. Todo lo que ganes por encima de la tarifa es solo tuyo.",
      footerRights: "Solo para Miembros Privados — Todos los Derechos Reservados",
      footerAccess: "Acceso de Miembros →",
      missionEyebrow: "Misión y Posicionamiento",
      manifesto: "No solo organizamos viajes. Voyage es un club privado por invitación. Un lugar donde convergen la élite mundial, las conexiones correctas y una estética impecable.",
      pillar1Title: "El Círculo Interno",
      pillar1Desc: "El acceso lo es todo. Conviértete en parte de una red exclusiva. Desde after-parties cerrados en Hollywood hasta yates privados en Mónaco.",
      pillar2Title: "Imagen Impecable",
      pillar2Desc: "La estética es nuestra moneda. Organizamos fiestas de imagen de alto nivel y reuniones de élite.",
      pillar3Title: "Discreción Absoluta",
      pillar3Desc: "Tu privacidad es nuestra máxima prioridad. Seguridad impecable, protocolos de confidencialidad y una experiencia VIP.",
      formEyebrow: "Únete al club",
      formTitle: "Registro solo a través de Telegram",
      formDesc: "VOYAGE es una comunidad privada. Las solicitudes y la verificación de nuevas residentes se gestionan exclusivamente a través de nuestro bot oficial de Telegram.",
      formSubmit: "Solicitar acceso",
    },
    PT: {
      logo: "VOYAGE",
      navEyebrow: "Assinatura Privada",
      heroEyebrow: "Assinatura Privada",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Comunidade exclusiva. Eventos de imagem premium e residências em todo o mundo.",
      ctaExplore: "Explorar Destinos",
      ctaApply: "Candidatar-se pelo Telegram",
      sectionResidencies: "Residências",
      sectionDestinations: "Destinos Atuais",
      macroRegion: "Macro Região",
      regionMiddleEast: "Oriente Médio",
      regionEuropeUK: "Europa e Reino Unido",
      regionAsiaPacific: "APAC e Austrália",
      regionAmericas: "As Américas",
      exploreRegion: "Explorar Região",
      sectionWhy: "Por que a Voyage",
      sectionTrust: "Construído com Confiança",
      value1Title: "Rede Verificada",
      value1Desc: "Apenas clientes VIP verificados. Cada participante passa por uma rigorosa verificação antes de ingressar no clube.",
      value2Title: "Segurança Impecável",
      value2Desc: "Protocolos de proteção 24/7. A confidencialidade e segurança de cada participante é a nossa prioridade.",
      value3Title: "100% Retenção de Gorjetas",
      value3Desc: "Você mantém 100% de suas gorjetas. Tudo o que você ganha acima da tarifa permanece apenas com você.",
      footerRights: "Apenas para Membros Privados — Todos os Direitos Reservados",
      footerAccess: "Acesso de Membros →",
      missionEyebrow: "Missão e Posicionamento",
      manifesto: "Não organizamos apenas viagens. Voyage é um clube privado apenas para convidados. Um lugar onde a elite mundial, as conexões certas e a estética impecável convergem.",
      pillar1Title: "O Círculo Interno",
      pillar1Desc: "O acesso é tudo. Torne-se parte de uma rede exclusiva. Desde after-parties fechados em Hollywood a iates privados em Mônaco.",
      pillar2Title: "Imagem Impecável",
      pillar2Desc: "A estética é a nossa moeda. Organizamos festas de imagem de alto nível e encontros de elite.",
      pillar3Title: "Discrição Absoluta",
      pillar3Desc: "A sua privacidade é a nossa prioridade. Segurança impecável, protocolos de confidencialidade e uma experiência VIP.",
      formEyebrow: "Entre para o clube",
      formTitle: "Cadastro somente pelo Telegram",
      formDesc: "VOYAGE é uma comunidade privada. O cadastro e a verificação de novas residentes acontecem exclusivamente pelo nosso bot oficial do Telegram.",
      formSubmit: "Candidatar-se",
    }
  };
  // неизвестный язык (или в нижнем регистре) → английский, а не падение страницы
  const t = translations[String(lang).toUpperCase() as keyof typeof translations] ?? translations.EN;

  const scrollToDestinations = () => {
    document.getElementById("destinations")?.scrollIntoView({ behavior: "smooth" });
  };

  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  const applyBotUrl = botUsername ? `https://t.me/${botUsername}?start=apply` : "https://t.me";

  // --- Три столпа (Manifesto pillars) ---
  const pillars = [
    { icon: <Key size={18} strokeWidth={1.5} />, title: t.pillar1Title, desc: t.pillar1Desc },
    { icon: <Sparkles size={18} strokeWidth={1.5} />, title: t.pillar2Title, desc: t.pillar2Desc },
    { icon: <ShieldCheck size={18} strokeWidth={1.5} />, title: t.pillar3Title, desc: t.pillar3Desc },
  ];

  return (
    <div className="text-zinc-100 font-sans antialiased">
      
      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-amber-400/5 blur-[120px]" />
        </div>

        <p className="mb-6 text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium">
          {t.heroEyebrow}
        </p>

        <h1
          className="text-6xl md:text-8xl lg:text-9xl font-light text-zinc-50 leading-none tracking-tight mb-6"
          style={{ fontFamily: SERIF }}
        >
          {t.heroLine1}
          <br />
          <span className="text-amber-200">{t.heroLine2}</span>
          <br />
          {t.heroLine3}
        </h1>

        <div className="w-16 h-px bg-amber-200/40 mx-auto my-8" />

        <p className="max-w-xl text-zinc-400 text-base md:text-lg leading-relaxed mb-12 font-light">
          {t.heroSubtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center z-10">
          <button
            onClick={scrollToDestinations}
            className="px-8 py-3.5 rounded-full bg-amber-200 text-zinc-950 text-sm tracking-widest uppercase font-semibold hover:bg-amber-100 transition-colors duration-300 min-w-[220px]"
          >
            {t.ctaExplore}
          </button>
          <a
            href={applyBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 rounded-full border border-amber-200/30 bg-amber-200/[0.06] text-amber-100 text-sm tracking-widest uppercase font-medium hover:border-amber-200/60 hover:bg-amber-200/[0.1] transition-all duration-300 min-w-[220px]"
          >
            {t.ctaApply}
          </a>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-amber-200/60 animate-pulse" />
        </div>
      </section>

      {/* ─── Mission & Positioning (Манифест и Три столпа) ─── */}
      <section className="relative px-6 py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[420px] rounded-full bg-amber-400/[0.04] blur-[130px]" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-10"
          >
            {t.missionEyebrow}
          </motion.p>

          <motion.blockquote
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            className="mx-auto max-w-4xl text-center text-2xl md:text-4xl lg:text-[2.6rem] font-light leading-snug text-zinc-100"
            style={{ fontFamily: SERIF }}
          >
            {t.manifesto}
          </motion.blockquote>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="w-16 h-px bg-amber-200/40 mx-auto my-16 origin-center"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-sm p-8 hover:border-amber-200/20 transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 text-amber-200/70 group-hover:border-amber-200/40 group-hover:text-amber-200 transition-colors duration-500">
                  {p.icon}
                </div>
                <h3
                  className="text-2xl font-light text-zinc-100 mb-4"
                  style={{ fontFamily: SERIF }}
                >
                  {p.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-light">
                  {p.desc}
                </p>

                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Destinations ─── */}
      <section id="destinations" className="px-6 py-28 max-w-6xl mx-auto">
        <div className="mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.sectionResidencies}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100 leading-tight"
              style={{ fontFamily: SERIF }}
            >
              {t.sectionDestinations}
            </h2>
          </div>
          <div className="w-24 h-px bg-zinc-800 self-center hidden md:block" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ── Middle East ── */}
          <Link
            href="/destinations/middle-east"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionMiddleEast}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  10 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Elite Outcall
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  High-End Hubs
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>

          {/* ── Europe & UK ── */}
          <Link
            href="/destinations/europe"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionEuropeUK}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  20 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Euro Tours
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Fashion Capitals
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>

          {/* ── Asia-Pacific ── */}
          <Link
            href="/destinations/asia-pacific"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionAsiaPacific}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  10 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  High Traffic
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Visa Support
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>

          {/* ── The Americas ── */}
          <Link
            href="/destinations/americas"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionAmericas}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  10 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Coast-to-Coast
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  5★ Hotels
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>
        </div>
      </section>

      {/* ─── Guides & Cheat Sheets (после направлений: «куда» → «как собраться») ─── */}
      <GuidesSection />

      {/* ─── Why Voyage / Values ─── */}
      <section className="px-6 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.sectionWhy}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100"
              style={{ fontFamily: SERIF }}
            >
              {t.sectionTrust}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Verified Network */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <Shield size={16} strokeWidth={1.5} className="text-amber-200/70" />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: SERIF }}
              >
                {t.value1Title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {t.value1Desc}
              </p>
            </div>

            {/* Flawless Security */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <Lock size={16} strokeWidth={1.5} className="text-amber-200/70" />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: SERIF }}
              >
                {t.value2Title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {t.value2Desc}
              </p>
            </div>

            {/* 100% Tips Retention */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <BadgeDollarSign size={16} strokeWidth={1.5} className="text-amber-200/70" />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: SERIF }}
              >
                {t.value3Title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {t.value3Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Telegram-only Membership ─── */}
      <section
        id="apply"
        className="relative overflow-hidden border-t border-white/5 bg-zinc-950 px-6 py-24 scroll-mt-8"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-3xl -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-96 -translate-x-1/2 rounded-full bg-amber-400/[0.06] blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-amber-200/15 bg-zinc-900/40 px-7 py-12 text-center shadow-[0_24px_100px_-48px_rgba(251,191,36,0.16)] backdrop-blur-xl sm:px-12 sm:py-16"
        >
          <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-amber-200/[0.06]" />
          <div className="relative mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/[0.06] text-amber-100">
            <ShieldCheck size={26} strokeWidth={1.35} />
          </div>
          <p className="relative mb-4 text-[10px] font-medium uppercase tracking-[0.45em] text-amber-200/60">
            {t.formEyebrow}
          </p>
          <h2 className="relative mx-auto max-w-2xl text-3xl font-light leading-tight text-zinc-50 sm:text-4xl md:text-5xl" style={{ fontFamily: SERIF }}>
            {t.formTitle}
          </h2>
          <div className="relative mx-auto my-7 h-px w-16 bg-amber-200/35" />
          <p className="relative mx-auto max-w-xl text-sm font-light leading-7 text-zinc-400 sm:text-base">
            {t.formDesc}
          </p>
          <a
            href={applyBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-9 inline-flex min-w-56 items-center justify-center gap-2.5 rounded-full bg-amber-200 px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 shadow-[0_0_24px_rgba(251,191,36,0.1)] transition duration-300 hover:bg-amber-100 hover:shadow-[0_0_34px_rgba(251,191,36,0.18)]"
          >
            {t.formSubmit}
            <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
          </a>
          {!botUsername && <p role="alert" className="relative mt-4 text-xs text-amber-100/70">NEXT_PUBLIC_BOT_USERNAME is not configured.</p>}
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="px-8 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <span
          className="text-amber-200/40 font-serif tracking-[0.35em] text-sm font-light"
          style={{ fontFamily: SERIF }}
        >
          {t.logo}
        </span>
        <p className="text-zinc-700 text-xs tracking-widest uppercase">
          {t.footerRights}
        </p>
        <Link
          href="/login"
          className="text-zinc-600 text-xs tracking-widest uppercase hover:text-amber-200/60 transition-colors duration-300"
        >
          {t.footerAccess}
        </Link>
      </footer>
    </div>
  );
}
