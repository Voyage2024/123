"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · RESIDENT DIRECTORY — страница /admin
 * app/(dashboard)/admin/page.tsx
 *
 * Доступ: owner и admin (isClubAdmin, как club_is_admin() в БД).
 *   менеджер → переадресация на Overview (/admin/directory);
 *   остальные → экран «нет доступа», данные не грузятся.
 *
 * Данные (миграция 20261016_admin_directory_overview):
 *   v_admin_directory         — все профили (видят только owner/admin)
 *   club_admin_update_profile — правка анкеты и KYC; роль так не поменять
 * Новая резидентка — через серверный роут (service-role создаёт аккаунт
 * в Supabase Auth и профиль). Миграции ещё нет — страница читает profiles
 * напрямую, как раньше.
 *
 * Аватар: первое фото из photo_urls (приватный бакет user-uploads →
 * подписанные ссылки на час), иначе avatar_url (публичный бакет avatars).
 *
 * KYC: уровень строго 0…3, пустое/кривое значение — 0 (ничего не пройдено).
 * Уровень пишется отдельным RPC club_admin_set_kyc_level (принимает и 0),
 * отклонение файла — club_admin_reject_kyc (понижает KYC до level − 1).
 * Оба — миграция 20261009c_kyc_downgrade; без неё — прежний путь.
 * Файлы паспорта/видео смотрятся в DirectoryClient → KycVault.
 * ──────────────────────────────────────────────────────────────────── */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { isClubAdmin, isStaff } from "@/lib/access";
import { normalizeCircleKey } from "@/lib/gamification";
import { resolveAvatarUrl } from "@/lib/memberCards";
import { inviteErrorCode } from "@/lib/patronage";
import DirectoryClient, {
  clampKyc,
  cormorant,
  useDirectoryI18n,
  type DirectoryResident,
  type KycFilter,
  type ResidentDraft,
} from "./DirectoryClient";

const PHOTO_BUCKET = "user-uploads";
const SIGNED_URL_TTL = 60 * 60;
/** Серверный роут создания аккаунта: сначала /api/..., затем старый адрес */
const CREATE_USER_ENDPOINTS = ["/api/admin/create-user", "/admin/create-user"];

type Row = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  status?: string | null;
  kyc_level?: number | string | null;
  location?: string | null;
  citizenship?: string | null;
  photo_urls?: string[] | null;
  avatar_url?: string | null;
  email?: string | null;
  created_at?: string | null;
  circle_key?: string | null;
  circle_title?: string | null;
};

const clean = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

function toResident(r: Row, avatar: string | null): DirectoryResident {
  return {
    id: r.id,
    fullName: clean(r.full_name),
    role: clean(r.role),
    status: clean(r.status),
    // раньше пустое значение и 0 превращались в 1 — отсюда «ложный» первый уровень
    kycLevel: clampKyc(r.kyc_level),
    location: clean(r.location),
    citizenship: clean(r.citizenship),
    email: clean(r.email),
    createdAt: r.created_at ?? null,
    avatar,
    circleKey: normalizeCircleKey(r.circle_key),
    circleTitle: clean(r.circle_title),
  };
}

/** Первое фото анкеты → подписанная ссылка; иначе аватар из публичного бакета */
async function resolvePhotos(rows: Row[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const byPath = new Map<string, string[]>();
  for (const r of rows) {
    const first = (r.photo_urls ?? []).find((p) => typeof p === "string" && p.trim() !== "")?.trim();
    if (first && /^https?:\/\//i.test(first)) out[r.id] = first;
    else if (first) byPath.set(first, [...(byPath.get(first) ?? []), r.id]);
    else {
      const a = resolveAvatarUrl(r.avatar_url);
      if (a) out[r.id] = a;
    }
  }
  const paths = [...byPath.keys()];
  if (paths.length) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) console.error("[Directory] createSignedUrls:", error.message);
    for (const d of data ?? []) {
      if (d.path && d.signedUrl) for (const id of byPath.get(d.path) ?? []) out[id] = d.signedUrl;
    }
  }
  return out;
}

const isMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (["42P01", "PGRST202", "PGRST205", "42883"].includes(e.code ?? "") || /does not exist|schema cache|Could not find/i.test(e.message ?? ""));

const errorText = (err: { code?: string; message?: string }) =>
  inviteErrorCode(err) === "forbidden" ? "403 · owner / admin only" : err.message || "Error";

/* ── Экран без доступа ────────────────────────────────────────────── */

