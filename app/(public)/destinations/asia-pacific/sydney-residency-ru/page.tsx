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
  ArrowRight,
  Lock,
  Crown,
  Sparkles,
  Star,
  MapPin,
  Calendar,
  ChevronRight,
} from "lucide-react";

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
}: {
  label: string;
  amount: string;
  note?: string;
  popular?: boolean;
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
            Популярно
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
  const [applied, setApplied] = useState(false);

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
                  Private Contract
                </span>
              </div>

              {/* Title */}
              <h1
                className="text-4xl md:text-6xl text-zinc-100 mb-4 leading-[1.1]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Эксклюзивная Резиденция:
                <br />
                <span className="text-amber-200/80">Сидней, Австралия</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm md:text-base text-zinc-400 tracking-wide max-w-xl leading-relaxed">
                Премиальный контракт с полной визовой поддержкой и стабильным
                трафиком (15–25 сессий в неделю).
              </p>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">Сидней, Австралия</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide font-mono">
                    Долгосрочный контракт
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">VIP-уровень</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main Content ───────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-6 -mt-4 relative z-10 pb-32">
          {/* ── Financial Architecture ───────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Финансовая архитектура
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Ставки и доход</span>
            </div>

            {/* Base Rate */}
            <div className="mb-3">
              <RateCard
                label="Базовая ставка"
                amount="500 – 700 USD / час"
                note="Расчет 50/50. Стабильный трафик от 15 до 25 сессий в неделю."
                popular
              />
            </div>

            {/* Upgrade Options */}
            <GlassCard accent className="mb-3">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500/50" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                    Дополнительные опции
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide">
                      Companion Upgrades
                    </p>
                    <p className="text-xs text-amber-200/70 font-mono mt-1">
                      +100 USD
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                      100% дохода с апгрейдов идет резиденту
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide">
                      Premium Specialization
                    </p>
                    <p className="text-xs text-amber-200/70 font-mono mt-1">
                      +200 – 300 USD
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                      100% дохода с апгрейдов идет резиденту
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
                    Средний доход
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                  <p
                    className="text-3xl text-amber-200/90 font-light tracking-tight"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    6,000 – 9,000 USD
                  </p>
                  <p className="text-sm text-zinc-400 pb-1">в неделю чистыми</p>
                </div>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  + до 2,000 USD с дополнительных опций и апгрейдов.
                </p>
              </div>
            </GlassCard>
          </section>

          {/* ── Visa & Education ─────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <GraduationCap className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Виза и образование
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Легальное пребывание</span>
            </div>

            <InfoRow
              icon={<GraduationCap className="w-4 h-4" />}
              title="Визовая поддержка"
              description="Оформление долгосрочных студенческих виз силами клуба для легального и комфортного пребывания."
              accent
            />
          </section>

          {/* ── Accommodation & Workspace ────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Home className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Проживание и рабочее пространство
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Премиум-жильё</span>
            </div>

            <GlassCard glow>
              <div className="p-5 md:p-6">
                <div className="mb-4">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold mb-2">
                    Жильё
                  </p>
                  <h3
                    className="text-xl text-zinc-100 mb-2"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    Индивидуальные апартаменты бизнес-класса
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Проживание и работа проходят в одной локации.
                    <span className="text-zinc-300"> Private Luxury Studio</span>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  <Badge icon={<Star className="w-3 h-3" />} text="Дорогие ЖК" />
                  <Badge icon={<Sparkles className="w-3 h-3" />} text="Собственный бассейн" />
                  <Badge icon={<Sparkles className="w-3 h-3" />} text="Сауна" />
                  <Badge icon={<Sparkles className="w-3 h-3" />} text="Фитнес-центр" />
                </div>

                <div className="rounded-lg bg-zinc-950/30 border border-zinc-800/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        Логистика выездов
                      </p>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Выезды (5-звездочные отели и частные резиденции) составляют
                        не более 20% от общего объема.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* ── Security Protocol ────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Shield className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Протокол безопасности
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Защита резидента</span>
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
                      100% Конфиденциальность и Защита
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                      Многоуровневая система безопасности. Внутренняя служба
                      безопасности клуба: круглосуточный протокол быстрого
                      реагирования.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/20 border border-amber-800/20">
                      <Clock className="w-3 h-3 text-amber-400/60" />
                      <span className="text-[10px] tracking-[0.15em] uppercase text-amber-300/70 font-semibold">
                        24/7 Rapid Response — прибытие в течение 20 минут
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
                Логистика перелета
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Трансфер</span>
            </div>

            <GlassCard>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                    <Plane className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide mb-2">
                      Перелет оплачивается клубом
                    </p>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      При контракте от 1 месяца перелет полностью оплачивается
                      клубом. При более коротких турах доступна опция
                      Кредитования билета.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* ── Application Requirements ─────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Требования к заявке
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Обязательные условия</span>
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
                        Документы
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        Действующий загранпаспорт
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
                        Виза
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        Действующая виза Австралии
                      </p>
                    </div>
                  </div>

                  {/* Portfolio */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        Портфолио
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        4 – 5 свежих снепов
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Без фильтров
                      </p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-zinc-800/40 my-4" />

                <p className="text-xs text-zinc-500 leading-relaxed">
                  Все заявки проходят верификацию и рассмотрение резидентским
                  комитетом. Отправка заявки не гарантирует одобрение.
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
                      Защищённая заявка
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Шифрование и конфиденциальность
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
                      Заявка отправлена
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Подать заявку на контракт
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