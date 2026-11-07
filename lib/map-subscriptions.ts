/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · подписки резиденток на локации карты и лента локаций
 * lib/map-subscriptions.ts — клиентский слой (RLS + RPC под сессией)
 *
 * Миграция 20261106090000_map_hub_subscriptions.sql:
 *   voyage_map_hub_directory()                  активные локации + подписка
 *   voyage_set_map_hub_subscription(hub, bool)  подписаться / отписаться
 *   resident_location_feed                      лента (только своя, RLS)
 *   voyage_location_feed_mark_read(ids?)        прочитано
 * ──────────────────────────────────────────────────────────────────── */

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeCountryCode } from "@/lib/countries";

export type I18n = Partial<Record<"RU" | "EN" | "ES" | "PT", string>>;

export type HubEntry = {
  id: string;
  name: I18n;
  subtitle: I18n;
  region: string;
  countryCode: string | null;
  subscribed: boolean;
  tourId: string | null;
  tourTitle: I18n;
  openCastings: number;
};

export type FeedKind = "tour_new" | "casting_open";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  hubId: string | null;
  refId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

/** Сайдбар и карта слушают это событие, чтобы обновить счётчик непрочитанного */
export const LOCATION_FEED_EVENT = "voyage:location-feed";

const LANG_KEYS = ["RU", "EN", "ES", "PT"] as const;

export function toI18n(value: unknown): I18n {
  const out: I18n = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const r = value as Record<string, unknown>;
  for (const key of LANG_KEYS) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

/** Текст на языке интерфейса → EN → RU → любой */
export function pickText(value: I18n | unknown, lang: string, fallback = ""): string {
  const t = toI18n(value);
  const key = lang.toUpperCase() as keyof I18n;
  return t[key] ?? t.EN ?? t.RU ?? t.ES ?? t.PT ?? fallback;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseHub(raw: unknown): HubEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  return {
    id,
    name: toI18n(r.name),
    subtitle: toI18n(r.subtitle),
    region: (str(r.region) ?? "").toLowerCase(),
    countryCode: normalizeCountryCode(r.country_code),
    subscribed: r.subscribed === true,
    tourId: str(r.tour_id),
    tourTitle: toI18n(r.tour_title),
    openCastings: Number(r.open_castings) || 0,
  };
}

function parseFeed(raw: unknown): FeedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const kind = r.kind === "tour_new" || r.kind === "casting_open" ? r.kind : null;
  const refId = str(r.ref_id);
  if (!id || !kind || !refId) return null;
  return {
    id,
    kind,
    hubId: str(r.hub_id),
    refId,
    payload: r.payload && typeof r.payload === "object" && !Array.isArray(r.payload) ? (r.payload as Record<string, unknown>) : {},
    createdAt: str(r.created_at) ?? new Date().toISOString(),
    readAt: str(r.read_at),
  };
}

export type LoadState<T> = { loading: boolean; error: boolean; data: T };

/** Ошибка БД → понятная причина для интерфейса */
export type SubscriptionFailure = "inactive" | "limit" | "residents_only" | "schema" | "network";

function failureOf(error: { code?: string; message?: string }): SubscriptionFailure {
  const msg = error.message ?? "";
  if (msg.includes("map_hub_inactive")) return "inactive";
  if (msg.includes("subscription_limit")) return "limit";
  if (msg.includes("residents_only")) return "residents_only";
  if (error.code === "42883" || error.code === "PGRST202" || error.code === "42P01") return "schema";
  return "network";
}

export async function setHubSubscription(
  hubId: string,
  subscribed: boolean,
): Promise<{ ok: true; subscribed: boolean } | { ok: false; reason: SubscriptionFailure }> {
  const { data, error } = await supabase.rpc("voyage_set_map_hub_subscription", { p_hub: hubId, p_subscribed: subscribed });
  if (error) {
    console.warn("[map_hub_subscriptions]", error.code, error.message);
    return { ok: false, reason: failureOf(error) };
  }
  return { ok: true, subscribed: data === true };
}

/** Активные локации карты с отметкой подписки */
export function useHubDirectory() {
  const [state, setState] = useState<LoadState<HubEntry[]>>({ loading: true, error: false, data: [] });
  const reload = useCallback(async () => {
    const { data, error } = await supabase.rpc("voyage_map_hub_directory");
    if (error) {
      console.warn("[voyage_map_hub_directory]", error.code, error.message);
      setState({ loading: false, error: true, data: [] });
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    setState({ loading: false, error: false, data: rows.flatMap((row) => parseHub(row) ?? []) });
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload, setData: (fn: (prev: HubEntry[]) => HubEntry[]) => setState((s) => ({ ...s, data: fn(s.data) })) };
}

const FEED_COLUMNS = "id,kind,hub_id,ref_id,payload,created_at,read_at";

/** Последние записи ленты локаций (своя лента — RLS) */
export function useLocationFeed(limit = 30) {
  const [state, setState] = useState<LoadState<FeedItem[]>>({ loading: true, error: false, data: [] });
  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("resident_location_feed")
      .select(FEED_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[resident_location_feed]", error.code, error.message);
      setState({ loading: false, error: true, data: [] });
      return;
    }
    setState({ loading: false, error: false, data: (data ?? []).flatMap((row) => parseFeed(row) ?? []) });
  }, [limit]);
  useEffect(() => {
    void reload();
    const onEvent = () => void reload();
    window.addEventListener(LOCATION_FEED_EVENT, onEvent);
    return () => window.removeEventListener(LOCATION_FEED_EVENT, onEvent);
  }, [reload]);
  return { ...state, reload };
}

/** Отметить прочитанным (без ids — всё) */
export async function markLocationFeedRead(ids?: string[]): Promise<boolean> {
  const { error } = await supabase.rpc("voyage_location_feed_mark_read", ids && ids.length ? { p_ids: ids } : {});
  if (error) {
    console.warn("[voyage_location_feed_mark_read]", error.code, error.message);
    return false;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCATION_FEED_EVENT));
  return true;
}

/** Счётчик непрочитанного для меню. enabled=false — запросов нет (не резидентка). */
export function useUnreadLocationFeed(enabled: boolean, userId: string | null | undefined): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled || !userId) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = async () => {
      const { count: n, error } = await supabase
        .from("resident_location_feed")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (alive && !error) setCount(n ?? 0); // нет миграции — просто без счётчика
    };
    void load();
    const channel = supabase
      .channel(`voyage-location-feed-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_location_feed", filter: `profile_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    const onEvent = () => void load();
    window.addEventListener(LOCATION_FEED_EVENT, onEvent);
    return () => {
      alive = false;
      window.removeEventListener(LOCATION_FEED_EVENT, onEvent);
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId]);
  return count;
}

/** Регион карты → публичная страница региона с точками */
export const REGION_PAGE: Record<string, string> = {
  mena: "/destinations/middle-east",
  europe: "/destinations/europe",
  americas: "/destinations/americas",
  apac: "/destinations/asia-pacific",
};