function Gate({ kind }: { kind: "loading" | "denied" }) {
  const { lang } = useDirectoryI18n();
  if (kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 size={22} className="animate-spin text-amber-200/70" aria-hidden />
      </div>
    );
  }
  const text = {
    en: ["Access denied", "Owners and administrators only", "This area of the club is open to the owner and administrators."],
    ru: ["Нет доступа", "Только для руководства", "Справочник резидентов доступен владельцу и администраторам клуба."],
    es: ["Acceso denegado", "Solo para la dirección", "El directorio está disponible para la propietaria y los administradores."],
    pt: ["Acesso negado", "Somente para a direção", "O diretório está disponível para a proprietária e os administradores."],
}[lang as 'en' | 'ru' | 'es' | 'pt'];
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-8 text-center backdrop-blur-md">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.05] text-amber-200/70">
          <Lock size={18} strokeWidth={1.5} aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">{text[0]}</p>
        <h1 className={`${cormorant.className} mt-1 text-2xl font-medium text-zinc-50`}>{text[1]}</h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{text[2]}</p>
      </div>
    </div>
  );
}

/* ── Страница ─────────────────────────────────────────────────────── */

function DirectoryPage() {
  const auth = useAuth() as unknown as {
    loading?: boolean;
    role?: string | null;
    user?: { id?: string; email?: string | null } | null;
  };
  const authLoading = auth.loading ?? false;
  const role = auth.role ?? null;
  const allowed = isClubAdmin(role);
  const router = useRouter();
  const params = useSearchParams();
  const initialKyc: KycFilter = params.get("kyc") === "pending" ? "pending" : params.get("kyc") === "verified" ? "verified" : "all";
  const { t } = useDirectoryI18n();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // менеджер — на Overview: справочник и KYC только у руководства
  useEffect(() => {
    if (!authLoading && !allowed && isStaff(role)) router.replace("/admin/directory");
  }, [authLoading, allowed, role, router]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      let list: Row[] = [];
      const res = await supabase.from("v_admin_directory").select("*").order("full_name", { ascending: true });
      if (res.error && isMissing(res.error)) {
        // миграции 20261016 ещё нет — как раньше, прямо из profiles
        const old = await supabase
          .from("profiles")
          .select("id, full_name, role, location, citizenship, status, kyc_level, photo_urls, avatar_url")
          .order("full_name", { ascending: true });
        if (old.error) throw old.error;
        list = (old.data ?? []) as Row[];
        if (mounted.current) setMigrationMissing(true);
      } else if (res.error) {
        throw res.error;
      } else {
        list = (res.data ?? []) as Row[];
        if (mounted.current) setMigrationMissing(false);
      }
      if (!mounted.current) return;
      setRows(list);
      setError(null);
      const photos = await resolvePhotos(list); // фото — не блокируя таблицу
      if (mounted.current) setAvatars(photos);
    } catch (e) {
      console.error("[Directory] Load error:", e);
      if (mounted.current) setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && allowed) void load();
  }, [authLoading, allowed, load]);

  const residents = useMemo(() => (rows ?? []).map((r) => toResident(r, avatars[r.id] ?? null)), [rows, avatars]);

  /** Правка анкеты: оптимистично, при ошибке — откат */
  const patchProfile = useCallback(
    async (id: string, patch: Record<string, string | number | null>): Promise<string | null> => {
      const prevRow = (rows ?? []).find((r) => r.id === id);
      const restore = Object.fromEntries(
        Object.keys(patch).map((k) => [k, prevRow ? prevRow[k as keyof Row] ?? null : null]),
      );
      setRows((list) => (list ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
      let err: { code?: string; message?: string } | null = null;
      const rpc = await supabase.rpc("club_admin_update_profile", { p_profile: id, p_patch: patch });
      err = rpc.error;
      if (err && isMissing(err)) {
        const direct = await supabase.from("profiles").update(patch).eq("id", id).select("id");
        err = direct.error ?? (direct.data?.length ? null : { message: "RLS: 0 rows updated", code: "42501" });
      }
      if (err) {
        console.error("[Directory] Save error:", err);
        if (prevRow) setRows((list) => (list ?? []).map((r) => (r.id === id ? { ...r, ...restore } : r)));
        return errorText(err);
      }
      return null;
    },
    [rows],
  );

  /**
   * Уровень KYC — отдельным RPC: он принимает 0 и ничего не «подтягивает»
   * к единице. Оптимистично, при ошибке откатывается только kyc_level.
   */
  const setKycLevel = useCallback(
    async (id: string, level: number): Promise<string | null> => {
      const target = clampKyc(level);
      const prev = clampKyc((rows ?? []).find((r) => r.id === id)?.kyc_level);
      const put = (v: number) => setRows((list) => (list ?? []).map((r) => (r.id === id ? { ...r, kyc_level: v } : r)));

      put(target);
      const rpc = await supabase.rpc("club_admin_set_kyc_level", { p_profile: id, p_level: target });
      if (rpc.error && isMissing(rpc.error)) {
        put(prev); // миграции 20261009c ещё нет — прежний путь
        return patchProfile(id, { kyc_level: target });
      }
      if (rpc.error) {
        console.error("[Directory] KYC level:", rpc.error);
        put(prev);
        return errorText(rpc.error);
      }
      const saved = clampKyc(rpc.data ?? target);
      if (saved !== target) put(saved); // база — источник правды
      return null;
    },
    [rows, patchProfile],
  );

  /** Подтверждение одного уровня KYC (а не сразу 3) — после просмотра файла */
  const onApprove = useCallback((id: string, level: number) => setKycLevel(id, level), [setKycLevel]);

  /** Отклонение файла: заявка → rejected; пройденный уровень → KYC = level − 1 */
  const onReject = useCallback(
    async (id: string, submissionId: string, level: number): Promise<string | null> => {
      const rpc = await supabase.rpc("club_admin_reject_kyc", { p_submission: submissionId });
      if (!rpc.error) {
        const next = clampKyc(rpc.data);
        setRows((list) => (list ?? []).map((r) => (r.id === id ? { ...r, kyc_level: next } : r)));
        return null;
      }
      if (!isMissing(rpc.error)) {
        console.error("[Directory] KYC reject:", rpc.error);
        return errorText(rpc.error);
      }
      // миграции 20261009c ещё нет: заявка напрямую + понижение уровнем ниже
      const upd = await supabase
        .from("kyc_submissions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", submissionId)
        .select("id");
      if (upd.error || !upd.data?.length) {
        console.error("[Directory] KYC reject (fallback):", upd.error ?? "0 rows");
        return upd.error ? errorText(upd.error) : "RLS: 0 rows updated";
      }
      const current = clampKyc((rows ?? []).find((r) => r.id === id)?.kyc_level);
      return current >= level ? setKycLevel(id, level - 1) : null;
    },
    [rows, setKycLevel],
  );

  const onSave = useCallback(
    async (d: ResidentDraft): Promise<string | null> => {
      const fields = {
        full_name: d.fullName.trim() || null,
        location: d.location.trim() || null,
        citizenship: d.citizenship.trim() || null,
        status: d.status.trim() || null,
        kyc_level: clampKyc(d.kycLevel),
      };
      if (d.id) {
        // анкета — как раньше, уровень KYC — отдельно и последним:
        // так 0 доходит до базы, даже если старый RPC анкеты его не принимает
        const { kyc_level, ...profileFields } = fields;
        const err = await patchProfile(d.id, profileFields);
        if (err) return err;
        return setKycLevel(d.id, kyc_level);
      }

      // новая резидентка — аккаунт создаёт сервер (service-role ключ)
      try {
        const { data: s } = await supabase.auth.getSession();
        let res: Response | null = null;
        for (const url of CREATE_USER_ENDPOINTS) {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
            body: JSON.stringify({ email: d.email, password: d.password, ...fields }),
          });
          if (res.status !== 404 && res.status !== 405) break;
        }
        const body = (await res?.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res || !res.ok) return body.error || body.message || `HTTP ${res?.status ?? "—"}`;
        await load();
        return null;
      } catch (e) {
        console.error("[Directory] create-user:", e);
        return e instanceof Error ? e.message : "Network error";
      }
    },
    [patchProfile, setKycLevel, load],
  );

  if (authLoading) return <Gate kind="loading" />;
  if (!allowed) return <Gate kind={isStaff(role) ? "loading" : "denied"} />;

  if (error && !rows) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-24">
        <div role="alert" className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-red-950/20 px-6 py-5">
          <p className="flex items-center gap-2.5 text-sm font-medium text-red-200">
            <AlertTriangle size={17} strokeWidth={1.5} aria-hidden />
            {t.failed}
          </p>
          <p className="mt-2 break-words font-mono text-xs text-red-300/70">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-500/10">
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-32 text-sm text-zinc-500">
        <span className="inline-flex items-center gap-2.5">
          <Loader2 size={17} strokeWidth={1.5} className="animate-spin" aria-hidden />
          {t.loading}
        </span>
      </div>
    );
  }

  return (
    <DirectoryClient
      residents={residents}
      initialKyc={initialKyc}
      refreshing={refreshing}
      migrationMissing={migrationMissing}
      viewer={{ id: auth.user?.id ?? null, email: auth.user?.email ?? null, role }}
      onRefresh={() => void load()}
      onSave={onSave}
      onApprove={onApprove}
      onReject={onReject}
    />
  );
}

export default function AdminDirectoryRoute() {
  return (
    <Suspense fallback={<Gate kind="loading" />}>
      <DirectoryPage />
    </Suspense>
  );
}