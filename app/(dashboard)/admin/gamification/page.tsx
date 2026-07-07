"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GAMIFICATION — клиентская страница
 * app/(dashboard)/admin/gamification/page.tsx
 *
 * Данные тянутся браузерным Supabase-клиентом под сессией админа
 * (как в Face Control) — серверный createClient шёл в базу без
 * авторизации и RLS резал выдачу profiles.
 *
 * ВАЖНО: revalidatePath в actions.ts обновляет только серверный рендер.
 * Для клиентской загрузки он не работает, поэтому статистика после
 * штампа обновляется кнопкой «Обновить» (или перезагрузкой страницы).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import GamificationAdminClient, {
  type Resident,
  type Destination,
} from "./GamificationAdminClient";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

export default function AdminGamificationPage() {
  const { loading: authLoading } = useAuth();

  const [residents, setResidents] = useState<Resident[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const [profilesRes, statsRes, destRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "approved"),
      supabase
        .from("v_global_leaderboard")
        .select("profile_id, total_influence, rank_title, level, rank_position"),
      supabase
        .from("game_destinations")
        .select("id, code, name, tag, region, layer, visa_tier")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const loadError =
      profilesRes.error?.message ??
      statsRes.error?.message ??
      destRes.error?.message ??
      null;

    if (loadError) {
      console.error("[Gamification Admin] Ошибка загрузки:", {
        profiles: profilesRes.error,
        leaderboard: statsRes.error,
        destinations: destRes.error,
      });
      setError(loadError);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Индексируем статистику по profile_id для быстрого сшивания.
    const statById = new Map(
      (statsRes.data ?? []).map((s) => [s.profile_id, s]),
    );

    const nextResidents: Resident[] = (profilesRes.data ?? [])
      .map((p) => {
        const s = statById.get(p.id);
        return {
          profileId: p.id as string,
          fullName: (p.full_name as string) ?? "Резидент без имени",
          avatarUrl: null, // тянем только id + full_name; инициалы-плейсхолдеры
          influence: s?.total_influence ?? 0,
          rankTitle: s?.rank_title ?? "Starting Saga",
          level: s?.level ?? 1,
        };
      })
      // сортируем по влиянию — сверху самые статусные
      .sort((a, b) => b.influence - a.influence);

    const nextDestinations: Destination[] = (destRes.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      tag: (d.tag as string) ?? null,
      region: d.region as string,
      layer: d.layer as number,
      visaTier: d.visa_tier as Destination["visaTier"],
    }));

    setResidents(nextResidents);
    setDestinations(nextDestinations);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authLoading) return; // ждём браузерную сессию админа
    load();
  }, [authLoading, load]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(90%_60%_at_50%_-10%,#17161a_0%,#0a0a0b_55%,#060607_100%)]" />

      <header className="mb-10 flex items-end justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-600">
            Voyage · Admin
          </p>
          <h1
            className={`${cormorant.className} mt-2 text-4xl font-medium tracking-wide text-zinc-50`}
          >
            Управление штампами
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Проставление визитов резидентам. После штампа нажмите
            «Обновить», чтобы пересчитать индекс и титулы.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => load(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            strokeWidth={1.75}
            className={refreshing ? "animate-spin" : ""}
          />
          Обновить
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2.5 py-24 text-sm text-zinc-500">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
          Загружаем резидентов и каталог направлений…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-5 py-4">
          <div className="flex items-center gap-3 text-sm font-medium text-red-300">
            <AlertTriangle size={18} strokeWidth={1.5} />
            Не удалось загрузить данные
          </div>
          <p className="mt-2 break-words pl-[30px] font-mono text-xs text-red-300/80">
            {error}
          </p>
        </div>
      ) : (
        <GamificationAdminClient
          residents={residents}
          destinations={destinations}
        />
      )}
    </div>
  );
}
