"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PATRONAGE — страница резидента
 * app/(dashboard)/dashboard/invite/page.tsx
 *
 * Данные (Supabase под сессией резидента, RLS — только своё):
 *   club_invite_allowance() — Circle, квота, занято, когда обновятся ключи
 *   v_club_invites          — свои ключи и протеже с этапами и дивидендами
 *   club_patronage_rules    — дивиденды за этапы
 *   game_circles            — квоты ключей по Circle (лестница на странице)
 * Ключ выдаёт RPC club_issue_invite — квоту проверяет сервер.
 * Realtime: решение модератора, штамп протеже → страница перечитывается.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeCircleKey, normalizeLang, num, type GameCircleRow, type Lang } from "@/lib/gamification";
import {
  inviteUrl,
  normalizeInvite,
  resolveDividends,
  resolveQuota,
  type ClubInvite,
  type ClubInviteRow,
  type PatronageRuleRow,
} from "@/lib/patronage";
import InviteClient, { type InviteData, type IssuedKey, type Protege } from "./InviteClient";

const RELOAD_DEBOUNCE_MS = 400;

type Allowance = {
  season: number | string;
  circle_key: string | null;
  quota: number | string;
  used: number | string;
  remaining: number | string;
  renews_at: string;
};

type Raw = { allowance: Allowance | null; invites: ClubInvite[]; rules: PatronageRuleRow[]; circles: GameCircleRow[] };

const TEXT: Record<Lang, { loading: string; failed: string; migration: string; retry: string }> = {
  en: {
    loading: "Opening your season keys…",
    failed: "Couldn't load your invitations",
    migration: "The club_invites migration hasn't been applied in Supabase yet.",
    retry: "Retry",
  },
  ru: {
    loading: "Открываем ключи сезона…",
    failed: "Не удалось загрузить приглашения",
    migration: "Миграция club_invites ещё не применена в Supabase.",
    retry: "Повторить",
  },
  es: {
    loading: "Abriendo sus llaves de la temporada…",
    failed: "No se pudieron cargar las invitaciones",
    migration: "La migración club_invites aún no se aplicó en Supabase.",
    retry: "Reintentar",
  },
  pt: {
    loading: "Abrindo suas chaves da temporada…",
    failed: "Não foi possível carregar os convites",
    migration: "A migração club_invites ainda não foi aplicada no Supabase.",
    retry: "Tentar de novo",
  },
};

/** Ключ из витрины → протеже на странице резидента */
function toProtege(i: ClubInvite): Protege {
  const sealed = i.status === "sealed";
  return {
    id: i.id,
    code: sealed ? i.code : undefined,
    inviteUrl: sealed ? inviteUrl(i.code) : undefined,
    name: i.guestFullName,
    avatarUrl: i.guestAvatarUrl,
    invitedAt: i.issuedAt,
    expiresAt: i.expiresAt,
    season: i.season,
    status: i.status === "approved" && i.milestones.firstStamp ? "touring" : i.status,
    circleKey: i.guestCircleKey,
    milestones: i.milestones,
    dividends: i.dividends,
  };
}

export default function InvitePage() {
  const auth = useAuth() as unknown as { user?: { id?: string } | null; loading?: boolean } | null;
  const userId = auth?.user?.id ?? null;
  const authLoading = auth?.loading ?? false;
  const ctx: unknown = useLanguage();
  const lang = normalizeLang(ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).lang : ctx);
  const text = TEXT[lang];

  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState<{ message: string; schema: boolean } | null>(null);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [allowanceRes, invitesRes, rulesRes, circlesRes] = await Promise.all([
        supabase.rpc("club_invite_allowance"),
        supabase.from("v_club_invites").select("*").eq("patron_id", userId).order("issued_at", { ascending: false }),
        supabase.from("club_patronage_rules").select("*"),
        supabase.from("game_circles").select("*").order("level", { ascending: true }),
      ]);
      if (!mounted.current) return;
      const firstError = allowanceRes.error ?? invitesRes.error ?? rulesRes.error ?? circlesRes.error;
      if (firstError) {
        console.error("[Invite] Load error:", firstError);
        setError({
          message: firstError.message,
          schema:
            ["42P01", "42883", "PGRST202", "PGRST205"].includes(firstError.code ?? "") ||
            /does not exist|schema cache/i.test(firstError.message ?? ""),
        });
        return;
      }
      const allowance = (
        Array.isArray(allowanceRes.data) ? allowanceRes.data[0] : allowanceRes.data
      ) as Allowance | null;
      setRaw({
        allowance: allowance ?? null,
        invites: ((invitesRes.data ?? []) as ClubInviteRow[]).map(normalizeInvite),
        rules: (rulesRes.data ?? []) as PatronageRuleRow[],
        circles: (circlesRes.data ?? []) as GameCircleRow[],
      });
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      console.error("[Invite] Load exception:", e);
      setError({ message: e instanceof Error ? e.message : String(e), schema: false });
    }
  }, [userId]);

  const scheduleReload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    if (authLoading || !userId) return;
    void load();
    // RLS отдаёт только свои ключи; штамп протеже меняет этапы и дивиденды
    const channel = supabase
      .channel(`voyage-invites-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_invites", filter: `patron_id=eq.${userId}` },
        scheduleReload,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "club_patronage_rules" }, scheduleReload)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, userId, load, scheduleReload]);

  const data = useMemo<InviteData | null>(() => {
    if (!raw) return null;
    const a = raw.allowance;
    const season = num(a?.season) ?? new Date().getUTCFullYear();
    return {
      circleKey: normalizeCircleKey(a?.circle_key) ?? "voyager",
      season,
      seasonEndsAt: a?.renews_at ?? `${season + 1}-01-01T00:00:00Z`,
      keysUsed: num(a?.used) ?? 0,
      keysTotal: num(a?.quota),
      proteges: raw.invites.map(toProtege),
      rules: { dividends: resolveDividends(raw.rules), quota: resolveQuota(raw.circles) },
    };
  }, [raw]);

  const issueKey = useCallback(
    async (guestName: string): Promise<IssuedKey> => {
      const { data: row, error: rpcError } = await supabase.rpc("club_issue_invite", { p_guest_name: guestName });
      if (rpcError) {
        scheduleReload(); // квота могла закончиться — покажем актуальное состояние
        throw rpcError;
      }
      const r = row as { code: string; guest_name: string; expires_at: string };
      scheduleReload();
      return { code: r.code, url: inviteUrl(r.code), guestName: r.guest_name, expiresAt: r.expires_at };
    },
    [scheduleReload],
  );

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-24">
        <div role="alert" className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-red-950/20 px-6 py-5">
          <p className="flex items-center gap-2.5 text-sm font-medium text-red-200">
            <AlertTriangle size={17} strokeWidth={1.5} aria-hidden />
            {text.failed}
          </p>
          <p className="mt-2 break-words font-mono text-xs text-red-300/70">{error.message}</p>
          {error.schema && <p className="mt-2 text-xs text-amber-200/80">{text.migration}</p>}
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-500/10"
          >
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

  return <InviteClient data={data} onIssueKey={issueKey} />;
}