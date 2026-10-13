"use client";

import { useCallback, useEffect, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import FaceControlList, { type Application } from "./FaceControlList";
import { approveProfile } from "@/app/actions/approve-profile";
import { declineApplication } from "./actions";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

/* ──────────────────────────────────────────────────────────────────────
 * FACE CONTROL — очередь заявок с полной анкетой в модалке.
 *
 * Тянем расширенный набор колонок (физика, lifestyle, био) и собираем ВСЕ
 * ссылки из photo_urls в массив photos для галереи. avatar_url — первая
 * ссылка, для превью в карточке. В таблице нет created_at → без сортировки.
 *
 * email + temp_password — доступы гостя, которые генерирует и записывает
 * Telegram-бот; выводятся в модалке в блоке Access Credentials.
 * ──────────────────────────────────────────────────────────────────── */

const SELECT_COLS =
  "id, full_name, email, location, citizenship, status, kyc_level, photo_urls, " +
  "temp_password, " +
  "birth_date, height, weight, measurements, smoking, alcohol, about";

// photo_urls может прийти массивом, JSON-строкой или одиночной ссылкой.
function toPhotos(photoUrls: unknown): string[] {
  if (!photoUrls) return [];
  if (Array.isArray(photoUrls)) return photoUrls.filter(Boolean) as string[];
  if (typeof photoUrls === "string") {
    const s = photoUrls.trim();
    if (s.startsWith("[")) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return s ? [s] : [];
  }
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(r: any): Application {
  const photos = toPhotos(r.photo_urls);
  return {
    id: r.id,
    full_name: r.full_name ?? null,
    location: r.location ?? null,
    citizenship: r.citizenship ?? null,
    avatar_url: photos[0] ?? null,
    photos,
    kyc_level: r.kyc_level ?? null,
    status: r.status ?? null,
    // Доступы гостя (пишет Telegram-бот)
    email: r.email ?? null,
    temp_password: r.temp_password ?? null,
    // Расширенная анкета
    birth_date: r.birth_date ?? null,
    height: r.height ?? null,
    weight: r.weight ?? null,
    measurements: r.measurements ?? null,
    smoking: r.smoking ?? null,
    alcohol: r.alcohol ?? null,
    about: r.about ?? null,
  };
}

export default function FaceControlPage() {
  const { loading: authLoading } = useAuth();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualCredentials, setManualCredentials] = useState<{ login: string; password: string; profileId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select(SELECT_COLS)
      .or("status.is.null,status.eq.pending");

    if (error) {
      console.error("[Face Control] Ошибка загрузки profiles:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      setError(
        [error.message, error.details, error.hint].filter(Boolean).join(" · "),
      );
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[];
    setApplications(rows.map(normalize));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, load]);

  // Одобрение выполняется единственным серверным путём: проверка ролей,
  // KYC level 1, ротация временного пароля и отправка через Telegram Bot API.
  const moderate = useCallback(
    async (app: Application, action: "approve" | "decline") => {
      setNotice(null);
      setManualCredentials(null);
      if (action === "approve") {
        const result = await approveProfile(app.id);
        if (!result.success) throw new Error(result.error);
        if (result.warning) setNotice(result.warning);
        if (result.manualCredentials) setManualCredentials({ ...result.manualCredentials, profileId: app.id });
        setApplications((prev) => prev.filter((item) => item.id !== app.id));
        return { ok: true, warning: result.warning, manualCredentials: result.manualCredentials };
      }

      const result = await declineApplication(app.id);
      if (result.error) throw new Error(result.error);
      setApplications((prev) => prev.filter((item) => item.id !== app.id));
      return { ok: true };
    },
    [],
  );

  return (
    <div className="mx-auto max-w-4xl px-6 pb-10 pt-2">
      <header className="mb-8 flex items-end justify-between border-b border-zinc-800/80 pb-6">
        <div>
          <h1
            className={`${cormorant.className} text-4xl font-medium tracking-wide text-zinc-50`}
          >
            Face Control
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            Pending Applications
          </p>
        </div>

        {!loading && !error && applications.length > 0 && (
          <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs font-semibold tabular-nums text-amber-300/80">
            {applications.length} в очереди
          </span>
        )}
      </header>

      {notice && (
        <div role={manualCredentials ? "alert" : "status"} className="mb-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm text-amber-100/90">
          {notice}
        </div>
      )}

      {manualCredentials && (
        <section role="alert" aria-live="assertive" className="mb-6 rounded-2xl border border-rose-300/25 bg-rose-950/25 p-5 shadow-[0_20px_70px_-45px_rgba(244,63,94,0.25)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-rose-200" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-rose-100">Telegram delivery failed - send these credentials manually</h2>
              <p className="mt-1 text-xs leading-5 text-rose-100/70">The password has already been set in Supabase Auth. Share it with the resident through a verified private channel and ask them to change it after sign-in.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Login</p>
                  <code className="break-all text-sm text-zinc-100">{manualCredentials.login}</code>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(manualCredentials.login)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-amber-100"><Copy size={13}/> Copy login</button>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Temporary password</p>
                  <code className="break-all text-sm text-zinc-100">{manualCredentials.password}</code>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(manualCredentials.password)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-amber-100"><Copy size={13}/> Copy password</button>
                </div>
              </div>
              <button type="button" onClick={() => void navigator.clipboard.writeText(`Login: ${manualCredentials.login}
Password: ${manualCredentials.password}`)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.08] px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-200/[0.13]"><Check size={14}/> Copy both credentials</button>
              <p className="mt-3 text-[10px] text-zinc-600">Profile ID: <code>{manualCredentials.profileId}</code></p>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-zinc-500">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
          Загружаем очередь…
        </div>
      ) : error && applications.length === 0 ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-5 py-4">
          <div className="flex items-center gap-3 text-sm font-medium text-red-300">
            <AlertTriangle size={18} strokeWidth={1.5} />
            Не удалось загрузить очередь заявок
          </div>
          <p className="mt-2 break-words pl-[30px] font-mono text-xs text-red-300/80">
            {error}
          </p>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              <AlertTriangle size={16} strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}
          <FaceControlList
            applications={applications}
            onApprove={(app) => moderate(app, "approve")}
            onDecline={(app) => moderate(app, "decline")}
          />
        </>
      )}
    </div>
  );
}
