"use client";

import { useState } from "react";
import {
  Clock,
  Shield,
  Home,
  DollarSign,
  Star,
  CheckCircle2,
  FileText,
  ArrowRight,
  Lock,
  Crown,
  Sparkles,
  MapPin,
  Calendar,
  ChevronRight,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

type Lang = "EN" | "RU";

// ─── Translation Data ─────────────────────────────────────────────────

const dict: Record<Lang, any> = {
  EN: {
    heroBadge: "Voyage Private Club",
    heroTitle: "Exclusive Residency:",
    heroLocation: "UAE, Dubai",
    heroSubtitle:
      "Voyage Private Club system and elite Outcall. Over 20 years of flawless reputation and an established VIP client base.",
    metaLocation: "Dubai, UAE",
    metaContract: "Long-term Contract",
    metaTier: "VIP Tier",

    financialTitle: "Financial Architecture",
    financialSubtitle: "— Rates & Earnings",
    baseRate: "Base Rate",
    extended: "Extended",
    premium: "Premium",
    popular: "Popular",
    hour: "1 hour",
    hours: "2–3 hours",
    hours45: "4–5 hours",
    commission: "Commission",
    commissionDesc: "50/50 Split",
    commissionDetail:
      "On base rates. Equal distribution between the resident and the club.",
    bonuses: "Bonuses",
    bonusesDesc:
      "100% of tips and additional bonuses are retained by the resident",
    bonusesDetail: "Full retention. No club deductions on tips or bonuses.",
    targetIncome: "Target Income",
    targetIncomeLabel: "per month",
    targetIncomeDesc:
      "Expected earnings with consistent traffic and adherence to the rate schedule.",

    scheduleTitle: "Schedule & Support",
    scheduleSubtitle: "— Operational Conditions",
    activeHours: "Active Hours",
    activeHoursTime: "10:00 PM — 04:00 AM",
    contract: "Contract",
    contractDuration: "1+ month tour",
    contractDetail: "On a permanent basis",
    support: "Support",
    supportDetail: "24/7 Concierge",

    accommodationTitle: "Accommodation & Living",
    accommodationSubtitle: "— Housing Conditions",
    aptTitle: "Premium Apartments",
    aptDesc:
      "Cozy apartments with everything needed for comfortable living.",
    cost: "Cost",
    costAmount: "$1,000 per month",
    allInclusive: "All-Inclusive",
    catering: "Catering included",
    maidService: "Daily Maid Service",

    requirementsTitle: "Resident Requirements",
    requirementsSubtitle: "— Mandatory Conditions",
    age: "Age",
    ageRange: "18–30 years",
    ageDetail: "Approval depends on overall look",
    portfolio: "Portfolio",
    portfolioDetail: "4–5 fresh digital snaps",
    portfolioNote: "Strictly no makeup or filters",
    disclaimer:
      "All applications undergo verification and review by the resident committee. Submitting an application does not guarantee approval.",

    ctaSecure: "Secure Application",
    ctaEncryption: "Encryption & confidentiality",
    ctaSubmit: "Submit Application",
    ctaSubmitted: "Application Sent",

    drawerDescription:
      "The heart of global luxury. The epicenter of yacht parties, VIP lounges, and private meetings of the global elite.",
    drawerAction: "RESIDENT ACCESS",
    drawerRegion: "Region",

    destinationTitle: "Destination",
    destinationHint: "Click to explore",
  },
  RU: {
    heroBadge: "Voyage Private Club",
    heroTitle: "Эксклюзивная Резиденция:",
    heroLocation: "ОАЭ, Дубай",
    heroSubtitle:
      "Закрытая клубная система Voyage и элитный Outcall. Более 20 лет безупречной репутации и наработанная база постоянных VIP-клиентов.",
    metaLocation: "Дубай, ОАЭ",
    metaContract: "Долгосрочный контракт",
    metaTier: "VIP-уровень",

    financialTitle: "Финансовая архитектура",
    financialSubtitle: "— Ставки и доход",
    baseRate: "Базовая ставка",
    extended: "Расширенная",
    premium: "Премиум",
    popular: "Популярно",
    hour: "1 час",
    hours: "2–3 часа",
    hours45: "4–5 часов",
    commission: "Комиссия",
    commissionDesc: "Расчет 50/50",
    commissionDetail:
      "По базовым ставкам. Равное распределение между резидентом и клубом.",
    bonuses: "Бонусы",
    bonusesDesc:
      "100% чаевых и дополнительных бонусов остаются у резидента",
    bonusesDetail: "Никаких удержаний клуба на чаевые и бонусы.",
    targetIncome: "Средний заработок",
    targetIncomeLabel: "в месяц",
    targetIncomeDesc:
      "Ожидаемый доход при стабильном трафике и выполнении тарифной сетки.",

    scheduleTitle: "График и поддержка",
    scheduleSubtitle: "— Операционные условия",
    activeHours: "Активные часы",
    activeHoursTime: "22:00 — 04:00",
    contract: "Контракт",
    contractDuration: "Тур от 1 месяца",
    contractDetail: "На постоянной основе",
    support: "Поддержка",
    supportDetail: "Консьерж-сервис 24/7",

    accommodationTitle: "Проживание и быт",
    accommodationSubtitle: "— Условия проживания",
    aptTitle: "Премиум-Апартаменты",
    aptDesc:
      "Уютные апартаменты со всем необходимым для комфортной жизни.",
    cost: "Стоимость",
    costAmount: "1,000$ в месяц",
    allInclusive: "All-Inclusive",
    catering: "Питание включено",
    maidService: "Ежедневный клининг",

    requirementsTitle: "Требования к резиденту",
    requirementsSubtitle: "— Обязательные условия",
    age: "Возраст",
    ageRange: "18–30 лет",
    ageDetail: "Утверждение зависит от внешних данных",
    portfolio: "Портфолио",
    portfolioDetail: "4–5 свежих цифровых снепов",
    portfolioNote: "Строго без макияжа и фильтров",
    disclaimer:
      "Все заявки проходят верификацию и рассмотрение резидентским комитетом. Отправка заявки не гарантирует одобрение.",

    ctaSecure: "Защищённая заявка",
    ctaEncryption: "Шифрование и конфиденциальность",
    ctaSubmit: "Подать заявку",
    ctaSubmitted: "Заявка отправлена",

    drawerDescription:
      "Сердце мирового люкса. Эпицентр яхт-вечеринок, VIP-лож и закрытых встреч мировой элиты.",
    drawerAction: "ВХОД ДЛЯ РЕЗИДЕНТОВ",
    drawerRegion: "Регион",

    destinationTitle: "Направление",
    destinationHint: "Нажмите для подробностей",
  },
};

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
  duration,
  amountAED,
  amountUSD,
  popular = false,
  popularLabel,
}: {
  label: string;
  duration: string;
  amountAED: string;
  amountUSD: string;
  popular?: boolean;
  popularLabel: string;
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

      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
          {label}
        </span>
        {popular && (
          <span className="text-[9px] tracking-[0.15em] uppercase text-amber-400/70 font-semibold bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-800/20">
            {popularLabel}
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500 tracking-wide mb-1">{duration}</p>
      <p
        className={`text-2xl font-light tracking-tight ${
          popular ? "text-amber-200/90" : "text-zinc-100"
        }`}
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        {amountAED}
      </p>
      <p className="text-xs text-zinc-600 mt-1 font-mono tracking-wide">{amountUSD}</p>
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

// ─── Drawer ───────────────────────────────────────────────────────────

function DestinationDrawer({
  isOpen,
  onClose,
  lang,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  t: any;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800/50 z-[70] transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/20 border border-amber-800/20 flex items-center justify-center text-amber-400/70">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                Voyage Private Club
              </p>
              <h2
                className="text-xl text-amber-200/90 tracking-wide"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {lang === "EN" ? "Dubai, UAE" : "Дубай, ОАЭ"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <GlassCard accent>
            <div className="p-5">
              <p className="text-sm text-zinc-300 leading-relaxed">
                {t.drawerDescription}
              </p>
            </div>
          </GlassCard>

          <div className="relative rounded-xl overflow-hidden border border-zinc-700/50 aspect-[16/9]">
            <img
              src="/dubai-region.jpg"
              alt="Dubai"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-amber-400/70 font-semibold">
                {t.drawerRegion}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassCard>
              <div className="p-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold mb-1">
                  {lang === "EN" ? "Currency" : "Валюта"}
                </p>
                <p className="text-sm text-zinc-200 font-mono">AED / USD</p>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-4">
                <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold mb-1">
                  {lang === "EN" ? "Climate" : "Климат"}
                </p>
                <p className="text-sm text-zinc-200">
                  {lang === "EN" ? "Tropical Desert" : "Тропический"}
                </p>
              </div>
            </GlassCard>
          </div>

          <button className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-lg text-xs tracking-[0.15em] uppercase font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:bg-amber-500/15 hover:border-amber-500/40 transition-all duration-300">
            <Lock className="w-4 h-4" />
            {t.drawerAction}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function DubaiResidencyPage() {
  const [lang, setLang] = useState<Lang>("EN");
  const [applied, setApplied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const t = dict[lang];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
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

      <DestinationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lang={lang}
        t={t}
      />

      <div className="relative">
        {/* ── Hero Section ───────────────────────────────────────── */}
        <section className="relative h-[65vh] min-h-[480px] max-h-[650px] overflow-hidden">
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

          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-transparent to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-end">
            <div className="max-w-3xl mx-auto w-full px-6 pb-10">
              {/* Top bar: badge + language toggle (exactly like homepage) */}
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/20 border border-amber-500/15">
                  <Crown className="w-3 h-3 text-amber-400/60" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-amber-300/70 font-semibold">
                    {t.heroBadge}
                  </span>
                </div>

                {/* Language Switcher — same pattern as homepage */}
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
              </div>

              <h1
                className="text-4xl md:text-6xl text-zinc-100 mb-4 leading-[1.1]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {t.heroTitle}
                <br />
                <span className="text-amber-200/80">{t.heroLocation}</span>
              </h1>

              <p className="text-sm md:text-base text-zinc-400 tracking-wide max-w-xl leading-relaxed">
                {t.heroSubtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">
                    {t.metaLocation}
                  </span>
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
                  <span className="text-sm text-zinc-400 tracking-wide">
                    {t.metaTier}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main Content ───────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-6 -mt-4 relative z-10 pb-32">
          {/* Financial Architecture */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.financialTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">
                {t.financialSubtitle}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <RateCard
                label={t.baseRate}
                duration={t.hour}
                amountAED="1,000 AED"
                amountUSD={lang === "EN" ? "~$250" : "~250 USD"}
                popularLabel={t.popular}
              />
              <RateCard
                label={t.extended}
                duration={t.hours}
                amountAED="1,500 AED"
                amountUSD={lang === "EN" ? "~$400" : "~400 USD"}
                popular
                popularLabel={t.popular}
              />
              <RateCard
                label={t.premium}
                duration={t.hours45}
                amountAED="2,000 AED"
                amountUSD={lang === "EN" ? "~$600–700" : "~600–700 USD"}
                popularLabel={t.popular}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <GlassCard>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                        {t.commission}
                      </p>
                      <p className="text-sm text-zinc-200 tracking-wide mt-0.5">
                        {t.commissionDesc}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {t.commissionDetail}
                  </p>
                </div>
              </GlassCard>

              <GlassCard accent>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-950/30 border border-amber-800/25 flex items-center justify-center text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                        {t.bonuses}
                      </p>
                      <p
                        className="text-base text-amber-200/90 tracking-wide mt-0.5 leading-snug"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        {t.bonusesDesc}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-400/50 leading-relaxed">
                    {t.bonusesDetail}
                  </p>
                </div>
              </GlassCard>
            </div>

            <GlassCard glow>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500/50" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                    {t.targetIncome}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                  <p
                    className="text-3xl text-amber-200/90 font-light tracking-tight"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    $12,000 – $15,000
                  </p>
                  <p className="text-sm text-zinc-400 pb-1">
                    {t.targetIncomeLabel}
                  </p>
                </div>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  {t.targetIncomeDesc}
                </p>
              </div>
            </GlassCard>
          </section>

          {/* Schedule & Security */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.scheduleTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">
                {t.scheduleSubtitle}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <GlassCard>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                        {t.activeHours}
                      </p>
                      <p className="text-sm text-zinc-200 font-mono tracking-wide mt-1">
                        {t.activeHoursTime}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                        {t.contract}
                      </p>
                      <p className="text-sm text-zinc-200 tracking-wide mt-1">
                        {t.contractDuration}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {t.contractDetail}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard accent>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-950/30 border border-amber-800/25 flex items-center justify-center text-amber-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                        {t.support}
                      </p>
                      <p className="text-sm text-amber-200/90 tracking-wide mt-1">
                        {t.supportDetail}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </section>

          {/* Accommodation */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Home className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.accommodationTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">
                {t.accommodationSubtitle}
              </span>
            </div>

            <GlassCard glow>
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col justify-center">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-950/20 border border-amber-800/20 flex items-center justify-center text-amber-400/70 flex-shrink-0">
                      <Home className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-xl text-amber-200/90 mb-1 tracking-wide"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        {t.aptTitle}
                      </h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        {t.aptDesc}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                          {t.cost}
                        </p>
                        <p className="text-sm text-zinc-200 tracking-wide font-mono">
                          {t.costAmount}
                        </p>
                        <p className="text-xs text-amber-200/70 mt-1">
                          {t.allInclusive}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      icon={<Sparkles className="w-3 h-3" />}
                      text={t.catering}
                    />
                    <Badge
                      icon={<Sparkles className="w-3 h-3" />}
                      text={t.maidService}
                    />
                  </div>
                </div>

                <div className="aspect-video rounded-xl overflow-hidden border border-zinc-700/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <video
                    src="/dubai-apt.mp4"
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </GlassCard>
          </section>

          {/* Requirements */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.requirementsTitle}
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">
                {t.requirementsSubtitle}
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden">
              <div className="absolute inset-0 rounded-xl border border-zinc-800/50 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />

              <div className="p-5 md:p-6 bg-zinc-900/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <Star className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        {t.age}
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        {t.ageRange}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {t.ageDetail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        {t.portfolio}
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        {t.portfolioDetail}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {t.portfolioNote}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800/40 my-4" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {t.disclaimer}
                </p>
              </div>
            </div>
          </section>

          {/* Destination Card → Drawer */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                {t.destinationTitle}
              </h2>
            </div>

            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full text-left group"
            >
              <GlassCard glow className="hover:border-amber-500/40 transition-all duration-300">
                <div className="p-5 md:p-6 flex items-center gap-4">
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-700/50 flex-shrink-0">
                    <img
                      src="/dubai-region.jpg"
                      alt="Dubai"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 to-transparent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold mb-1">
                      {t.destinationHint}
                    </p>
                    <h3
                      className="text-xl text-amber-200/90 tracking-wide mb-1"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {lang === "EN" ? "Dubai" : "Дубай"}
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                      {t.drawerDescription}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center text-zinc-500 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </GlassCard>
            </button>
          </section>
        </div>

        {/* Sticky Bottom CTA */}
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
                      {t.ctaEncryption}
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
                      {t.ctaSubmitted}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {t.ctaSubmit}
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