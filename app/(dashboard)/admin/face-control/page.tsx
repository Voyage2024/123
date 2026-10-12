"use client";

import { useCallback, useEffect, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { AlertTriangle, Loader2 } from "lucide-react";
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
  // KYC0, ротация временного пароля и отправка через встроенный Telegram webhook.
  const moderate = useCallback(
    async (app: Application, action: "approve" | "decline") => {
      setNotice(null);
      if (action === "approve") {
        const result = await approveProfile(app.id);
        if (!result.success) throw new Error(result.error);
        if (result.warning) setNotice(result.warning);
        setApplications((prev) => prev.filter((item) => item.id !== app.id));
        return { ok: true, warning: result.warning };
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
        <div role="status" className="mb-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm text-amber-100/90">
          {notice}
        </div>
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
