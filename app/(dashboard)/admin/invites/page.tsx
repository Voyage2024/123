"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · INVITATIONS — страница
 * app/(dashboard)/admin/invites/page.tsx
 *
 * Данные (браузерный Supabase-клиент под сессией персонала):
 *   v_club_invites        — все ключи с гостьями, поручительницами,
 *                           этапами и дивидендами (персонал видит всё)
 *   game_circles          — названия Circle и квоты ключей
 *   club_patronage_rules  — дивиденды за этапы протеже
 *
 * Доступ: только owner и admin (как и в БД — club_is_admin()).
 * Менеджер, открывший адрес напрямую, видит спокойный экран «нет доступа».
 *
 * Realtime: новые ключи и анкеты, решения другого модератора, штампы
 * протеже (этапы → дивиденды), смена статуса профиля (блокировка) —
 * после любого события витрина перечитывается.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole, Radio, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { resolveCircles, type GameCircleRow } from "@/lib/gamification";
import {
  canManageInvites,
  normalizeInvite,
  resolveDividends,
  resolveQuota,
  type ClubInvite,
  type ClubInviteRow,
  type PatronageRuleRow,
} from "@/lib/patronage";
import AdminInvitesClient, { cormorant, useInvitesI18n } from "./AdminInvitesClient";

const RELOAD_DEBOUNCE_MS = 400;

type LoadMode = "initial" | "refresh" | "silent";
type LoadError = { message: string | null; code: string | null } | null;

type Raw = {
  invites: ClubInvite[];
  circles: GameCircleRow[];
  rules: PatronageRuleRow[];
};

const EMPTY: Raw = { invites: [], circles: [], rules: [] };

