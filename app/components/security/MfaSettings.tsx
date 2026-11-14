"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";

/* ──────────────────────────────────────────────────────────────────────
 * Двухэтапный вход (TOTP) для owner/admin.
 *
 * Supabase Auth MFA: enroll → QR-код в приложении (Google Authenticator,
 * 1Password, Aegis…) → verify. После включения:
 *   • страница входа просит 6-значный код (app/(public)/login/page.tsx);
 *   • серверный гард /admin и requireRole пускают owner/admin только
 *     с сессией aal2 (lib/server/mfa.ts).
 * Отключить фактор можно только из сессии, уже прошедшей код (aal2).
 * ──────────────────────────────────────────────────────────────────── */

const COPY = {
  EN: {
    title: "Two-step sign-in",
    on: "Enabled. Each sign-in asks for a code from your authenticator app.",
    off: "Off. Recommended for owner and admin accounts.",
    enable: "Enable",
    scan: "Scan the QR code in your authenticator app, or enter the key manually.",
    key: "Key",
    code: "6-digit code",
    confirm: "Confirm",
    cancel: "Cancel",
    disable: "Turn off",
    disableConfirm: "Turn off two-step sign-in?",
    copied: "Copied",
    invalid: "Wrong or expired code.",
    failed: "Could not update two-step sign-in. Try again.",
    needAal2: "Sign out and sign in again with the code to change this setting.",
  },
  RU: {
    title: "Двухэтапный вход",
    on: "Включён. При каждом входе нужен код из приложения-аутентификатора.",
    off: "Выключен. Рекомендуем для аккаунтов owner и admin.",
    enable: "Включить",
    scan: "Отсканируйте QR-код в приложении-аутентификаторе или введите ключ вручную.",
    key: "Ключ",
    code: "Код из 6 цифр",
    confirm: "Подтвердить",
    cancel: "Отмена",
    disable: "Отключить",
    disableConfirm: "Отключить двухэтапный вход?",
    copied: "Скопировано",
    invalid: "Неверный или устаревший код.",
    failed: "Не удалось изменить настройку. Попробуйте ещё раз.",
    needAal2: "Выйдите и войдите снова с кодом, чтобы изменить эту настройку.",
  },
  ES: {
    title: "Inicio de sesión en dos pasos",
    on: "Activado. Cada inicio de sesión pide un código de tu app de autenticación.",
    off: "Desactivado. Recomendado para cuentas owner y admin.",
    enable: "Activar",
    scan: "Escanea el código QR en tu app de autenticación o introduce la clave manualmente.",
    key: "Clave",
    code: "Código de 6 dígitos",
    confirm: "Confirmar",
    cancel: "Cancelar",
    disable: "Desactivar",
    disableConfirm: "¿Desactivar el inicio en dos pasos?",
    copied: "Copiado",
    invalid: "Código incorrecto o caducado.",
    failed: "No se pudo cambiar el ajuste. Inténtalo de nuevo.",
    needAal2: "Cierra sesión y vuelve a entrar con el código para cambiar este ajuste.",
  },
  PT: {
    title: "Login em duas etapas",
    on: "Ativado. Cada login pede um código do seu app autenticador.",
    off: "Desativado. Recomendado para contas owner e admin.",
    enable: "Ativar",
    scan: "Escaneie o QR code no seu app autenticador ou digite a chave manualmente.",
    key: "Chave",
    code: "Código de 6 dígitos",
    confirm: "Confirmar",
    cancel: "Cancelar",
    disable: "Desativar",
    disableConfirm: "Desativar o login em duas etapas?",
    copied: "Copiado",
    invalid: "Código incorreto ou expirado.",
    failed: "Não foi possível alterar a configuração. Tente novamente.",
    needAal2: "Saia e entre novamente com o código para alterar esta configuração.",
  },
} as const;

type Enrollment = { factorId: string; qr: string; secret: string };

export default function MfaSettings() {
  const { role } = useAuth();
  const { lang } = useLanguage();
  const t = COPY[(String(lang).toUpperCase() as keyof typeof COPY) in COPY ? (String(lang).toUpperCase() as keyof typeof COPY) : "EN"];

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(t.failed);
      setLoading(false);
      return;
    }
    const verified = (data?.totp ?? []).find((f) => f.status === "verified");
    setVerifiedId(verified?.id ?? null);
    setLoading(false);
  }, [t.failed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (role !== "owner" && role !== "admin") return null;

  const start = async () => {
    setBusy(true);
    setError(null);
    // Незавершённые попытки мешают новой: убираем их.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `VOYAGE ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (enrollError || !data) {
      setError(t.failed);
      return;
    }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  };

  const confirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!enrollment) return;
    const clean = code.replace(/\s+/g, "");
    if (!/^[0-9]{6}$/.test(clean)) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: clean });
    setBusy(false);
    if (verifyError) {
      setError(t.invalid);
      return;
    }
    setEnrollment(null);
    setCode("");
    await refresh();
  };

  const cancel = async () => {
    if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
    setError(null);
  };

  const disable = async () => {
    if (!verifiedId || !window.confirm(t.disableConfirm)) return;
    setBusy(true);
    setError(null);
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      setBusy(false);
      setError(t.needAal2);
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedId });
    setBusy(false);
    if (unenrollError) {
      setError(t.failed);
      return;
    }
    await refresh();
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* буфер недоступен — ключ виден на экране */
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        {verifiedId ? (
          <ShieldCheck size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-emerald-300/80" />
        ) : (
          <ShieldOff size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-zinc-500" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-zinc-100">{t.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {loading ? <Loader2 size={13} className="inline animate-spin" /> : verifiedId ? t.on : t.off}
          </p>
        </div>
        {!loading && !enrollment && (
          verifiedId ? (
            <button type="button" onClick={() => void disable()} disabled={busy} className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-red-400/40 hover:text-red-200 disabled:opacity-50">
              {t.disable}
            </button>
          ) : (
            <button type="button" onClick={() => void start()} disabled={busy} className="shrink-0 rounded-lg bg-[#c9a961] px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-amber-200 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : t.enable}
            </button>
          )
        )}
      </div>

      {enrollment && (
        <form onSubmit={confirm} className="mt-5 space-y-4 border-t border-zinc-800/80 pt-5">
          <p className="text-xs leading-relaxed text-zinc-400">{t.scan}</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* QR приходит от Supabase как data:image/svg+xml — внешних запросов нет */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qr} alt="QR" width={176} height={176} className="rounded-lg bg-white p-2" />
            <div className="w-full min-w-0 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.key}</p>
                <button type="button" onClick={() => void copySecret()} className="mt-1 flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left font-mono text-xs text-zinc-200">
                  <span className="min-w-0 flex-1 break-all">{enrollment.secret}</span>
                  {copied ? <Check size={14} className="shrink-0 text-emerald-300" /> : <Copy size={14} className="shrink-0 text-zinc-500" />}
                </button>
                {copied && <p className="mt-1 text-[11px] text-emerald-300/80">{t.copied}</p>}
              </div>
              <div>
                <label htmlFor="mfa-enroll-code" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.code}</label>
                <input
                  id="mfa-enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-center tracking-[0.5em] text-zinc-100 focus:border-amber-200/40 focus:outline-none"
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-zinc-100 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-950 hover:bg-amber-200 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : t.confirm}
            </button>
            <button type="button" onClick={() => void cancel()} disabled={busy} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-50">
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
    </section>
  );
}
