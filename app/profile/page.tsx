"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  Shield,
  FileText,
  Upload,
  Eye,
  EyeOff,
  CreditCard,
  User,
  MapPin,
  Flag,
  Calendar,
  Ruler,
  Weight,
  Activity,
  Cigarette,
  Wine,
  AlignLeft,
  ChevronRight,
  UserCheck,
  Video,
  Phone,
  Crown,
  Sparkles,
  Gem,
  PartyPopper,
  Camera,
  Image,
  Plus,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
interface KYCLevel {
  id: number;
  title: string;
  description: string;
  status: "completed" | "pending" | "locked";
  icon: React.ReactNode;
}

// ─── Data ───────────────────────────────────────────────────────────
const kycLevels: KYCLevel[] = [
  {
    id: 1,
    title: "Identity",
    description: "International passport upload",
    status: "completed",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 2,
    title: "Club Loyalty",
    description: "Video mention of the club",
    status: "pending",
    icon: <Video className="w-5 h-5" />,
  },
  {
    id: 3,
    title: "Trust",
    description: "Video call verification",
    status: "locked",
    icon: <Phone className="w-5 h-5" />,
  },
];

// ─── Components ───────────────────────────────────────────────────────

function ProfileCompletionBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-[0.2em] uppercase text-zinc-500 font-medium">
          Profile Completion
        </span>
        <span className="text-xs tracking-[0.15em] text-amber-200/80 font-medium">
          {percentage}%
        </span>
      </div>
      <div className="relative h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)",
            boxShadow: "0 0 12px rgba(212,168,83,0.3)",
          }}
        />
      </div>
    </div>
  );
}

function KYCStatusBadge({ status }: { status: KYCLevel["status"] }) {
  const config = {
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      text: "Completed",
      className:
        "bg-emerald-950/40 text-emerald-400/90 border-emerald-800/30",
    },
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      text: "Pending",
      className:
        "bg-amber-950/30 text-amber-300/80 border-amber-800/20",
    },
    locked: {
      icon: <Lock className="w-3.5 h-3.5" />,
      text: "Locked",
      className:
        "bg-zinc-900/60 text-zinc-500 border-zinc-800/40",
    },
  };

  const c = config[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-[0.12em] uppercase font-semibold border ${c.className}`}
    >
      {c.icon}
      {c.text}
    </div>
  );
}

function KYCCard({ level }: { level: KYCLevel }) {
  const isLocked = level.status === "locked";
  const isCompleted = level.status === "completed";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-500 ${
        isLocked
          ? "bg-zinc-900/20 border-zinc-800/30 opacity-60"
          : isCompleted
          ? "bg-zinc-900/40 border-zinc-800/40 hover:border-emerald-900/40"
          : "bg-zinc-900/40 border-zinc-800/40 hover:border-amber-900/30"
      }`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-[1px] ${
          isCompleted
            ? "bg-emerald-500/20"
            : isLocked
            ? "bg-zinc-700/20"
            : "bg-amber-500/15"
        }`}
      />

      <div className="p-5 flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-colors duration-500 ${
            isCompleted
              ? "bg-emerald-950/30 border-emerald-800/30 text-emerald-400"
              : isLocked
              ? "bg-zinc-900/50 border-zinc-800/40 text-zinc-600"
              : "bg-amber-950/20 border-amber-800/20 text-amber-300/70"
          }`}
        >
          {level.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                Level {level.id}
              </span>
              <KYCStatusBadge status={level.status} />
            </div>
          </div>
          <h4
            className={`text-sm font-medium tracking-wide ${
              isLocked ? "text-zinc-500" : "text-zinc-200"
            }`}
          >
            {level.title}
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            {level.description}
          </p>
        </div>

        {!isLocked && (
          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1" />
        )}
      </div>
    </div>
  );
}