function isSchemaError(error: LoadError) {
  if (!error) return false;
  return (
    ["42P01", "42703", "42883", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

export default function AdminInvitesPage() {
  const auth = useAuth() as unknown as { loading?: boolean; role?: string | null };
  const authLoading = auth.loading ?? false;
  const allowed = canManageInvites(auth.role);
  const { t, nf } = useInvitesI18n();

  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<LoadError>(null);
  const [hasData, setHasData] = useState(false);
  const [live, setLive] = useState(false);

  const requestId = useRef(0);
  const mounted = useRef(true);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, []);

  const load = useCallback(async (mode: LoadMode = "initial") => {
    const id = ++requestId.current;
    const isCurrent = () => mounted.current && id === requestId.current;

    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode !== "silent") setError(null);

    try {
      const [invitesRes, circlesRes, rulesRes] = await Promise.all([
        supabase.from("v_club_invites").select("*").order("issued_at", { ascending: false }),
        supabase.from("game_circles").select("*").order("level", { ascending: true }),
        supabase.from("club_patronage_rules").select("*").order("sort_order", { ascending: true }),
      ]);
      if (!isCurrent()) return;

      const firstError = invitesRes.error ?? circlesRes.error ?? rulesRes.error;
      if (firstError) {
        console.error("[Invites Admin] Load error:", {
          invites: invitesRes.error,
          circles: circlesRes.error,
          rules: rulesRes.error,
        });
        setError({ message: firstError.message || null, code: firstError.code || null });
        return; // уже загруженные данные не стираем
      }

      setRaw({
        invites: ((invitesRes.data ?? []) as ClubInviteRow[]).map(normalizeInvite),
        circles: (circlesRes.data ?? []) as GameCircleRow[],
        rules: (rulesRes.data ?? []) as PatronageRuleRow[],
      });
      setHasData(true);
      setError(null);
    } catch (e) {
      if (!isCurrent()) return;
      console.error("[Invites Admin] Load exception:", e);
      setError({ message: e instanceof Error && e.message ? e.message : null, code: null });
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void load("silent"), RELOAD_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    if (authLoading || !allowed) return; // ждём сессию; менеджерам данные не грузим
    void load("initial");
  }, [authLoading, allowed, load]);

  // Realtime: всё, что меняет ключи, этапы протеже или статус гостей
  useEffect(() => {
    if (authLoading || !allowed) return;
    const channel = supabase
      .channel("voyage-admin-invites")
      .on("postgres_changes", { event: "*", schema: "public", table: "club_invites" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_patronage_rules" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_circles" }, scheduleReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_attendance" }, scheduleReload)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, scheduleReload)
      .subscribe((status) => {
        if (mounted.current) setLive(status === "SUBSCRIBED");
      });
    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [authLoading, allowed, scheduleReload]);

  // Решение модератора: патчим сразу, затем витрина перечитывается (дивиденды, Circle)
  const handleChanged = useCallback(
    (id: string, patch: Partial<ClubInvite>) => {
      setRaw((r) => ({ ...r, invites: r.invites.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      scheduleReload();
    },
    [scheduleReload],
  );

  /* ── Производные данные ── */

  const season = new Date().getUTCFullYear();
  const circles = useMemo(() => resolveCircles(raw.circles), [raw.circles]);
  const dividends = useMemo(() => resolveDividends(raw.rules), [raw.rules]);
  const quota = useMemo(() => resolveQuota(raw.circles), [raw.circles]);

  const stats = useMemo(() => {
    const inv = raw.invites;
    return [
      { label: t.statPending, value: nf.format(inv.filter((i) => i.status === "pending").length), hot: true },
      { label: t.statSealed, value: nf.format(inv.filter((i) => i.status === "sealed").length) },
      {
        label: t.statAdmitted(season),
        value: nf.format(
          inv.filter((i) => i.season === season && (i.status === "approved" || i.status === "burned")).length,
        ),
      },
      { label: t.statDividends, value: `+${nf.format(inv.reduce((s, i) => s + i.dividends, 0))}` },
    ];
  }, [raw.invites, t, nf, season]);

  const busy = loading || refreshing;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-32 text-sm text-zinc-500">
        <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
        {t.loading}
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-32 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 text-zinc-400">
          <span className="absolute inset-[4px] rounded-full border border-current opacity-20" />
          <LockKeyhole size={24} strokeWidth={1.2} aria-hidden />
        </span>
        <h1 className={`${cormorant.className} mt-6 text-3xl font-medium text-zinc-50`}>{t.noAccessTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">{t.noAccessBody}</p>
        <a
          href="/admin"
          className="mt-8 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30"
        >
          <ArrowLeft size={14} strokeWidth={1.6} />
          {t.backToConsole}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_-10%,rgba(253,230,138,0.06)_0%,transparent_60%)]" />
      </div>

      <header className="mb-8 border-b border-zinc-800/80 pb-6 sm:mb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-[1_1_22rem]">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-600">{t.eyebrow}</p>
            <h1 className={`${cormorant.className} mt-2 text-4xl font-medium tracking-wide text-zinc-50`}>{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">{t.subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${
                live
                  ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300/90"
                  : "border-zinc-800 text-zinc-600"
              }`}
            >
              <Radio size={11} strokeWidth={2} className={live ? "animate-pulse" : ""} />
              {live ? t.live : t.offline}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void load("refresh")}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} strokeWidth={1.75} className={refreshing ? "animate-spin" : ""} />
              {t.refresh}
            </button>
          </div>
        </div>

        {hasData && (
          <dl
            className="mt-6 grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))" }}
          >
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
                <dt className="truncate text-[9px] uppercase tracking-[0.25em] text-zinc-600" title={s.label}>
                  {s.label}
                </dt>
                <dd
                  className={`${cormorant.className} mt-1 text-2xl font-medium tabular-nums ${
                    s.hot && s.value !== "0" ? "text-amber-200" : "text-zinc-200"
                  }`}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 px-5 py-4">
          <div className="flex items-center gap-3 text-sm font-medium text-red-300">
            <AlertTriangle size={18} strokeWidth={1.5} />
            {hasData ? t.refreshFailed : t.loadFailed}
          </div>
          <p className="mt-2 break-words pl-[30px] font-mono text-xs text-red-300/80">
            {error.message ?? t.networkError}
          </p>
          {isSchemaError(error) && <p className="mt-2 pl-[30px] text-xs text-amber-200/80">{t.migrationHint}</p>}
          {!hasData && (
            <button
              type="button"
              onClick={() => void load("initial")}
              className="ml-[30px] mt-3 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-200 transition-colors hover:bg-red-500/10"
            >
              {t.retry}
            </button>
          )}
        </div>
      )}

      {loading && !hasData ? (
        <div className="flex items-center justify-center gap-2.5 py-24 text-sm text-zinc-500">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
          {t.loading}
        </div>
      ) : hasData ? (
        <AdminInvitesClient
          invites={raw.invites}
          circles={circles}
          dividends={dividends}
          quota={quota}
          season={season}
          onChanged={handleChanged}
        />
      ) : null}
    </div>
  );
}