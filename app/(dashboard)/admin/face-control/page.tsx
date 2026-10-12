"use client";

import { useCallback, useEffect, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { AlertTriangle, Loader2, Copy, Check, KeyRound } from "lucide-react";
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
  const [manualCredentials, setManualCredentials] = useState<{ login: string; password: string } | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);

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
      setManualCredentials(null);
      setCredentialsCopied(false);
      if (action === "approve") {
        const result = await approveProfile(app.id);
        if (!result.success) throw new Error(result.error);
        if (result.warning) setNotice(result.warning);
        if (result.manualCredentials) setManualCredentials(result.manualCredentials);
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
      {manualCredentials && (
        <section role="alert" className="mb-6 rounded-2xl border border-amber-300/35 bg-amber-950/25 p-5 shadow-[0_0_35px_rgba(251,191,36,0.06)]">
          <div className="mb-2 flex items-center gap-2 text-amber-100">
            <KeyRound size={17} />
            <h2 className="text-sm font-semibold tracking-wide">Telegram-доставка не удалась - передайте доступы вручную</h2>
          </div>
          <p className="mb-4 text-xs leading-5 text-amber-100/70">Пароль уже установлен в Supabase Auth. Передайте эти данные пользователю по проверенному каналу, а не публикуйте их в общем чате.</p>
          <dl className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border border-amber-200/15 bg-zinc-950/60 px-3 py-2">
              <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-zinc-500">Логин</dt>
              <dd className="min-w-0 flex-1 break-all font-mono text-sm text-zinc-100">{manualCredentials.login}</dd>
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(manualCredentials.login); setCredentialsCopied(false); }} className="rounded-md p-2 text-zinc-400 transition-colors hover:text-amber-200" aria-label="Скопировать логин"><Copy size={14} /></button>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-amber-200/15 bg-zinc-950/60 px-3 py-2">
              <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-zinc-500">Пароль</dt>
              <dd className="min-w-0 flex-1 break-all font-mono text-sm text-zinc-100">{manualCredentials.password}</dd>
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(manualCredentials.password); setCredentialsCopied(false); }} className="rounded-md p-2 text-zinc-400 transition-colors hover:text-amber-200" aria-label="Скопировать пароль"><Copy size={14} /></button>
            </div>
          </dl>
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(`Login: ${manualCredentials.login}\nPassword: ${manualCredentials.password}`); setCredentialsCopied(true); }} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200/25 px-3 py-2 text-xs text-amber-100 transition-colors hover:bg-amber-200/10">
            {credentialsCopied ? <Check size={14} /> : <Copy size={14} />}
            {credentialsCopied ? "Скопировано" : "Скопировать оба поля"}
          </button>
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
