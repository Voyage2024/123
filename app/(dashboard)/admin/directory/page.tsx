"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · OVERVIEW — страница /admin/directory
 * app/(dashboard)/admin/directory/page.tsx
 *
 * Сводка клуба для всего персонала (owner, admin, manager).
 * Данные — одна RPC club_admin_overview() (миграция 20261016): счётчики,
 * недавние одобрения из applications (имя — живое, из profiles; хаб/тур),
 * ближайшие тусовки из global_events. Обновляется при возврате на вкладку.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { isClubAdmin, isStaff } from "@/lib/access";
import { resolveAvatarUrl } from "@/lib/memberCards";
import AdminOverviewClient, { cormorant, useOverviewI18n, type OverviewData } from "./AdminOverviewClient";

type Raw = {
  residents?: number;
  kyc_pending?: number;
  kyc_tracked?: boolean;
  parties_upcoming?: number;
  parties_dated?: boolean;
  recent_approvals?: Array<{ id: string; profile_id: string | null; full_name: string | null; avatar_url: string | null; hub: string | null; tour: string | null; at: string | null }>;
  upcoming_parties?: Array<{ id: string; title: string; region: string | null; starts_at: string | null; created_at: string | null }>;
  warnings?: string[];
  generated_at?: string;
};

const TEXT = {
  en: { loading: "Gathering the overview…", failed: "Couldn't load the overview", migration: "Apply the 20261016_admin_directory_overview.sql migration in Supabase.", retry: "Retry", denied: "The console is open to club staff only." },
  ru: { loading: "Собираем сводку…", failed: "Не удалось загрузить сводку", migration: "Примените в Supabase миграцию 20261016_admin_directory_overview.sql.", retry: "Повторить", denied: "Консоль доступна только персоналу клуба." },
  es: { loading: "Reuniendo el resumen…", failed: "No se pudo cargar el resumen", migration: "Aplica en Supabase la migración 20261016_admin_directory_overview.sql.", retry: "Reintentar", denied: "La consola es solo para el equipo del club." },
  pt: { loading: "Reunindo a visão geral…", failed: "Não foi possível carregar a visão geral", migration: "Aplique no Supabase a migração 20261016_admin_directory_overview.sql.", retry: "Tentar de novo", denied: "O console é exclusivo da equipe do clube." },
};

function toData(r: Raw): OverviewData {
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return {
    residents: n(r.residents),
    kycPending: n(r.kyc_pending),
    kycTracked: r.kyc_tracked !== false,
    partiesUpcoming: n(r.parties_upcoming),
    partiesDated: !!r.parties_dated,
    approvals: (r.recent_approvals ?? []).map((a) => ({
      id: a.id,
      profileId: a.profile_id,
      name: a.full_name?.trim() || null,
      avatarUrl: resolveAvatarUrl(a.avatar_url),
      hub: a.hub,
      tour: a.tour,
      at: a.at,
    })),
    parties: (r.upcoming_parties ?? []).map((p) => ({ id: p.id, title: p.title, region: p.region, startsAt: p.starts_at, createdAt: p.created_at })),
    warnings: r.warnings ?? [],
    generatedAt: r.generated_at ?? new Date().toISOString(),
  };
}

export default function AdminOverviewPage() {
  const auth = useAuth() as unknown as { loading?: boolean; role?: string | null };
  const authLoading = auth.loading ?? false;
  const staff = isStaff(auth.role);
  const { lang } = useOverviewI18n();
 const text = TEXT[lang as 'en' | 'ru' | 'es' | 'pt'];

  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<{ message: string; migration: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data: raw, error: rpcError } = await supabase.rpc("club_admin_overview");
    if (!mounted.current) return;
    setRefreshing(false);
    if (rpcError) {
      console.error("[Overview] Load error:", rpcError);
      setError({
        message: rpcError.message,
        migration: ["PGRST202", "42883"].includes(rpcError.code ?? "") || /Could not find|does not exist/i.test(rpcError.message ?? ""),
      });
      return;
    }
    setData(toData((raw ?? {}) as Raw));
    setError(null);
  }, []);

  useEffect(() => {
    if (authLoading || !staff) return;
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [authLoading, staff, load]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 size={22} className="animate-spin text-amber-200/70" aria-hidden />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.05] text-amber-200/70">
            <Lock size={18} strokeWidth={1.5} aria-hidden />
          </span>
          <p className={`${cormorant.className} text-2xl font-medium text-zinc-50`}>Voyage · Console</p>
          <p className="mt-2 text-xs text-zinc-500">{text.denied}</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-24">
        <div role="alert" className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-red-950/20 px-6 py-5">
          <p className="flex items-center gap-2.5 text-sm font-medium text-red-200">
            <AlertTriangle size={17} strokeWidth={1.5} aria-hidden />
            {text.failed}
          </p>
          <p className="mt-2 break-words font-mono text-xs text-red-300/70">{error.message}</p>
          {error.migration && <p className="mt-2 text-xs text-amber-200/80">{text.migration}</p>}
          <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-500/10">
            {text.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-32 text-sm text-zinc-500">
        <span className="inline-flex items-center gap-2.5">
          <Loader2 size={17} strokeWidth={1.5} className="animate-spin" aria-hidden />
          {text.loading}
        </span>
      </div>
    );
  }

  return <AdminOverviewClient data={data} canManage={isClubAdmin(auth.role)} refreshing={refreshing} onRefresh={() => void load()} />;
}