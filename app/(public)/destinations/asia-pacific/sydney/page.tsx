"use client";

import { useState } from "react";
import {
  Shield,
  Clock,
  Home,
  Plane,
  DollarSign,
  Users,
  GraduationCap,
  CheckCircle2,
  FileText,
  ArrowRight,
  Lock,
  Crown,
  Sparkles,
  Star,
  MapPin,
  Calendar,
} from "lucide-react";

type Lang = "EN" | "RU";

// ─── Language Toggle (как на главной странице) ────────────────────────
function LanguageToggle({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  return (
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
        EN
      </button>
      <button
        onClick={() => setLang("RU")}
        className={`relative z-10 text-[10px] tracking-widest font-medium w-8 h-6 flex items-center justify-center cursor-pointer transition-colors duration-300 ${
          lang === "RU" ? "text-amber-200" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        RU
      </button>
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  accent = false,
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden backdrop-blur-md transition-all duration-300 ${
        accent
          ? "bg-amber-950/8 border border-amber-500/15 hover:border-amber-500/25"
          : glow
          ? "bg-zinc-900/50 border border-amber-500/20 hover:border-amber-500/30"
          : "bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/50"
      } ${className}`}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />
      )}
      {glow && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/25" />
      )}
      {!accent && !glow && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />
      )}
      {children}
    </div>
  );
}

function RateCard({
  label,
  amount,
  note,
  popular = false,
  popularLabel = "Popular",
}: {
  label: string;
  amount: string;
  note?: string;
  popular?: boolean;
  popularLabel?: string;
}) {
  return (
    <div
      className={`relative rounded-xl p-5 backdrop-blur-md transition-all duration-300 group ${
        popular
          ? "bg-amber-950/10 border border-amber-500/20 hover:border-amber-500/35"
          : "bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/50"
      }`}
    >
      {popular && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/25" />
      )}
      {!popular && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/15" />
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
          {label}
        </span>
        {popular && (
          <span className="text-[9px] tracking-[0.15em] uppercase text-amber-400/70 font-semibold bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-800/20">
            {popularLabel}
          </span>
        )}
      </div>

      <p
        className={`text-2xl font-light tracking-tight ${
          popular ? "text-amber-200/90" : "text-zinc-100"
        }`}
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        {amount}
      </p>
      {note && (
        <p className="text-[10px] text-zinc-600 mt-1.5 tracking-wide leading-relaxed">
          {note}
        </p>
      )}
    </div>
  );
}

function Badge({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/30 text-[11px] tracking-wide text-zinc-400">
      {icon}
      {text}
    </div>
  );
}