function VaultRow() {
  const [revealed, setRevealed] = useState(false);
  const walletShort = "T8x...7mK2";
  const walletFull = "T8x9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz7mK2";

  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
          <CreditCard className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
            USDT Wallet
          </p>
          <p className="text-sm text-zinc-300 mt-0.5 font-mono tracking-wide">
            {revealed ? walletFull : walletShort}
          </p>
        </div>
      </div>
      <button
        onClick={() => setRevealed(!revealed)}
        className="p-1.5 rounded-md hover:bg-zinc-800/50 text-zinc-600 hover:text-zinc-400 transition-all"
      >
        {revealed ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function ToggleSwitch({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
          {icon}
        </div>
        <span className="text-sm text-zinc-300">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-300 border ${
          checked
            ? "bg-amber-500/20 border-amber-500/40"
            : "bg-zinc-800/60 border-zinc-700/40"
        }`}
      >
        <div
          className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-300 ${
            checked
              ? "left-[22px] bg-amber-400 shadow-[0_0_8px_rgba(212,168,83,0.4)]"
              : "left-[2px] bg-zinc-500"
          }`}
        />
      </button>
    </div>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/40 overflow-hidden ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />
      {children}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function ResidentProfilePage() {
  const [smoking, setSmoking] = useState(false);
  const [alcohol, setAlcohol] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-[0.02]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.3) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-5 h-5 text-amber-200/60" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-600 font-semibold">
              Voyage Private Club
            </span>
          </div>
          <h1
            className="text-4xl md:text-5xl text-zinc-100 mb-6"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Resident Profile
          </h1>
          <ProfileCompletionBar percentage={80} />

          {/* ── Status & Achievements ──────────────────────────── */}
          <div
            className="mt-6 relative rounded-xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,168,83,0.02) 0%, rgba(24,24,24,0.4) 50%, rgba(212,168,83,0.015) 100%)",
            }}
          >
            <div className="absolute inset-0 rounded-xl border border-amber-500/15 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-amber-500/8" />

            <div className="p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              {/* Left: Status */}
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-semibold mb-1">
                  Current Status
                </p>
                <p
                  className="text-xl text-amber-200/90 tracking-wide"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Королева дискотек
                </p>
              </div>

              {/* Right: Achievements */}
              <div className="flex items-center gap-3">
                <button className="w-10 h-10 rounded-full bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_15px_rgba(253,230,138,0.2)] hover:border-amber-500/50">
                  <Sparkles className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 rounded-full bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_15px_rgba(253,230,138,0.2)] hover:border-amber-500/50">
                  <Gem className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 rounded-full bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_15px_rgba(253,230,138,0.2)] hover:border-amber-500/50">
                  <PartyPopper className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Personal Portfolio ─────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Personal Portfolio
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Verified Data</span>
          </div>

          <div className="space-y-3">
            {/* Name & Location with Avatar */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Identity
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-zinc-800/50 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                      <User className="w-9 h-9 text-zinc-500" />
                    </div>
                    <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-zinc-900 border border-amber-500/40 flex items-center justify-center text-amber-400 hover:text-amber-300 hover:border-amber-500/60 transition-all shadow-lg">
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                    <div>
                      <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        Full Name
                      </p>
                      <p className="text-sm text-zinc-200 tracking-wide">Zhenya</p>
                    </div>
                    <div>
                      <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        Current Location
                      </p>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-zinc-500" />
                        <p className="text-sm text-zinc-200 tracking-wide">Moscow</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Nationality & Birthdate */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Citizenship
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                      Nationality
                    </p>
                    <p className="text-sm text-zinc-200 tracking-wide">Russian</p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                      Date of Birth
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-zinc-500" />
                      <p className="text-sm text-zinc-200 tracking-wide font-mono">
                        15.03.1998
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Physical Parameters */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Physical Parameters
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Ruler className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      Height
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide">
                      172 cm
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Weight className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      Weight
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide">
                      54 kg
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Activity className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      Measurements
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide">
                      90 / 60 / 90
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Lifestyle Habits */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Cigarette className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Lifestyle Habits
                  </span>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  <ToggleSwitch
                    label="Smoking Status"
                    icon={<Cigarette className="w-4 h-4" />}
                    checked={smoking}
                    onChange={setSmoking}
                  />
                  <ToggleSwitch
                    label="Alcohol Consumption"
                    icon={<Wine className="w-4 h-4" />}
                    checked={alcohol}
                    onChange={setAlcohol}
                  />
                </div>
              </div>
            </GlassCard>

            {/* About & Preferences */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlignLeft className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    About & Preferences
                  </span>
                </div>
                <div className="bg-zinc-950/40 rounded-lg border border-zinc-800/30 p-4">
                  <p className="text-xs text-zinc-400 leading-[1.8] whitespace-pre-line">
                    {`Passionate about discovering hidden gems across the Mediterranean and Southeast Asia. Prefer boutique accommodations over large resorts. Interested in culinary tours, yacht experiences, and cultural immersion trips.

Looking for curated group experiences with like-minded travelers. Open to both summer and winter destinations.`}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ── Visual Portfolio ───────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Camera className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Visual Portfolio
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Polaroids & Digitals</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Photo 1 — Uploaded */}
            <div className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden group">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(212,168,83,0.06) 0%, transparent 50%, rgba(20,20,20,0.4) 100%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-6 h-6 text-zinc-700" />
              </div>
              <div className="absolute top-2 left-2">
                <div className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400/80" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-zinc-950/80 to-transparent">
                <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                  Polaroid 01
                </p>
              </div>
            </div>

            {/* Photo 2 — Uploaded */}
            <div className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden group">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(212,168,83,0.06) 0%, transparent 50%, rgba(20,20,20,0.4) 100%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-6 h-6 text-zinc-700" />
              </div>
              <div className="absolute top-2 left-2">
                <div className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400/80" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-zinc-950/80 to-transparent">
                <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                  Digital 01
                </p>
              </div>
            </div>

            {/* Photo 3 — Uploaded */}
            <div className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden group">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(212,168,83,0.06) 0%, transparent 50%, rgba(20,20,20,0.4) 100%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-6 h-6 text-zinc-700" />
              </div>
              <div className="absolute top-2 left-2">
                <div className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400/80" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-zinc-950/80 to-transparent">
                <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
                  Polaroid 02
                </p>
              </div>
            </div>

            {/* Upload Button */}
            <button className="relative aspect-[3/4] rounded-xl bg-transparent border border-dashed border-zinc-700 hover:border-amber-500/50 transition-all duration-300 flex flex-col items-center justify-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-zinc-900/60 border border-zinc-700/40 group-hover:border-amber-500/30 group-hover:bg-amber-950/20 flex items-center justify-center transition-all duration-300">
                <Plus className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <span className="text-[11px] tracking-[0.12em] uppercase text-zinc-500 group-hover:text-amber-300/80 transition-colors font-medium">
                Add Photo
              </span>
            </button>
          </div>
        </section>

        {/* ── KYC Verification ───────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <UserCheck className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              KYC Verification
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Trust Tiers</span>
          </div>

          <div className="space-y-3">
            {kycLevels.map((level) => (
              <KYCCard key={level.id} level={level} />
            ))}
          </div>
        </section>

        {/* ── Personal Vault (сокращённый) ───────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Personal Vault
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Encrypted</span>
          </div>

          <div className="bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/40 p-5">
            <VaultRow />
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="text-center pt-6 border-t border-zinc-900">
          <p className="text-[10px] tracking-[0.2em] text-zinc-700 uppercase">
            Voyage Private Club — Confidential
          </p>
          <p className="text-[10px] text-zinc-800 mt-1">
            All data is encrypted and stored under strict NDA
          </p>
        </footer>
      </div>
    </div>
  );
}