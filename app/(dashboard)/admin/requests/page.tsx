"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · MEMBERSHIP REQUESTS — страница
 * app/(dashboard)/admin/requests/page.tsx
 *
 * Заявки с главной («Запросить приглашение») — public.guest_applications.
 * Доступ: только owner и admin (как и в БД — club_is_admin()). Менеджер,
 * открывший адрес напрямую, видит экран «нет доступа», данные не грузятся.
 * Realtime: новая заявка с сайта или решение другого админа появляются сами.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, KeyRound, Loader2, LockKeyhole, Radio, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { isClubAdmin } from "@/lib/access";
import { normalizeApplication, type GuestApplication, type GuestApplicationRow } from "@/lib/guestApplications";
import AdminRequestsClient, { cormorant, useRequestsI18n } from "./AdminRequestsClient";

const RELOAD_DEBOUNCE_MS = 400;
const WEEK_MS = 7 * 86_400_000;

type LoadMode = "initial" | "refresh" | "silent";
type LoadError = { message: string | null; code: string | null } | null;

function isSchemaError(error: LoadError) {
  if (!error) return false;
  return (
    ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

export default function AdminRequestsPage() {
  const auth = useAuth() as unknown as { loading?: boolean; role?: string | null };
  const authLoading = auth.loading ?? false;
  const allowed = isClubAdmin(auth.role);
  const { t, nf } = useRequestsI18n();

  const [applications, setApplications] = useState<GuestApplication[]>([]);
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [keyPending, setKeyPending] = useState(0);
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
      const [appsRes, keysRes] = await Promise.all([
        supabase.from("guest_applications").select("*").order("created_at", { ascending: false }).limit(500),
        // анкеты по ключам живут в «Приглашениях» — показываем мостик, если они ждут решения
        supabase.from("club_invites").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (!isCurrent()) return;
      if (appsRes.error) {
        console.error("[Requests Admin] Load error:", appsRes.error);
        setError({ message: appsRes.error.message || null, code: appsRes.error.code || null });
        return;
      }

      const list = ((appsRes.data ?? []) as GuestApplicationRow[]).map(normalizeApplication);
      setApplications(list);
      setKeyPending(keysRes.error ? 0 : (keysRes.count ?? 0));
      setHasData(true);
      setError(null);

      // имена тех, кто принимал решения (если профили доступны админу)
      const ids = [...new Set(list.map((a) => a.reviewedBy).filter((v): v is string => !!v))];
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        if (isCurrent() && data) {
          setReviewers(
            Object.fromEntries(
              (data as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name?.trim() || "—"]),
            ),
          );
        }
      }
    } catch (e) {
      if (!isCurrent()) return;
      console.error("[Requests Admin] Load exception:", e);
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
    if (authLoading || !allowed) return;
    void load("initial");
  }, [authLoading, allowed, load]);

  useEffect(() => {
    if (authLoading || !allowed) return;
    const channel = supabase
      .channel("voyage-admin-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_applications" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_invites" }, scheduleReload)
      .subscribe((status) => {
        if (mounted.current) setLive(status === "SUBSCRIBED");
      });
    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [authLoading, allowed, scheduleReload]);

  const handleChanged = useCallback(
    (id: string, patch: Partial<GuestApplication>) => {
      setApplications((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      scheduleReload();
    },
    [scheduleReload],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    return [
      { label: t.statPending, value: applications.filter((a) => a.status === "pending").length, hot: true },
      { label: t.statWeek, value: applications.filter((a) => now - Date.parse(a.createdAt) < WEEK_MS).length },
      { label: t.statApproved, value: applications.filter((a) => a.status === "approved").length },
      { label: t.statRejected, value: applications.filter((a) => a.status === "rejected").length },
    ];
  }, [applications, t]);

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
                    s.hot && s.value > 0 ? "text-amber-200" : "text-zinc-200"
                  }`}
                >
                  {nf.format(s.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {hasData && keyPending > 0 && (
          <a
            href="/admin/invites"
            className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-3.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-amber-200/30 hover:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30"
          >
            <KeyRound size={13} strokeWidth={1.6} className="text-amber-200/70" />
            {t.keyApplications(keyPending)}
            <span className="inline-flex items-center gap-1 text-amber-200/80">
              {t.keyApplicationsLink}
              <ArrowRight size={12} strokeWidth={1.6} />
            </span>
          </a>
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
        <AdminRequestsClient applications={applications} reviewers={reviewers} onChanged={handleChanged} />
      ) : null}
    </div>
  );
}