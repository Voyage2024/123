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
  duration,
  amountAED,
  amountUSD,
  popular = false,
}: {
  label: string;
  duration: string;
  amountAED: string;
  amountUSD: string;
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

      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
          {label}
        </span>
        {popular && (
          <span className="text-[9px] tracking-[0.15em] uppercase text-amber-400/70 font-semibold bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-800/20">
            Popular
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
export default function DubaiResidencyPage() {
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
                  Voyage Private Club
                </span>
              </div>

              {/* Title */}
              <h1
                className="text-4xl md:text-6xl text-zinc-100 mb-4 leading-[1.1]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Exclusive Residency:
                <br />
                <span className="text-amber-200/80">UAE, Dubai</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm md:text-base text-zinc-400 tracking-wide max-w-xl leading-relaxed">
                Voyage Private Club system and elite Outcall. Over 20 years of
                flawless reputation and an established VIP client base.
              </p>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">Dubai, UAE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide font-mono">
                    Long-term Contract
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-amber-400/60" />
                  </div>
                  <span className="text-sm text-zinc-400 tracking-wide">VIP Tier</span>
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
                Financial Architecture
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Rates & Earnings</span>
            </div>

            {/* Rates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <RateCard
                label="Base Rate"
                duration="1 hour"
                amountAED="1,000 AED"
                amountUSD="~$250"
              />
              <RateCard
                label="Extended"
                duration="2–3 hours"
                amountAED="1,500 AED"
                amountUSD="~$400"
                popular
              />
              <RateCard
                label="Premium"
                duration="4–5 hours"
                amountAED="2,000 AED"
                amountUSD="~$600–700"
              />
            </div>

            {/* Commission & Bonuses Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <GlassCard>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                        Commission
                      </p>
                      <p className="text-sm text-zinc-200 tracking-wide mt-0.5">
                        50/50 Split
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    On base rates. Equal distribution between the resident and the club.
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
                        Bonuses
                      </p>
                      <p
                        className="text-base text-amber-200/90 tracking-wide mt-0.5 leading-snug"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        100% of tips and additional bonuses are retained by the resident
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-400/50 leading-relaxed">
                    Full retention. No club deductions on tips or bonuses.
                  </p>
                </div>
              </GlassCard>
            </div>

            {/* Target Income */}
            <GlassCard glow>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500/50" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-amber-500/70 font-semibold">
                    Target Income
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                  <p
                    className="text-3xl text-amber-200/90 font-light tracking-tight"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    $12,000 – $15,000
                  </p>
                  <p className="text-sm text-zinc-400 pb-1">per month</p>
                </div>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  Expected earnings with consistent traffic and adherence to the rate schedule.
                </p>
              </div>
            </GlassCard>
          </section>

          {/* ── Schedule & Security ────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Schedule & Support
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Operational Conditions</span>
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
                        Active Hours
                      </p>
                      <p className="text-sm text-zinc-200 font-mono tracking-wide mt-1">
                        10:00 PM — 04:00 AM
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
                        Contract
                      </p>
                      <p className="text-sm text-zinc-200 tracking-wide mt-1">
                        1+ month tour
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        On a permanent basis
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
                        Support
                      </p>
                      <p className="text-sm text-amber-200/90 tracking-wide mt-1">
                        24/7 Concierge
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </section>

          {/* ── Accommodation ────────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Home className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Accommodation & Living
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Housing Conditions</span>
            </div>

            <GlassCard glow>
              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column: text content */}
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
                        Premium Apartments
                      </h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Cozy apartments with everything needed for comfortable living.
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
                          Cost
                        </p>
                        <p className="text-sm text-zinc-200 tracking-wide font-mono">
                          $1,000 per month
                        </p>
                        <p className="text-xs text-amber-200/70 mt-1">
                          All-Inclusive
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      icon={<Sparkles className="w-3 h-3" />}
                      text="Catering included"
                    />
                    <Badge
                      icon={<Sparkles className="w-3 h-3" />}
                      text="Daily Maid Service"
                    />
                  </div>
                </div>

                {/* Right column: video */}
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

          {/* ── Application Requirements ─────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Resident Requirements
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Mandatory Conditions</span>
            </div>

            <div className="relative rounded-xl overflow-hidden">
              <div className="absolute inset-0 rounded-xl border border-zinc-800/50 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />

              <div className="p-5 md:p-6 bg-zinc-900/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Age */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <Star className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        Age
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        18–30 years
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Approval depends on overall look
                      </p>
                    </div>
                  </div>

                  {/* Portfolio */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 flex-shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                        Portfolio
                      </p>
                      <p className="text-sm text-zinc-200 mt-0.5">
                        4–5 fresh digital snaps
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Strictly no makeup or filters
                      </p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-zinc-800/40 my-4" />

                <p className="text-xs text-zinc-500 leading-relaxed">
                  All applications undergo verification and review by the resident committee.
                  Submitting an application does not guarantee approval.
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
                      Secure Application
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Encryption & confidentiality
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
                      Application Sent
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Submit Application
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