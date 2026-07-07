"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Users,
  ShieldAlert,
  CalendarClock,
  BadgeCheck,
  ArrowUpRight,
  Loader2,
  Lock,
  MapPin,
} from "lucide-react";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN OVERVIEW — /admin
 *
 * Стартовая панель админки. Верхний ряд — три метрики. Ниже — два блока:
 * слева последние подтверждённые резиденты (Recent Approvals), справа —
 * ближайшие туры/тусовки с прогресс-баром занятых мест.
 *
 * ДАННЫЕ:
 *  • Total Residents / Pending / Recent Approvals — реальные, из `profiles`
 *    (той же схемы, что использует Directory). Pending = kyc_level < 3,
 *    Recent Approvals = kyc_level >= 3.
 *  • Upcoming Events — пока статичная заглушка (UPCOMING_EVENTS). Когда в
 *    БД появится таблица `events`, замените массив на supabase-запрос —
 *    вёрстка карточек уже готова принять те же поля.
 *
 * Тот же ADMIN_EMAIL и guard-паттерн, что и на Directory, — как второй
 * рубеж поверх middleware и скрытого в сайдбаре меню.
 * ──────────────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = "fridelltubaugh129@gmail.com";
const SERIF = { fontFamily: "'Cormorant Garamond', serif" } as const;

// ─── Types ──────────────────────────────────────────────────────────
interface ProfileRow {
  id: string;
  full_name: string | null;
  location: string | null;
  status: string | null;
  kyc_level: number;
}

interface ClubEvent {
  id: string;
  title: string;
  kind: "Tour" | "Party";
  location: string;
  date: string; // человекочитаемая дата
  taken: number;
  capacity: number;
}

// Заглушка «Тусовок» — заменить на таблицу `events`, когда появится.
const UPCOMING_EVENTS: ClubEvent[] = [
  {
    id: "e1",
    title: "Midnight Yacht — Amalfi",
    kind: "Party",
    location: "Positano",
    date: "12 июл",
    taken: 34,
    capacity: 40,
  },
  {
    id: "e2",
    title: "Private Cellar Tour",
    kind: "Tour",
    location: "Bordeaux",
    date: "19 июл",
    taken: 11,
    capacity: 20,
  },
  {
    id: "e3",
    title: "Desert Sunrise Retreat",
    kind: "Tour",
    location: "AlUla",
    date: "02 авг",
    taken: 8,
    capacity: 24,
  },
];

const isFilled = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "";

