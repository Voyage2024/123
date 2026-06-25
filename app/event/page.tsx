"use client";

import { useState } from "react";
import {
  MapPin,
  Calendar,
  Plane,
  Home,
  CreditCard,
  Sparkles,
  ChevronRight,
  Clock,
  Users,
  Wine,
  Shirt,
  Crown,
  ArrowRight,
  CheckCircle2,
  Star,
} from "lucide-react";

// ─── Components ───────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  accent = false,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden backdrop-blur-md ${
        accent
          ? "bg-zinc-900/50 border border-amber-500/20"
          : "bg-zinc-900/40 border border-zinc-800/40"
      } ${className}`}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />
      )}
      {!accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />
      )}
      {children}
    </div>
  );
}

function ConditionCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl p-5 backdrop-blur-md transition-all duration-300 hover:border-amber-500/20 group ${
        accent
          ? "bg-amber-950/10 border border-amber-500/15"
          : "bg-zinc-900/40 border border-zinc-800/40"
      }`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-[1px] ${
          accent ? "bg-amber-500/15" : "bg-zinc-700/15"
        }`}
      />
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${
            accent
              ? "bg-amber-950/30 border-amber-800/30 text-amber-400"
              : "bg-zinc-800/40 border-zinc-700/30 text-zinc-500 group-hover:text-amber-400/70 transition-colors"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold mb-1">
            {label}
          </p>
          <p
            className={`text-sm font-medium tracking-wide ${
              accent ? "text-amber-200/90" : "text-zinc-200"
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function EventDetailsPage() {
  const [applied, setApplied] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full opacity-[0.025]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.5) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[35%] rounded-full opacity-[0.015]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative">
        {/* ── Cover & Hero ───────────────────────────────────────── */}
        <section className="relative h-[70vh] min-h-[500px] max-h-[700px] overflow-hidden">
          {/* Background placeholder */}
          <div className="absolute inset-0 bg-zinc-900">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,168,83,0.15) 0%, transparent 50%, rgba(20,20,20,0.8) 100%)",
              }}
            />
            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(212,168,83,0.8) 1px, transparent 0)`,
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end">
            <div className="max-w-3xl mx-auto w-full px-6 pb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/30 border border-amber-500/20 mb-5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-amber-300/80 font-semibold">
                  Exclusive Experience
                </span>
              </div>

              {/* Title */}
              <h1
                className="text-4xl md:text-6xl text-zinc-100 mb-4 leading-[1.1]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Dubai Grand Prix
                <br />
                <span className="text-amber-200/80">Weekend</span>
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/70" />
                  </div>
                  <span className="text-sm text-zinc-300 tracking-wide">Dubai, UAE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-amber-400/70" />
                  </div>
                  <span className="text-sm text-zinc-300 tracking-wide font-mono">
                    14 — 17 Nov 2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-amber-400/70" />
                  </div>
                  <span className="text-sm text-zinc-300 tracking-wide">4 Days</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main Content ───────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-6 -mt-6 relative z-10 pb-32">
          {/* ── Concept & Vibe ─────────────────────────────────── */}
          <section className="mb-10">
            <GlassCard>
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <Star className="w-4 h-4 text-amber-500/50" />
                  <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                    Concept & Vibe
                  </h2>
                </div>
                <p
                  className="text-lg md:text-xl text-zinc-200 leading-relaxed tracking-wide"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  An immersive four-day affair where the desert meets the
                  extraordinary. Private yacht soirées at sunset, curated
                  gastronomy under the stars, and front-row access to the
                  most anticipated race weekend of the year. This is not
                  merely an event — it is a statement of presence.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Yacht Experience", "Gastronomy", "Nightlife", "Formula 1"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-zinc-800/40 border border-zinc-700/30 text-[11px] tracking-wide text-zinc-400"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>
            </GlassCard>
          </section>

          {/* ── Static Conditions ────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Crown className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Conditions
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— Included</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ConditionCard
                icon={<Home className="w-4 h-4" />}
                label="Accommodation"
                value="5-star Premium Villa"
              />
              <ConditionCard
                icon={<CreditCard className="w-4 h-4" />}
                label="Daily Reward"
                value="500 USDT / Day"
                accent
              />
              <ConditionCard
                icon={<Shirt className="w-4 h-4" />}
                label="Dress Code"
                value="Evening Elegance"
              />
            </div>

            {/* Additional conditions row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="rounded-xl p-4 bg-zinc-900/30 border border-zinc-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 font-medium">
                    Group Size
                  </span>
                </div>
                <p className="text-sm text-zinc-300">12 Residents</p>
              </div>
              <div className="rounded-xl p-4 bg-zinc-900/30 border border-zinc-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Wine className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 font-medium">
                    Dining
                  </span>
                </div>
                <p className="text-sm text-zinc-300">All Inclusive</p>
              </div>
              <div className="rounded-xl p-4 bg-zinc-900/30 border border-zinc-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 font-medium">
                    Events
                  </span>
                </div>
                <p className="text-sm text-zinc-300">Private Access</p>
              </div>
              <div className="rounded-xl p-4 bg-zinc-900/30 border border-zinc-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 font-medium">
                    Transfers
                  </span>
                </div>
                <p className="text-sm text-zinc-300">VIP Chauffeur</p>
              </div>
            </div>
          </section>

          {/* ── Conditional Ticket Block ─────────────────────────── */}
          <section className="mb-10">
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,168,83,0.04) 0%, rgba(24,24,24,0.5) 50%, rgba(212,168,83,0.02) 100%)",
              }}
            >
              <div className="absolute inset-0 rounded-xl border border-amber-500/15 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-amber-500/8" />

              <div className="p-5 md:p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-950/20 border border-amber-800/20 flex items-center justify-center text-amber-300/60 flex-shrink-0">
                  <Plane className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold mb-1.5">
                    Logistics Notice
                  </p>
                  <p className="text-sm text-amber-200/80 leading-relaxed">
                    Ticket Crediting is provided for this event
                  </p>
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                    Round-trip flight arrangements are included in your
                    residency package. Confirmation details will be shared
                    upon application approval.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Timeline Preview ─────────────────────────────────── */}
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
                Itinerary Preview
              </h2>
              <span className="text-[10px] text-zinc-600 ml-1">— At a Glance</span>
            </div>

            <div className="space-y-3">
              {[
                {
                  day: "Day 1",
                  date: "14 Nov",
                  title: "Arrival & Welcome Dinner",
                  desc: "Private airport transfer. Sunset yacht reception.",
                },
                {
                  day: "Day 2",
                  date: "15 Nov",
                  title: "Race Day & Afterparty",
                  desc: "Paddock access. Exclusive after-race celebration.",
                },
                {
                  day: "Day 3",
                  date: "16 Nov",
                  title: "Desert Experience",
                  desc: "Private dune dinner. Stargazing lounge.",
                },
                {
                  day: "Day 4",
                  date: "17 Nov",
                  title: "Departure",
                  desc: "Leisure morning. VIP transfer to airport.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative flex items-start gap-4 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/30 hover:border-zinc-700/40 transition-colors"
                >
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-600 font-semibold">
                      {item.day}
                    </p>
                    <p className="text-xs text-amber-200/70 font-mono mt-0.5">
                      {item.date}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 font-medium tracking-wide">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-700 flex-shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Apply Action (Sticky Bottom) ──────────────────────── */}
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
                <div className="hidden sm:block">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                    Application Status
                  </p>
                  <p className="text-sm text-zinc-300 mt-0.5">
                    {applied ? "Submitted" : "Open for Residents"}
                  </p>
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