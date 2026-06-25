"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Shield, BadgeDollarSign, Plane, Key, Sparkles, ShieldCheck } from "lucide-react";

type Lang = "EN" | "RU";

interface TrailParticle {
  id: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

export default function HomePage() {
  // --- Состояния для пасхалки ---
  const [planeClicks, setPlaneClicks] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [trailParticles, setTrailParticles] = useState<TrailParticle[]>([]);
  const particleIdRef = useRef(0);
  const trailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  const handlePlaneClick = () => {
    if (isFlying) return;

    const newCount = planeClicks + 1;
    if (newCount === 5) {
      setIsFlying(true);
      setPlaneClicks(0);
      setTimeout(() => {
        setIsFlying(false);
        setTrailParticles([]);
      }, 3000);
    } else {
      setPlaneClicks(newCount);
    }
  };

  // --- Trail effect: capture plane position every 50ms during flight ---
  useEffect(() => {
    if (!isFlying) {
      if (trailIntervalRef.current) {
        clearInterval(trailIntervalRef.current);
        trailIntervalRef.current = null;
      }
      return;
    }

    // Clear any previous particles at start of new flight
    setTrailParticles([]);
    particleIdRef.current = 0;

    trailIntervalRef.current = setInterval(() => {
      if (planeRef.current) {
        const rect = planeRef.current.getBoundingClientRect();
        const parentRect = planeRef.current.offsetParent?.getBoundingClientRect();
        if (parentRect) {
          const x = rect.left - parentRect.left + rect.width / 2;
          const y = rect.top - parentRect.top + rect.height / 2;
          const id = particleIdRef.current++;

          setTrailParticles(prev => {
            const newParticle: TrailParticle = { id, x, y, opacity: 1, scale: 1 };
            // Keep only last 40 particles for performance
            const updated = [...prev, newParticle];
            if (updated.length > 40) updated.shift();
            return updated;
          });
        }
      }
    }, 50);

    return () => {
      if (trailIntervalRef.current) {
        clearInterval(trailIntervalRef.current);
      }
    };
  }, [isFlying]);

  // --- Fade out trail particles ---
  useEffect(() => {
    if (trailParticles.length === 0) return;

    const fadeInterval = setInterval(() => {
      setTrailParticles(prev => {
        const updated = prev
          .map(p => ({
            ...p,
            opacity: p.opacity - 0.04,
            scale: p.scale - 0.015,
          }))
          .filter(p => p.opacity > 0);
        return updated;
      });
    }, 50);

    return () => clearInterval(fadeInterval);
  }, [trailParticles.length > 0]);

  const [lang, setLang] = useState<Lang>("EN");

  // --- Словарь переводов ---
  const t = {
    EN: {
      logo: "VOYAGE",
      navEyebrow: "Private Membership",
      navLogin: "Member Login",
      heroEyebrow: "Private Membership",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle:
        "Exclusive community. Premium image events and residencies worldwide.",
      ctaExplore: "Explore Destinations",
      ctaApply: "Apply for Membership",
      sectionResidencies: "Residencies",
      sectionDestinations: "Current Destinations",
      macroRegion: "Macro Region",
      regionMiddleEast: "Middle East",
      regionEuropeUK: "Europe & UK",
      regionAsiaPacific: "Asia — Pacific",
      regionAmericas: "The Americas",
      exploreRegion: "Explore Region",
      sectionWhy: "Why Voyage",
      sectionTrust: "Built on Trust",
      value1Title: "Verified Network",
      value1Desc:
        "Only verified VIP clients. Each participant undergoes strict verification before joining the club.",
      value2Title: "Flawless Security",
      value2Desc:
        "24/7 protection protocols. Confidentiality and security of every participant is our top priority.",
      value3Title: "100% Tips Retention",
      value3Desc:
        "100% retention of tips. Everything you earn above the rate stays with you only.",
      footerRights: "Private Members Only — All Rights Reserved",
      footerAccess: "Member Access →",
      langEN: "EN",
      langRU: "RU",

      // Манифест и столпы / Manifesto & Pillars
      missionEyebrow: "Mission & Positioning",
      manifesto:
        "We do not just organize travel. We curate an ecosystem. Voyage is a private, invitation-only community where global elites, visionaries, and premium aesthetics converge.",
      pillar1Title: "The Inner Circle",
      pillar1Desc:
        "Access is everything. Become part of an exclusive network. From closed after-parties in Hollywood to private yacht charters in Monaco, we put you in the right room with the right people.",
      pillar2Title: "Impeccable Image",
      pillar2Desc:
        "Aesthetic is our currency. We host high-end image parties and elite gatherings where absolute beauty meets undeniable status.",
      pillar3Title: "Ultimate Discretion",
      pillar3Desc:
        "Your privacy is our highest priority. Flawless security, non-disclosure protocols, and a seamless VIP experience across 4 continents.",

      // Форма
      formEyebrow: "Join The Club",
      formTitle: "Request an Invitation",
      formDesc: "Membership in VOYAGE PRIVATE CLUB is strictly limited. We review each application individually. Please fill out the form below to initiate the verification process.",
      formName: "Full Name",
      formNamePl: "Your name",
      formContact: "Telegram / WhatsApp",
      formContactPl: "+1...",
      formInsta: "Instagram Profile",
      formInstaPl: "@username",
      formPortfolio: "Portfolio / Snaps Link",
      formPortfolioPl: "Google Drive / Dropbox",
      formStatement: "Statement",
      formStatementPl: "Briefly about your experience and why you want to join Voyage...",
      formConsent1: "I confirm that I am over 18 years old and agree to the ",
      formPrivacy: "Privacy Policy",
      formConsent2: " and processing of my personal data.",
      formSubmit: "Submit Application"
    },
    RU: {
      logo: "VOYAGE",
      navEyebrow: "Приватное членство",
      navLogin: "Вход для резидентов",
      heroEyebrow: "Приватное членство",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle:
        "Эксклюзивное комьюнити. Премиальные имиджевые мероприятия и резиденции по всему миру.",
      ctaExplore: "Смотреть направления",
      ctaApply: "Подать заявку",
      sectionResidencies: "Резиденции",
      sectionDestinations: "Актуальные направления",
      macroRegion: "Макрорегион",
      regionMiddleEast: "Middle East",
      regionEuropeUK: "Europe & UK",
      regionAsiaPacific: "Asia — Pacific",
      regionAmericas: "The Americas",
      exploreRegion: "Исследовать регион",
      sectionWhy: "Почему Voyage",
      sectionTrust: "Основано на доверии",
      value1Title: "Verified Network",
      value1Desc:
        "Только проверенные VIP-клиенты. Каждый участник проходит строгую верификацию перед вступлением в клуб.",
      value2Title: "Flawless Security",
      value2Desc:
        "24/7 протоколы защиты. Конфиденциальность и безопасность каждого участника — наш главный приоритет.",
      value3Title: "100% Tips Retention",
      value3Desc:
        "Полное сохранение чаевых. Всё, что вы зарабатываете сверх тарифа, остаётся только у вас.",
      footerRights: "Только для членов клуба — Все права защищены",
      footerAccess: "Вход для резидентов →",
      langEN: "EN",
      langRU: "RU",

      // Манифест и столпы / Manifesto & Pillars
      missionEyebrow: "Миссия и позиционирование",
      manifesto:
        "Мы не просто организуем поездки. Мы курируем экосистему. Voyage — это закрытое комьюнити по приглашениям, где пересекаются глобальная элита, визионеры и безупречная эстетика.",
      pillar1Title: "Закрытое комьюнити",
      pillar1Desc:
        "Доступ решает всё. Станьте частью эксклюзивного нетворка. От закрытых after-party в Голливуде до чартеров в Монако — мы открываем двери в правильные комнаты к нужным людям.",
      pillar2Title: "Безупречный имидж",
      pillar2Desc:
        "Эстетика — наша валюта. Мы организуем премиальные имидж-вечеринки и элитные собрания, где абсолютная красота встречается с непререкаемым статусом.",
      pillar3Title: "Абсолютная приватность",
      pillar3Desc:
        "Ваша приватность — наш абсолютный приоритет. Безупречная безопасность, протоколы конфиденциальности и бесшовный VIP-сервис на 4 континентах.",

      // Форма
      formEyebrow: "Вступить в клуб",
      formTitle: "Запросить приглашение",
      formDesc: "Членство в VOYAGE PRIVATE CLUB строго лимитировано. Мы рассматриваем каждую заявку индивидуально. Пожалуйста, заполните форму ниже для инициации процесса верификации.",
      formName: "Имя и Фамилия",
      formNamePl: "Ваше имя",
      formContact: "Telegram / WhatsApp",
      formContactPl: "+7...",
      formInsta: "Профиль Instagram",
      formInstaPl: "@username",
      formPortfolio: "Ссылка на портфолио / Снепы",
      formPortfolioPl: "Google Drive / Dropbox",
      formStatement: "О себе",
      formStatementPl: "Коротко о вашем опыте и почему вы хотите присоединиться к Voyage...",
      formConsent1: "Я подтверждаю, что мне больше 18 лет, и согласен с ",
      formPrivacy: "Политикой конфиденциальности",
      formConsent2: " и обработкой моих персональных данных.",
      formSubmit: "Отправить заявку"
    },
  }[lang];

  const scrollToDestinations = () => {
    document.getElementById("destinations")?.scrollIntoView({ behavior: "smooth" });
  };

  // --- Три столпа (Manifesto pillars) ---
  const pillars = [
    { icon: <Key size={18} strokeWidth={1.5} />, title: t.pillar1Title, desc: t.pillar1Desc },
    { icon: <Sparkles size={18} strokeWidth={1.5} />, title: t.pillar2Title, desc: t.pillar2Desc },
    { icon: <ShieldCheck size={18} strokeWidth={1.5} />, title: t.pillar3Title, desc: t.pillar3Desc },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* ─── Public Header (прозрачный, только логотип / язык / Member Login) ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 border-b border-white/5 bg-zinc-950/60 backdrop-blur-md">
        <span
          className="text-amber-200 font-serif tracking-[0.35em] text-xl font-light select-none"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {t.logo}
        </span>

        <div className="flex items-center gap-4">
          {/* Language Switcher */}
          <div className="relative bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-full p-1 flex items-center">
            <div
              className="absolute top-1 left-1 w-8 h-6 rounded-full bg-amber-200/20 transition-all duration-300"
              style={{
                transform: lang === "EN" ? "translateX(0px)" : "translateX(32px)",
              }}
            />
            <button
              onClick={() => setLang("EN")}
              className={`relative z-10 text-[10px] tracking-widest font-medium w-8 h-6 flex items-center justify-center cursor-pointer transition-colors duration-300 ${
                lang === "EN" ? "text-amber-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.langEN}
            </button>
            <button
              onClick={() => setLang("RU")}
              className={`relative z-10 text-[10px] tracking-widest font-medium w-8 h-6 flex items-center justify-center cursor-pointer transition-colors duration-300 ${
                lang === "RU" ? "text-amber-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.langRU}
            </button>
          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 px-5 py-2 rounded-full border border-amber-200/30 text-amber-200 text-sm tracking-widest uppercase font-medium hover:bg-amber-200/10 hover:border-amber-200/60 transition-all duration-300"
          >
            <Lock size={13} strokeWidth={2} />
            {t.navLogin}
          </Link>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-amber-400/5 blur-[120px]" />
        </div>

        {/* Eyebrow */}
        <p className="mb-6 text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium">
          {t.heroEyebrow}
        </p>

        {/* Main heading */}
        <h1
          className="text-6xl md:text-8xl lg:text-9xl font-light text-zinc-50 leading-none tracking-tight mb-6"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {t.heroLine1}
          <br />
          <span className="text-amber-200">{t.heroLine2}</span>
          <br />
          {t.heroLine3}
        </h1>

        {/* Divider */}
        <div className="w-16 h-px bg-amber-200/40 mx-auto my-8" />

        {/* Subheading */}
        <p className="max-w-xl text-zinc-400 text-base md:text-lg leading-relaxed mb-12 font-light">
          {t.heroSubtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button
            onClick={scrollToDestinations}
            className="px-8 py-3.5 rounded-full bg-amber-200 text-zinc-950 text-sm tracking-widest uppercase font-semibold hover:bg-amber-100 transition-colors duration-300 min-w-[220px]"
          >
            {t.ctaExplore}
          </button>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-full border border-zinc-700 text-zinc-300 text-sm tracking-widest uppercase font-medium hover:border-amber-200/40 hover:text-amber-200 transition-all duration-300 min-w-[220px]"
          >
            {t.ctaApply}
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-amber-200/60 animate-pulse" />
        </div>
      </section>

      {/* ─── Mission & Positioning (Манифест и Три столпа) ─── */}
      <section className="relative px-6 py-28 overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[420px] rounded-full bg-amber-400/[0.04] blur-[130px]" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-10"
          >
            {t.missionEyebrow}
          </motion.p>

          {/* Манифест */}
          <motion.blockquote
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            className="mx-auto max-w-4xl text-center text-2xl md:text-4xl lg:text-[2.6rem] font-light leading-snug text-zinc-100"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {t.manifesto}
          </motion.blockquote>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="w-16 h-px bg-amber-200/40 mx-auto my-16 origin-center"
          />

          {/* Три столпа */}
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
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {p.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-light">
                  {p.desc}
                </p>

                {/* Corner accent glow */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Destinations ─── */}
      <section id="destinations" className="px-6 py-28 max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.sectionResidencies}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100 leading-tight"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {t.sectionDestinations}
            </h2>
          </div>
          <div className="w-24 h-px bg-zinc-800 self-center hidden md:block" />
        </div>

        {/* Macro-region cards grid — 2×2 */}
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
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  className="group-hover:translate-x-1 transition-transform duration-300"
                />
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
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {t.regionEuropeUK}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  27 Destinations
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
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  className="group-hover:translate-x-1 transition-transform duration-300"
                />
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
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  className="group-hover:translate-x-1 transition-transform duration-300"
                />
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
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  className="group-hover:translate-x-1 transition-transform duration-300"
                />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>
        </div>
      </section>

      {/* ─── Why Voyage / Values ─── */}
      <section className="px-6 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.sectionWhy}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {t.sectionTrust}
            </h2>
          </div>

          {/* Value cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Verified Network */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <Shield
                  size={16}
                  strokeWidth={1.5}
                  className="text-amber-200/70"
                />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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
                <Lock
                  size={16}
                  strokeWidth={1.5}
                  className="text-amber-200/70"
                />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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
                <BadgeDollarSign
                  size={16}
                  strokeWidth={1.5}
                  className="text-amber-200/70"
                />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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

      {/* ─── Membership Application Form ─── */}
      <section className="px-6 py-24 border-t border-white/5 bg-zinc-950 relative overflow-hidden">
        {/* Декоративное свечение сверху */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

        <div className="max-w-3xl mx-auto">
          {/* Заголовки формы */}
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.formEyebrow}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100 mb-6"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {t.formTitle}
            </h2>
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-light max-w-xl mx-auto">
              {t.formDesc}
            </p>
          </div>

          {/* Сама форма */}
          <form className="space-y-10" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3 relative group">
                <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formName}
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-zinc-800 pb-3 text-zinc-100 focus:outline-none focus:border-amber-200/50 transition-colors placeholder:text-zinc-800 font-light"
                  placeholder={t.formNamePl}
                />
              </div>
              <div className="space-y-3 relative group">
                <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formContact}
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-zinc-800 pb-3 text-zinc-100 focus:outline-none focus:border-amber-200/50 transition-colors placeholder:text-zinc-800 font-light"
                  placeholder={t.formContactPl}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3 relative group">
                <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formInsta}
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-zinc-800 pb-3 text-zinc-100 focus:outline-none focus:border-amber-200/50 transition-colors placeholder:text-zinc-800 font-light"
                  placeholder={t.formInstaPl}
                />
              </div>
              <div className="space-y-3 relative group">
                <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formPortfolio}
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-zinc-800 pb-3 text-zinc-100 focus:outline-none focus:border-amber-200/50 transition-colors placeholder:text-zinc-800 font-light"
                  placeholder={t.formPortfolioPl}
                />
              </div>
            </div>

            <div className="space-y-3 relative group">
              <label className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                {t.formStatement}
              </label>
              <textarea
                rows={2}
                className="w-full bg-transparent border-b border-zinc-800 pb-3 text-zinc-100 focus:outline-none focus:border-amber-200/50 transition-colors placeholder:text-zinc-800 resize-none font-light"
                placeholder={t.formStatementPl}
              />
            </div>

            {/* ─── Legal Consent ─── */}
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="consent"
                required
                className="mt-0.5 appearance-none min-w-[16px] w-4 h-4 rounded-sm border border-zinc-700 bg-transparent checked:bg-amber-200 checked:border-amber-200 focus:outline-none transition-colors cursor-pointer relative after:content-['✓'] after:absolute after:text-zinc-900 after:text-[10px] after:font-bold after:left-1/2 after:-translate-x-1/2 after:top-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100"
              />
              <label htmlFor="consent" className="text-[10px] tracking-wider text-zinc-500 leading-relaxed font-light cursor-pointer select-none">
                {t.formConsent1}
                <a href="/privacy" className="text-amber-200/70 hover:text-amber-200 transition-colors">
                  {t.formPrivacy}
                </a>
                {t.formConsent2}
              </label>
            </div>

            {/* Кнопка отправки с пасхалкой */}
            <div className="pt-8 flex justify-center">
              <style>{`
                @keyframes fly-around-btn {
                  0%   { transform: translate(0px, 0px) rotate(0deg); }
                  8%   { transform: translate(-60px, -45px) rotate(-30deg); }
                  16%  { transform: translate(-130px, -55px) rotate(-60deg); }
                  24%  { transform: translate(-180px, -35px) rotate(-90deg); }
                  32%  { transform: translate(-200px, 0px) rotate(-120deg); }
                  40%  { transform: translate(-180px, 35px) rotate(-150deg); }
                  48%  { transform: translate(-130px, 55px) rotate(-180deg); }
                  56%  { transform: translate(-60px, 45px) rotate(-210deg); }
                  64%  { transform: translate(0px, 0px) rotate(-240deg); }
                  72%  { transform: translate(60px, -45px) rotate(-270deg); }
                  80%  { transform: translate(130px, -55px) rotate(-300deg); }
                  88%  { transform: translate(180px, -35px) rotate(-330deg); }
                  96%  { transform: translate(200px, 0px) rotate(-360deg); }
                  100% { transform: translate(0px, 0px) rotate(-360deg); }
                }

                .animate-fly-around {
                  animation: fly-around-btn 4s linear forwards;
                }
              `}</style>

              <div className="relative group/btn inline-flex items-center justify-center">
                <button
                  type="submit"
                  className="px-12 py-4 rounded-full bg-zinc-100 text-zinc-950 text-[11px] tracking-[0.2em] uppercase font-bold hover:bg-amber-200 transition-all duration-300 shadow-[0_0_20px_rgba(251,191,36,0.1)] hover:shadow-[0_0_30px_rgba(251,191,36,0.2)]"
                >
                  {t.formSubmit}
                </button>

                {/* Trail particles layer */}
                <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: '500px', height: '200px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                  {trailParticles.map((p) => (
                    <div
                      key={p.id}
                      className="absolute rounded-full"
                      style={{
                        left: `${p.x}px`,
                        top: `${p.y}px`,
                        width: '6px',
                        height: '6px',
                        transform: `translate(-50%, -50%) scale(${p.scale})`,
                        opacity: p.opacity,
                        background: 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(255,255,255,0.6) 40%, rgba(251,191,36,0.2) 70%, transparent 100%)',
                        boxShadow: '0 0 8px rgba(251,191,36,0.5), 0 0 16px rgba(251,191,36,0.2)',
                        transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
                      }}
                    />
                  ))}
                </div>

                {/* Самолетик */}
                <div
                  ref={planeRef}
                  onClick={handlePlaneClick}
                  className={`absolute p-2 cursor-pointer text-zinc-700 hover:text-amber-200 transition-colors duration-300 z-10 ${isFlying ? 'animate-fly-around text-amber-400' : ''}`}
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: isFlying ? undefined : 'translate(-50%, -50%)',
                    marginLeft: isFlying ? undefined : '140px',
                    marginTop: isFlying ? undefined : '-2px',
                  }}
                  title="Secret Voyage"
                >
                  <Plane size={20} strokeWidth={1.5} />
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="px-8 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <span
          className="text-amber-200/40 font-serif tracking-[0.35em] text-sm font-light"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
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
