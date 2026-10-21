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
 *
 * Шапка-объяснялка (PageExplainerHeader, тексты — COPY) видна сразу,
 * ещё до загрузки ключей: в состояниях «загрузка» и «ошибка» она стоит
 * в той же сетке, что и в InviteClient, поэтому ничего не прыгает.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, Crown, Gem, Gift, KeyRound, Loader2, Send } from "lucide-react";
import PageExplainerHeader, { type ExplainerDict } from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";
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
import InviteClient, { type InviteData, type IssuedKey, type Protege } from "@/app/(dashboard)/dashboard/invite/InviteClient";

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

/** Шапка страницы — PageExplainerHeader. ES — на «usted», как весь InviteClient */
const COPY: ExplainerDict = {
  EN: {
    eyebrow: "Voyage · Patronage",
    title: "Extend an invitation",
    subtitle:
      "Voyage grows by recommendation alone. Every key is personal: your name stands beside hers on the invitation — so choose without haste.",
    steps: ["Seal a personal key", "Send it personally", "Earn dividends from her path"],
    cards: [
      {
        title: "Season keys · quota by Circle",
        text: "The higher your Circle, the more keys you hold each season. A key is single-use and time-limited: unopened, it returns to you; if the club declines your guest, it burns. Keys don’t carry over to the next season.",
      },
      {
        title: "Dividends · for her path, not a sign-up",
        text: "Influence Index points arrive in stages: she’s admitted to the club → her first visa stamp → Inner Circle. The finest protégées earn you the Club Scout, Patron and Tastemaker distinctions.",
        cta: "Global ranking",
      },
    ],
  },
  RU: {
    eyebrow: "Voyage · Patronage",
    title: "Пригласить в клуб",
    subtitle:
      "Voyage растёт только по рекомендации. Каждый ключ именной: на приглашении ваше имя стоит рядом с её именем — поэтому выбирайте не спеша.",
    steps: ["Запечатайте именной ключ", "Отправьте его лично", "Получайте дивиденды за её путь"],
    cards: [
      {
        title: "Ключи сезона · квота по Circle",
        text: "Чем выше ваш Circle, тем больше ключей в сезоне. Ключ одноразовый и живёт ограниченное время: не открыт — вернётся к вам, клуб не принял гостью — сгорает. На следующий сезон ключи не переносятся.",
      },
      {
        title: "Дивиденды · за путь, а не за регистрацию",
        text: "Баллы в Influence Index приходят по этапам: гостью приняли в клуб → первый визовый штамп → Inner Circle. За лучших протеже — отличия Club Scout, Patron и Tastemaker.",
        cta: "Глобальный рейтинг",
      },
    ],
  },
  ES: {
    eyebrow: "Voyage · Patronage",
    title: "Extender una invitación",
    subtitle:
      "Voyage solo crece por recomendación. Cada llave es nominal: en la invitación su nombre va junto al de ella, así que elija sin prisa.",
    steps: ["Selle una llave nominal", "Envíela personalmente", "Reciba dividendos por su recorrido"],
    cards: [
      {
        title: "Llaves de temporada · cuota por Circle",
        text: "Cuanto más alto su Circle, más llaves recibe cada temporada. La llave es de un solo uso y tiene plazo: si no se abre, vuelve a usted; si el club no admite a su invitada, se quema. Las llaves no pasan a la siguiente temporada.",
      },
      {
        title: "Dividendos · por su recorrido, no por el registro",
        text: "Los puntos del Influence Index llegan por etapas: admitida en el club → primer sello de visado → Inner Circle. Las mejores protegidas le valen las distinciones Club Scout, Patron y Tastemaker.",
        cta: "Ranking global",
      },
    ],
  },
  PT: {
    eyebrow: "Voyage · Patronage",
    title: "Estender um convite",
    subtitle:
      "O Voyage só cresce por indicação. Cada chave é nominal: no convite, o seu nome fica ao lado do dela — por isso escolha sem pressa.",
    steps: ["Sele uma chave nominal", "Envie pessoalmente", "Ganhe dividendos pelo caminho dela"],
    cards: [
      {
        title: "Chaves da temporada · cota por Circle",
        text: "Quanto mais alto o seu Circle, mais chaves por temporada. A chave é de uso único e tem prazo: se não for aberta, volta para você; se o clube não aceitar sua convidada, ela queima. As chaves não passam para a próxima temporada.",
      },
      {
        title: "Dividendos · pelo caminho, não pelo cadastro",
        text: "Os pontos do Influence Index chegam por etapas: aceita no clube → primeiro carimbo de visto → Inner Circle. As melhores protegidas rendem as distinções Club Scout, Patron e Tastemaker.",
        cta: "Ranking global",
      },
    ],
  },
};

/** Та же сетка, что у InviteClient: шапка не сдвигается, когда данные приходят */
function InviteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 antialiased">
      <div className="mx-auto max-w-6xl space-y-16 px-4 pb-10 pt-2 sm:px-8 sm:pb-14 sm:pt-2">{children}</div>
    </div>
  );
}

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial async data load for the signed-in member.
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

  const header = (
    <PageExplainerHeader
      copy={COPY}
      icon={Gift}
      stepIcons={[KeyRound, Send, Gem]}
      cards={[{ icon: CalendarDays }, { icon: Crown, href: "/dashboard/leaderboard" }]}
    />
  );

  if (error && !data) {
    return (
      <InviteFrame>
        {header}
        <div role="alert" className="mx-auto w-full max-w-lg rounded-2xl border border-red-500/25 bg-red-950/20 px-6 py-5">
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
      </InviteFrame>
    );
  }

  if (!data) {
    return (
      <InviteFrame>
        {header}
        <p role="status" className="flex items-center justify-center gap-2.5 text-sm text-zinc-500">
          <Loader2 size={17} strokeWidth={1.5} className="animate-spin" aria-hidden />
          {text.loading}
        </p>
      </InviteFrame>
    );
  }

  return <InviteClient data={data} onIssueKey={issueKey} header={header} />;
}