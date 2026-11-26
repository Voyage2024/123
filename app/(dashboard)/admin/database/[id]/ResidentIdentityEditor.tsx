"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Карточка резидентки → «Идентификационные данные»
 * owner/admin меняют гражданство и дату рождения после сверки с документом.
 * Причина обязательна; правка и запись 'profile.identity_change' в
 * audit_logs — одна транзакция в БД (app/actions/admin-resident-identity.ts).
 * ──────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Save } from "lucide-react";
import { staffUpdateResidentIdentity } from "@/app/actions/admin-resident-identity";
import { CITIZENSHIP_MAX } from "@/lib/resident-profile-fields";

const ERRORS: Record<string, string> = {
  invalid: "Проверьте значения: гражданство буквами, дата рождения в формате ГГГГ-ММ-ДД и не в будущем.",
  reason_required: "Укажите причину (от 5 символов): например, «сверено с паспортом, заявка консьержу от 26.11».",
  nothing_to_change: "Значения не изменились.",
  forbidden: "Менять идентификационные данные могут только owner и admin.",
  not_found: "Профиль резидентки не найден.",
  unauthenticated: "Сессия истекла. Войдите снова.",
  server_error: "Не удалось сохранить. Повторите попытку.",
};

export default function ResidentIdentityEditor({
  profileId,
  citizenship,
  birthDate,
  identityLocked,
}: {
  profileId: string;
  citizenship: string | null;
  birthDate: string | null;
  /** KYC отправлен на проверку или подтверждён (public.voyage_identity_locked) */
  identityLocked: boolean;
}) {
  const router = useRouter();
  const [cit, setCit] = useState(citizenship ?? "");
  const [dob, setDob] = useState(birthDate ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const verified = identityLocked;

  const dirty = (cit.trim() || null) !== (citizenship ?? null) || (dob || null) !== (birthDate ?? null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const patch: { citizenship?: string | null; birth_date?: string | null } = {};
    if ((cit.trim() || null) !== (citizenship ?? null)) patch.citizenship = cit;
    if ((dob || null) !== (birthDate ?? null)) patch.birth_date = dob;
    const result = await staffUpdateResidentIdentity({ profileId, ...patch, reason });
    setBusy(false);
    if (!result.ok) {
      setMessage({ ok: false, text: ERRORS[result.reason] ?? ERRORS.server_error });
      return;
    }
    setCit(result.citizenship ?? "");
    setDob(result.birth_date ?? "");
    setReason("");
    setMessage({ ok: true, text: "Сохранено. Изменение записано в журнал аудита." });
    router.refresh();
  };

  const input = "w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-200/40";
  return (
    <section aria-labelledby="identity-title" className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="identity-title" className="flex items-center gap-2 font-serif text-xl text-zinc-100">
          <Fingerprint size={18} className="text-amber-200/70" /> Идентификационные данные
        </h2>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${verified ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-200/80" : "border-zinc-700/70 text-zinc-400"}`}>
          {verified ? "Под KYC — резидентка не может менять сама" : "Документы KYC не отправлены — резидентка может менять сама"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        Меняйте только после сверки с документом. Запросы резиденток приходят в «Консьерж» с заголовком «[Данные KYC]».
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Гражданство</span>
          <input value={cit} maxLength={CITIZENSHIP_MAX} onChange={(e) => setCit(e.target.value)} className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Дата рождения</span>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${input} font-mono`} />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Причина изменения (в журнал)</span>
          <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Сверено с паспортом, заявка консьержу от …" className={input} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/50 bg-amber-200 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>
        )}
      </div>
    </section>
  );
}