function InfoRow({
  icon,
  title,
  description,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl p-5 backdrop-blur-md transition-all duration-300 ${
        accent
          ? "bg-amber-950/8 border border-amber-500/15 hover:border-amber-500/25"
          : "bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/50"
      }`}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />
      )}
      {!accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/15" />
      )}

      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${
            accent
              ? "bg-amber-950/30 border-amber-800/25 text-amber-400"
              : "bg-zinc-800/40 border-zinc-700/30 text-zinc-500"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium tracking-wide mb-1 ${
              accent ? "text-amber-200/90" : "text-zinc-200"
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function SydneyResidencyPage() {
  const [lang, setLang] = useState<Lang>("RU");
  const [applied, setApplied] = useState(false);

  // ─── Словарь переводов (EN / RU) ───────────────────────────────────
  const t = {
    EN: {
      heroBadge: "Voyage Private Club",
      heroTitle1: "Exclusive Residency:",
      heroTitle2: "Sydney, Australia",
      heroSubtitle:
        "Voyage Private Club residency and elite outcall. A flawless reputation and an established VIP client base.",
      metaLocation: "Sydney, Australia",
      metaContract: "Long-term Contract",
      metaTier: "VIP Tier",
      aboutTitle: "The Location",
      aboutNote: "— Sydney, Australia",
      aboutText:
        "Sydney is the crown of the South Pacific — a harbour city of superyachts, cliffside penthouses and an effortlessly affluent, discreet elite. Long days on the water flow into glittering nights, with an established, refined clientele used to the very best. A rare high-trust market with serious earning potential and a relaxed, sun-soaked lifestyle.",

      finTitle: "Financial Architecture",
      finNote: "— Rates & Income",
      rateLabel: "Base Rate",
      rateAmount: "$500 – $700 USD / hour",
      rateNote: "50/50 Split. Stable traffic of 15 to 25 sessions per week.",
      popular: "Popular",
      optionsTitle: "Premium Options",
      opt1Title: "Companion Upgrades",
      opt1Amount: "+$100 USD",
      opt2Title: "Premium Specialization",
      opt2Amount: "+$200 – $300 USD",
      optNote: "100% retained by the resident",
      avgTitle: "Target Income",
      avgAmount: "$6,000 – $9,000 USD",
      avgPer: "net average weekly",
      avgNote: "+ up to $2,000 from premium options and upgrades.",

      visaTitle: "Visa & Legal Support",
      visaNote: "— Legal Stay",
      visaRowTitle: "Visa Processing",
      visaRowDesc:
        "Long-term student visa processing managed entirely by the club to ensure a legal, secure, and seamless stay.",

      accTitle: "Accommodation & Workspace",
      accNote: "— Premium Living",
      housingEyebrow: "Housing",
      housingTitle: "Private House",
      housingDesc:
        "Each resident lives in their own separate house — a comfortable, fully equipped home with everything needed for living and work, in a premium location.",
      badge1: "Premium neighbourhood",
      badge2: "Private Pool",
      badge3: "Sauna",
      badge4: "Fitness Center",
      outcallEyebrow: "Outcall Logistics",
      outcallDesc:
        "Outcalls are strictly limited to max 20% (5-star hotels and private villas only).",
      aptVideoLabel: "House Walkthrough",

      secTitle: "Security Protocol",
      secNote: "— Resident Protection",
      secCardTitle: "100% Confidentiality & Protection",
      secCardDesc:
        "Multi-layered security system featuring a 24/7 Rapid Response Protocol. Our in-house security team is stationed city-wide, guaranteeing a maximum 20-minute arrival time to any location.",
      secPill: "24/7 Rapid Response — 20 min max arrival",

      flightTitle: "Flight Logistics",
      flightNote: "— Transfer",
      flightCardTitle: "Complimentary flights for extended contracts",
      flightCardDesc:
        "Complimentary flights provided for contracts exceeding 1 month. Ticket Crediting option available for shorter tours.",

      reqTitle: "Application Requirements",
      reqNote: "— Mandatory",
      docEyebrow: "Documentation",
      docVal: "Valid International Passport",
      visaStatusEyebrow: "Visa Status",
      visaStatusVal: "Valid Visa (Ready for immediate departure)",
      portfolioEyebrow: "Portfolio",
      portfolioVal: "4–5 fresh digital snaps",
      portfolioSub: "Strictly no filters or makeup",
      disclaimer:
        "All applications are subject to verification and approval by the residency committee. Submission does not guarantee acceptance.",

      ctaSecure: "Secure Application",
      ctaSecureSub: "Encrypted & Confidential",
      ctaIdle: "Submit Application",
      ctaSent: "Application Sent",
    },
    RU: {
      heroBadge: "Voyage Private Club",
      heroTitle1: "Эксклюзивная Резиденция:",
      heroTitle2: "Сидней, Австралия",
      heroSubtitle:
        "Резиденция Voyage Private Club и элитный outcall. Безупречная репутация и устоявшаяся база VIP-клиентов.",
      metaLocation: "Сидней, Австралия",
      metaContract: "Долгосрочный контракт",
      metaTier: "VIP-уровень",
      aboutTitle: "О локации",
      aboutNote: "— Сидней, Австралия",
      aboutText:
        "Сидней — корона южной части Тихого океана: город суперяхт, пентхаусов на скалах и непринуждённо состоятельной, закрытой элиты. Долгие дни у воды перетекают в искрящиеся ночи, а клиентура — устоявшаяся, утончённая и привыкшая к лучшему. Редкий рынок высокого доверия с серьёзным потенциалом дохода и спокойным, солнечным образом жизни.",

      finTitle: "Финансовая архитектура",
      finNote: "— Ставки и доход",
      rateLabel: "Базовая ставка",
      rateAmount: "500 – 700 USD / час",
      rateNote: "Расчет 50/50. Стабильный трафик от 15 до 25 сессий в неделю.",
      popular: "Популярно",
      optionsTitle: "Дополнительные опции",
      opt1Title: "Companion Upgrades",
      opt1Amount: "+100 USD",
      opt2Title: "Premium Specialization",
      opt2Amount: "+200 – 300 USD",
      optNote: "100% дохода с апгрейдов идет резиденту",
      avgTitle: "Средний доход",
      avgAmount: "6,000 – 9,000 USD",
      avgPer: "в неделю чистыми",
      avgNote: "+ до 2,000 USD с дополнительных опций и апгрейдов.",

      visaTitle: "Виза и образование",
      visaNote: "— Легальное пребывание",
      visaRowTitle: "Визовая поддержка",
      visaRowDesc:
        "Оформление долгосрочных студенческих виз силами клуба для легального и комфортного пребывания.",

      accTitle: "Проживание и рабочее пространство",
      accNote: "— Премиум-жильё",
      housingEyebrow: "Жильё",
      housingTitle: "Отдельный дом",
      housingDesc:
        "Каждый сотрудник живёт в отдельном собственном доме — комфортное, полностью укомплектованное жильё со всем необходимым для жизни и работы в премиальной локации.",
      badge1: "Дорогой район",
      badge2: "Собственный бассейн",
      badge3: "Сауна",
      badge4: "Фитнес-центр",
      outcallEyebrow: "Логистика выездов",
      outcallDesc:
        "Выезды (5-звездочные отели и частные резиденции) составляют не более 20% от общего объема.",
      aptVideoLabel: "Видеообзор дома",

      secTitle: "Протокол безопасности",
      secNote: "— Защита резидента",
      secCardTitle: "100% Конфиденциальность и Защита",
      secCardDesc:
        "Многоуровневая система безопасности. Внутренняя служба безопасности клуба: круглосуточный протокол быстрого реагирования.",
      secPill: "24/7 Rapid Response — прибытие в течение 20 минут",

      flightTitle: "Логистика перелета",
      flightNote: "— Трансфер",
      flightCardTitle: "Перелет оплачивается клубом",
      flightCardDesc:
        "При контракте от 1 месяца перелет полностью оплачивается клубом. При более коротких турах доступна опция Кредитования билета.",

      reqTitle: "Требования к заявке",
      reqNote: "— Обязательные условия",
      docEyebrow: "Документы",
      docVal: "Действующий загранпаспорт",
      visaStatusEyebrow: "Виза",
      visaStatusVal: "Действующая виза Австралии",
      portfolioEyebrow: "Портфолио",
      portfolioVal: "4 – 5 свежих снепов",
      portfolioSub: "Без фильтров",
      disclaimer:
        "Все заявки проходят верификацию и рассмотрение резидентским комитетом. Отправка заявки не гарантирует одобрение.",

      ctaSecure: "Защищённая заявка",
      ctaSecureSub: "Шифрование и конфиденциальность",
      ctaIdle: "Подать заявку на контракт",
      ctaSent: "Заявка отправлена",
    },
  }[lang];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Top bar with language toggle (как на главной) ── */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-zinc-950/70 backdrop-blur-md border-b border-white/5">
        <span
          className="text-amber-200/90 font-light tracking-[0.35em] text-lg select-none"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          VOYAGE
        </span>
        <LanguageToggle lang={lang} setLang={setLang} />
      </header>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full opacity-[0.02]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.6) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] rounded-full opacity-[0.015]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.5) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative">
        {/* ── Hero Section ───────────────────────────────────────── */}
        <section className="relative h-[65vh] min-h-[480px] max-h-[650px] overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-zinc-900">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(212,168,83,0.9) 1px, transparent 0)`,
                backgroundSize: "32px 32px",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,168,83,0.06) 0%, transparent 40%, rgba(20,20,20,0.9) 100%)",
              }}
            />
          </div>

          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-transparent to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end">
            <div className="max-w-3xl mx-auto w-full px-6 pb-10">
              {/* Top badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/20 border border-amber-500/15 mb-6">
                <Crown className="w-3 h-3 text-amber-400/60" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-amber-300/70 font-semibold">
                  {t.heroBadge}
                </span>
              </div>

              {/* Title */}
              <h1
                className="text-4xl md:text-6xl text-zinc-100 mb-4 leading-[1.1]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {t.heroTitle1}
                <br />
                <span className="text-amber-200/80">{t.heroTitle2}</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm md:text-base text-zinc-400 tracking-wide max-w-xl leading-relaxed">
                {t.heroSubtitle}
              </p>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">{t.metaLocation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide font-mono">
                    {t.metaContract}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">{t.metaTier}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main Content ───────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-6 -mt-4 relative z-10 pb-32">
          {/* ── About the Location ───────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.aboutTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.aboutNote}</span>
            </div>

            <GlassCard>
              <div className="p-5 md:p-6">
                <p
                  className="text-base md:text-lg text-zinc-300 leading-relaxed font-light"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {t.aboutText}
                </p>
              </div>
            </GlassCard>
          </section>

          {/* ── Financial Architecture ───────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.finTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.finNote}</span>
            </div>

            {/* Base Rate */}
            <div className="mb-3">
              <RateCard
                label={t.rateLabel}
                amount={t.rateAmount}
                note={t.rateNote}
                popular
                popularLabel={t.popular}
              />
            </div>

            {/* Upgrade Options */}
            <GlassCard accent className="mb-3">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500/50" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                    {t.optionsTitle}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide">
                      {t.opt1Title}
                    </p>
                    <p className="text-xs text-amber-200/70 font-mono mt-1">
                      {t.opt1Amount}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                      {t.optNote}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide">
                      {t.opt2Title}
                    </p>
                    <p className="text-xs text-amber-200/70 font-mono mt-1">
                      {t.opt2Amount}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                      {t.optNote}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Average Income */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    {t.avgTitle}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                  <p
                    className="text-3xl text-amber-200/90 font-light tracking-tight"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {t.avgAmount}
                  </p>
                  <p className="text-sm text-zinc-400 pb-1">{t.avgPer}</p>
                </div>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  {t.avgNote}
                </p>
              </div>
            </GlassCard>
          </section>

          {/* ── Visa & Education ─────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <GraduationCap className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.visaTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.visaNote}</span>
            </div>

            <InfoRow
              icon={<GraduationCap className="w-4 h-4" />}
              title={t.visaRowTitle}
              description={t.visaRowDesc}
              accent
            />
          </section>

          {/* ── Accommodation & Workspace ────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Home className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.accTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.accNote}</span>
            </div>

            <GlassCard glow>
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: info */}
                <div className="flex flex-col justify-center">
                  <div className="mb-4">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold mb-2">
                      {t.housingEyebrow}
                    </p>
                    <h3
                      className="text-xl text-zinc-100 mb-2"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {t.housingTitle}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {t.housingDesc}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    <Badge icon={<Star className="w-3 h-3" />} text={t.badge1} />
                    <Badge icon={<Sparkles className="w-3 h-3" />} text={t.badge2} />
                    <Badge icon={<Sparkles className="w-3 h-3" />} text={t.badge3} />
                    <Badge icon={<Sparkles className="w-3 h-3" />} text={t.badge4} />
                  </div>

                  <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                          {t.outcallEyebrow}
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {t.outcallDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: apartment video (как на странице Дубай) */}
                <div className="flex flex-col gap-2 self-center">
                  <div className="aspect-video rounded-xl overflow-hidden border border-zinc-700/50 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-zinc-950">
                    {/* TODO: заменить на /sydney-house.mp4, когда будет своё видео дома.
                        Пока временно используется публичный файл из Дубая. */}
                    <video
                      src="/dubai-apt.mp4"
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 font-medium text-center">
                    {t.aptVideoLabel}
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* ── Security Protocol ────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Shield className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.secTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.secNote}</span>
            </div>

            <GlassCard accent>
              <div className="p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-950/20 border border-amber-800/20 flex items-center justify-center text-amber-400/70 flex-shrink-0">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-lg text-amber-200/90 mb-2 tracking-wide"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {t.secCardTitle}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                      {t.secCardDesc}
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/20 border border-amber-800/20">
                      <Clock className="w-3 h-3 text-amber-400/60" />
                      <span className="text-[10px] tracking-[0.15em] uppercase text-amber-300/70 font-semibold">
                        {t.secPill}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* ── Flight Logistics ───────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Plane className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.flightTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.flightNote}</span>
            </div>

            <GlassCard>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                    <Plane className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide mb-2">
                      {t.flightCardTitle}
                    </p>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {t.flightCardDesc}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* ── Application Requirements ─────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.reqTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">{t.reqNote}</span>
            </div>

            <div className="relative rounded-xl overflow-hidden">
              <div className="absolute inset-0 rounded-xl border border-zinc-800/50 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />

              <div className="p-5 md:p-6 bg-zinc-900/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Passport */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        {t.docEyebrow}
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        {t.docVal}
                      </p>
                    </div>
                  </div>

                  {/* Visa */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        {t.visaStatusEyebrow}
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        {t.visaStatusVal}
                      </p>
                    </div>
                  </div>

                  {/* Portfolio */}
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        {t.portfolioEyebrow}
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        {t.portfolioVal}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {t.portfolioSub}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-zinc-800/40 my-4" />

                <p className="text-xs text-zinc-500 leading-relaxed">
                  {t.disclaimer}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── Action Button (Sticky Bottom) ─────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-3xl mx-auto px-6 pb-6 pt-4">
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(9,9,9,0.7) 0%, rgba(9,9,9,0.95) 100%)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="absolute inset-0 rounded-xl border border-amber-500/15 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />

              <div className="p-4 flex items-center justify-between gap-4">
                <div className="hidden sm:flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                      {t.ctaSecure}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {t.ctaSecureSub}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setApplied(!applied)}
                  disabled={applied}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 py-3.5 px-8 rounded-lg text-xs tracking-[0.15em] uppercase font-semibold transition-all duration-500 border ${
                    applied
                      ? "bg-emerald-950/30 border-emerald-800/30 text-emerald-400 cursor-default"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/15 hover:border-amber-500/40 cursor-pointer"
                  }`}
                >
                  {applied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {t.ctaSent}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {t.ctaIdle}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