function initials(name: string | null) {
  if (!isFilled(name)) return "—";
  return (name as string)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── UI primitives (в стиле Directory) ──────────────────────────────
function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-md ${className}`}
    >
      <div className="absolute left-0 right-0 top-0 h-px bg-zinc-700/20" />
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </h2>
  );
}

// ─── Metric card ────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Users;
  loading: boolean;
}) {
  return (
    <GlassCard>
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {label}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-950/40 text-amber-300/70">
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </span>
        </div>
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded bg-zinc-800/60" />
        ) : (
          <p className="text-4xl text-zinc-50" style={SERIF}>
            {value}
          </p>
        )}
        <p className="mt-2 text-[11px] tracking-wide text-zinc-600">{hint}</p>
      </div>
    </GlassCard>
  );
}

// ─── Main page ──────────────────────────────────────────────────────
export default function AdminOverviewPage() {
  const { user, loading: authLoading } = useAuth();

  const isAdmin =
    !!user?.email &&
    user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      setDataLoading(false);
      return;
    }

    let active = true;
    (async () => {
      setDataLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, location, status, kyc_level")
        .order("full_name", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Overview: не удалось загрузить профили:", error.message);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((d) => ({
            id: d.id,
            full_name: d.full_name ?? null,
            location: d.location ?? null,
            status: d.status ?? null,
            kyc_level: d.kyc_level ?? 1,
          }))
        );
      }
      setDataLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user, isAdmin]);

  // ── Производные метрики ──────────────────────────────────────────
  const { total, pending, approved } = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.kyc_level < 3).length;
    // Нет столбца с датой одобрения — берём подтверждённых (kyc>=3).
    // Когда появится `approved_at`, отсортируйте по нему по убыванию.
    const approved = rows.filter((r) => r.kyc_level >= 3).slice(0, 6);
    return { total, pending, approved };
  }, [rows]);

  // ── Guard 1: сессия ещё проверяется ──────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-300/70" />
      </div>
    );
  }

  // ── Guard 2: не админ ────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <GlassCard className="w-full max-w-sm">
          <div className="flex flex-col items-center p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-800/30 bg-amber-950/30 text-amber-300/70">
              <Lock className="h-5 w-5" />
            </div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Access Denied
            </p>
            <h1 className="mb-2 text-2xl text-zinc-100" style={SERIF}>
              Только для администраторов
            </h1>
            <p className="text-xs leading-relaxed text-zinc-500">
              Эта область доступна только администраторам клуба.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── Overview ─────────────────────────────────────────────────────
  return (
    <div className="relative text-zinc-100">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative">
        {/* ── Header ────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="mb-2 flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-200/60" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Voyage Private Club
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-300/80">
              Admin
            </span>
          </div>
          <h1 className="mb-2 text-4xl text-zinc-100 md:text-5xl" style={SERIF}>
            Overview
          </h1>
          <p className="text-xs tracking-wide text-zinc-500">
            Пульс клуба: резиденты, заявки и ближайшие тусовки
          </p>
        </header>

        {/* ── Метрики ───────────────────────────────────────────── */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Total Residents"
            value={total}
            hint="всего в базе клуба"
            icon={Users}
            loading={dataLoading}
          />
          <MetricCard
            label="Pending Requests"
            value={pending}
            hint="ждут подтверждения KYC"
            icon={ShieldAlert}
            loading={dataLoading}
          />
          <MetricCard
            label="Upcoming Tours / Parties"
            value={UPCOMING_EVENTS.length}
            hint="в ближайшем расписании"
            icon={CalendarClock}
            loading={false}
          />
        </section>

        {/* ── Центральный блок ──────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Recent Approvals */}
          <GlassCard>
            <div className="flex items-center justify-between border-b border-zinc-800/50 px-6 py-5">
              <SectionLabel>Recent Approvals</SectionLabel>
              <Link
                href="/admin/directory"
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 transition-colors hover:text-amber-300/80"
              >
                Directory
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-zinc-800/40">
              {dataLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-4">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-800/60" />
                    <div className="h-4 w-40 animate-pulse rounded bg-zinc-800/60" />
                  </div>
                ))
              ) : approved.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-zinc-500">
                    Пока нет подтверждённых резидентов
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-700">
                    Одобряйте заявки в разделе Directory
                  </p>
                </div>
              ) : (
                approved.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-zinc-900/30"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-950/20 text-[11px] font-semibold tracking-wide text-amber-200/80">
                      {initials(r.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {isFilled(r.full_name) ? r.full_name : "Без имени"}
                      </p>
                      {isFilled(r.status) ? (
                        <p
                          className="truncate text-xs tracking-wide text-amber-200/70"
                          style={SERIF}
                        >
                          {r.status}
                        </p>
                      ) : isFilled(r.location) ? (
                        <p className="truncate text-[11px] text-zinc-600">
                          {r.location}
                        </p>
                      ) : null}
                    </div>
                    <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-800/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/90">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Upcoming Events / Тусовки */}
          <GlassCard>
            <div className="flex items-center justify-between border-b border-zinc-800/50 px-6 py-5">
              <SectionLabel>Upcoming Events</SectionLabel>
              <Link
                href="/admin/events"
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 transition-colors hover:text-amber-300/80"
              >
                Все тусовки
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-5 p-6">
              {UPCOMING_EVENTS.map((ev) => {
                const pct = Math.min(
                  100,
                  Math.round((ev.taken / ev.capacity) * 100)
                );
                const nearlyFull = pct >= 85;
                return (
                  <div key={ev.id}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100" style={SERIF}>
                          {ev.title}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <MapPin className="h-3 w-3 text-zinc-600" />
                          {ev.location}
                          <span className="text-zinc-700">·</span>
                          <span className="uppercase tracking-widest text-zinc-600">
                            {ev.kind}
                          </span>
                        </p>
                      </div>
                      <span className="flex-shrink-0 rounded-md border border-zinc-800/60 bg-zinc-950/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                        {ev.date}
                      </span>
                    </div>

                    {/* progress */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/50">
                      <div
                        className={`h-full rounded-full transition-all ${
                          nearlyFull ? "bg-amber-400/70" : "bg-amber-500/40"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] tracking-widest text-zinc-600">
                      <span className="uppercase">
                        {ev.taken} / {ev.capacity} мест
                      </span>
                      <span
                        className={
                          nearlyFull ? "text-amber-300/80" : "text-zinc-500"
                        }
                      >
                        {nearlyFull ? "почти заполнено" : `${pct}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer className="mt-12 border-t border-zinc-900 pt-6 text-center">
          <p className="text-[10px] uppercase tracking-widest text-zinc-700">
            Voyage Private Club — Admin Console
          </p>
        </footer>
      </div>
    </div>
  );
}
