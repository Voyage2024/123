"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Карточка резидентки → блок «Identity & KYC» (только owner/admin)
 *
 * Показывает гражданство, дату рождения, статус KYC и запросы резидентки
 * на их изменение. Редактировать здесь можно ТОЛЬКО эти два поля:
 *  - «Edit identity» — ручное исправление с обязательной причиной
 *    (saveResidentIdentityAndCloseRequests → staffUpdateResidentIdentity →
 *    voyage_staff_set_resident_identity); если после сохранения данные
 *    совпали с активным запросом, запрос закрывается как done;
 *  - «Approve & Apply» / «Reject» по запросу резидентки и «Завершить:
 *    данные уже исправлены» (app/actions/admin-identity-requests.ts).
 * Изменение профиля и запись в audit_logs — одна транзакция в БД.
 * Прямых запросов к profiles из браузера нет.
 * ──────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CheckCheck, Fingerprint, Loader2, LockKeyhole, Pencil, Save, X } from "lucide-react";
import {
  approveResidentIdentityRequest,
  completeAppliedIdentityRequest,
  rejectResidentIdentityRequest,
  saveResidentIdentityAndCloseRequests,
} from "@/app/actions/admin-identity-requests";
import { CITIZENSHIP_MAX } from "@/lib/resident-profile-fields";
import { IDENTITY_FIELD_LABEL_RU, IDENTITY_REQUEST_STATUS_RU, planIdentityApproval, type IdentityProposal } from "@/lib/resident-identity-requests";

export type IdentityRequestItem = {
  id: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  admin_feedback: string | null;
  proposal: IdentityProposal | null;
  /** Ручное изменение тех же полей после подачи (по журналу аудита). */
  manualChangeAt?: string | null;
};
export type KycSubmissionItem = { level: number; status: string; created_at: string };

const EDIT_ERRORS: Record<string, string> = {
  invalid: "Проверьте значения: гражданство буквами, дата рождения в формате ГГГГ-ММ-ДД и не в будущем.",
  reason_required: "Укажите причину (от 5 символов): например, «сверено с паспортом».",
  nothing_to_change: "Значения не изменились.",
  forbidden: "Менять идентификационные данные могут только owner и admin (admin не может менять данные owner).",
  not_found: "Профиль резидентки не найден.",
  unauthenticated: "Сессия истекла. Войдите снова.",
  server_error: "Не удалось сохранить. Данные и журнал не изменены. Повторите попытку.",
};

const DECISION_ERRORS: Record<string, string> = {
  invalid: "Запрос не найден.",
  reason_required: "Укажите комментарий к решению (от 5 символов).",
  unauthenticated: "Сессия истекла. Войдите снова.",
  forbidden: "Обрабатывать запросы могут только owner и admin.",
  not_found: "Запрос не найден или это не запрос на изменение данных KYC.",
  already_processed: "Запрос уже обработан. Обновите страницу.",
  unparseable: "Не удалось прочитать изменения из запроса. Откройте его в «Консьерже» и исправьте данные через «Edit identity».",
  stale: "Данные профиля изменились после подачи запроса. Сверьте значения и исправьте через «Edit identity» или отклоните запрос.",
  not_applied: "После подачи запроса данные не меняли. Примените его кнопкой «Approve & Apply» или отклоните.",
  close_failed: "Данные изменены и записаны в журнал, но запрос не закрылся. Нажмите «Approve & Apply» ещё раз — повторного изменения не будет.",
  server_error: "Не удалось выполнить. Профиль и журнал не изменены, запрос остаётся открытым.",
};

const KYC_LEVEL = ["не пройден", "паспорт", "видео", "личная встреча"];
const SUBMISSION_KIND: Record<number, string> = { 1: "Паспорт", 2: "Видео" };
const SUBMISSION_STATUS: Record<string, string> = { pending: "на проверке", approved: "одобрено", rejected: "отклонено" };

const fmtDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
};
const fmtBirth = (value: string | null | undefined) => {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
};
const show = (field: "citizenship" | "birth_date", value: string | null | undefined) =>
  field === "birth_date" ? fmtBirth(value) : value?.trim() || "—";

const input = "w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-200/40";
const label = "text-[10px] uppercase tracking-[0.18em] text-zinc-500";

function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/15 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{title}</p>
      <div className="mt-2 break-words text-sm text-zinc-200">{children}</div>
    </div>
  );
}

function RequestCard({
  request,
  current,
  onDone,
}: {
  request: IdentityRequestItem;
  current: { citizenship: string | null; birth_date: string | null };
  onDone: (text: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = request.proposal;
  const fields = p ? (["citizenship", "birth_date"] as const).filter((f) => p[f]) : [];
  const plan = p ? planIdentityApproval(p, current) : null;
  // apply — Approve & Apply; complete — данные уже исправлены (совпадают с запросом
  // или после подачи есть ручная правка в журнале); stale — правки не было, данные другие.
  const mode = plan?.kind === "apply" ? "apply"
    : plan?.kind === "already_applied" || request.manualChangeAt ? "complete"
    : plan?.kind === "stale" ? "stale" : "none";

  const decide = async (kind: "approve" | "reject" | "complete") => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    const result = kind === "complete"
      ? await completeAppliedIdentityRequest({ requestId: request.id })
      : await (kind === "approve" ? approveResidentIdentityRequest : rejectResidentIdentityRequest)({ requestId: request.id, reason: note });
    setBusy(null);
    if (!result.ok) {
      setError(DECISION_ERRORS[result.reason] ?? DECISION_ERRORS.server_error);
      return;
    }
    const head = kind === "complete"
      ? "Запрос закрыт как выполненный. Профиль не изменялся, новой записи в журнале нет."
      : kind === "approve"
      ? result.alreadyApplied
        ? "Запрос закрыт: данные уже совпадали с запрошенными, повторной записи в журнал нет."
        : "Изменения применены и записаны в журнал аудита. Запрос закрыт."
      : "Запрос отклонён. Профиль не изменён.";
    onDone([head, result.notified ? "Резидентка получила уведомление." : "", result.warning ?? ""].filter(Boolean).join(" "));
  };

  return (
    <article data-testid="identity-request-card" className="rounded-xl border border-amber-200/35 bg-amber-200/[0.05] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-amber-100">Запрос резидентки на изменение</p>
        <p className="text-[11px] text-zinc-400">
          Подан {fmtDate(request.created_at)} · <span data-testid="request-status" className="text-amber-200">{IDENTITY_REQUEST_STATUS_RU[request.status] ?? request.status}</span>
        </p>
      </div>
      {p ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <th className="py-1.5 pr-3 font-medium">Поле</th>
                <th className="py-1.5 pr-3 font-medium">Сейчас в профиле</th>
                <th className="py-1.5 font-medium">Предлагает резидентка</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f} data-testid={`request-row-${f}`} className="border-t border-zinc-800/70">
                  <td className="py-2 pr-3 text-zinc-400">{IDENTITY_FIELD_LABEL_RU[f]}</td>
                  <td className="py-2 pr-3 text-zinc-300">{show(f, current[f])}</td>
                  <td className="py-2 font-semibold text-amber-100">{show(f, p[f]?.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-400">
            <span className="text-zinc-500">Комментарий резидентки: </span>
            <span data-testid="request-comment" className="whitespace-pre-wrap text-zinc-300">{p.comment ?? "—"}</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-rose-200/80">
          Изменения в запросе не распознаны. Откройте его в <Link href="/admin/concierge" className="underline">«Консьерже»</Link>; исправить данные можно через «Edit identity».
        </p>
      )}
      {mode === "complete" && (
        <p data-testid="request-already-fixed" className="mt-3 rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200/90">
          {plan?.kind === "already_applied"
            ? "Данные в профиле уже совпадают с запрошенными."
            : `Данные изменены вручную ${fmtDate(request.manualChangeAt)}, после подачи запроса (есть запись в журнале).`}
          {" "}Запрос можно закрыть без повторного изменения профиля.
        </p>
      )}
      {mode === "stale" && (
        <p data-testid="request-stale" className="mt-3 text-xs text-rose-200/80">
          Данные в профиле отличаются от тех, что были при подаче, а ручной правки после подачи в журнале нет. Сверьте значения: исправьте через «Edit identity» или отклоните запрос.
        </p>
      )}
      <label className="mt-4 block space-y-1.5">
        <span className={label}>{mode === "complete" ? "Комментарий (нужен только для Reject)" : "Комментарий к решению (обязательно)"}</span>
        <textarea
          name="decision-note"
          value={note}
          maxLength={1000}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === "complete" ? "Для Reject: причина отказа — отправляется резидентке." : "Одобрение: «сверено с паспортом» — пишется в журнал аудита. Отказ: причина — отправляется резидентке."}
          className={input}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mode === "complete" ? (
          <button
            type="button"
            onClick={() => decide("complete")}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-300 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "complete" ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Завершить: данные уже исправлены
          </button>
        ) : (
          <button
            type="button"
            onClick={() => decide("approve")}
            disabled={busy !== null || mode !== "apply"}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/50 bg-amber-200 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve &amp; Apply
          </button>
        )}
        <button
          type="button"
          onClick={() => decide("reject")}
          disabled={busy !== null}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-400/40 px-3.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "reject" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reject
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    </article>
  );
}

export default function ResidentIdentityEditor({
  profileId,
  citizenship,
  birthDate,
  identityLocked,
  kycLevel,
  submissions,
  activeRequests,
  closedRequests,
}: {
  profileId: string;
  citizenship: string | null;
  birthDate: string | null;
  /** KYC отправлен на проверку или подтверждён (public.voyage_identity_locked) */
  identityLocked: boolean;
  kycLevel: number | null;
  submissions: KycSubmissionItem[];
  activeRequests: IdentityRequestItem[];
  closedRequests: IdentityRequestItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cit, setCit] = useState(citizenship ?? "");
  const [dob, setDob] = useState(birthDate ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const current = { citizenship, birth_date: birthDate };

  const dirty = (cit.trim() || null) !== (citizenship ?? null) || (dob || null) !== (birthDate ?? null);
  const level = Math.max(0, Math.min(3, Number(kycLevel ?? 0)));
  const latestByLevel = [1, 2]
    .map((l) => submissions.find((s) => s.level === l))
    .filter((s): s is KycSubmissionItem => Boolean(s));

  const openEdit = () => {
    setCit(citizenship ?? "");
    setDob(birthDate ?? "");
    setReason("");
    setMessage(null);
    setEditing(true);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const patch: { citizenship?: string | null; birth_date?: string | null } = {};
    if ((cit.trim() || null) !== (citizenship ?? null)) patch.citizenship = cit;
    if ((dob || null) !== (birthDate ?? null)) patch.birth_date = dob;
    const result = await saveResidentIdentityAndCloseRequests({ profileId, ...patch, reason });
    setBusy(false);
    if (!result.ok) {
      setMessage({ ok: false, text: EDIT_ERRORS[result.reason] ?? EDIT_ERRORS.server_error });
      return;
    }
    setEditing(false);
    const closedNote = result.closedRequests.length
      ? result.closedRequests.every((r) => r.notified)
        ? "Запрос резидентки выполнен и закрыт, резидентка получила уведомление."
        : "Запрос резидентки выполнен и закрыт. Уведомление не ушло — напишите ей в «Консьерже»."
      : "";
    const openNote = result.openRequests
      ? "Активный запрос остался открытым: сохранённые значения не совпадают с запрошенными. Завершите или отклоните его."
      : "";
    setMessage({ ok: true, text: ["Сохранено. Изменение записано в журнал аудита.", closedNote, openNote, result.syncWarning ?? ""].filter(Boolean).join(" ") });
    router.refresh();
  };

  const decided = (text: string) => {
    setMessage({ ok: true, text });
    router.refresh();
  };

  return (
    <section aria-labelledby="identity-title" data-testid="identity-kyc" className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="identity-title" className="flex items-center gap-2 font-serif text-xl text-zinc-100">
          <Fingerprint size={18} className="text-amber-200/70" /> Identity &amp; KYC
        </h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${identityLocked ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-200/80" : "border-zinc-700/70 text-zinc-400"}`}>
          {identityLocked && <LockKeyhole size={11} />}
          {identityLocked ? "Под KYC — резидентка не может менять сама" : "Документы KYC не отправлены — резидентка может менять сама"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Гражданство"><span data-testid="identity-citizenship">{show("citizenship", citizenship)}</span></Stat>
        <Stat title="Дата рождения"><span data-testid="identity-birth-date" className="font-mono">{fmtBirth(birthDate)}</span></Stat>
        <Stat title="Статус KYC">
          <span data-testid="identity-kyc-status">{level}/3 · {KYC_LEVEL[level]}</span>
          {latestByLevel.map((s) => (
            <span key={s.level} className="mt-1 block text-[11px] text-zinc-500">{SUBMISSION_KIND[s.level] ?? `Уровень ${s.level}`}: {SUBMISSION_STATUS[s.status] ?? s.status}</span>
          ))}
        </Stat>
        <Stat title="Запрос на изменение">
          <span data-testid="identity-request-flag" className={activeRequests.length ? "text-amber-200" : "text-zinc-400"}>
            {activeRequests.length ? "Есть активный запрос" : "Нет активных запросов"}
          </span>
        </Stat>
      </div>

      {activeRequests.length > 0 && (
        <div className="mt-4 space-y-3">
          {activeRequests.map((r) => <RequestCard key={r.id} request={r} current={current} onDone={decided} />)}
        </div>
      )}

      <div className="mt-4">
        {!editing ? (
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/40 px-3.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/10"
          >
            <Pencil size={14} /> Edit identity
          </button>
        ) : (
          <div data-testid="identity-edit-form" className="rounded-xl border border-zinc-800 bg-black/20 p-4">
            <p className="text-xs leading-5 text-zinc-500">
              Только гражданство и дата рождения. Меняйте после сверки с документом — причина пишется в журнал аудита вместе со старым и новым значением.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className={label}>Гражданство</span>
                <input name="edit-citizenship" value={cit} maxLength={CITIZENSHIP_MAX} onChange={(e) => setCit(e.target.value)} className={input} />
              </label>
              <label className="space-y-1.5">
                <span className={label}>Дата рождения</span>
                <input name="edit-birth-date" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${input} font-mono`} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className={label}>Причина изменения (обязательно, в журнал)</span>
                <input name="edit-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Сверено с паспортом: ошибка в ранее внесённых данных" className={input} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy || !dirty}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/50 bg-amber-200 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setMessage(null); }}
                disabled={busy}
                className="inline-flex min-h-10 items-center rounded-lg border border-zinc-700 px-3.5 text-xs text-zinc-300 transition hover:bg-zinc-800/60"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`mt-2 text-xs ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>
        )}
      </div>

      {closedRequests.length > 0 && (
        <details className="mt-4 text-xs text-zinc-400">
          <summary className="cursor-pointer text-zinc-500">История запросов ({closedRequests.length})</summary>
          <ul className="mt-2 space-y-2">
            {closedRequests.map((r) => (
              <li key={r.id} data-testid="identity-request-history" className="rounded-lg border border-zinc-800/80 px-3 py-2">
                <span className={r.status === "done" ? "text-emerald-300" : "text-rose-300"}>{IDENTITY_REQUEST_STATUS_RU[r.status] ?? r.status}</span>
                {" · "}подан {fmtDate(r.created_at)}{r.resolved_at ? `, закрыт ${fmtDate(r.resolved_at)}` : ""}
                {r.proposal && (
                  <span className="block text-zinc-500">
                    {(["citizenship", "birth_date"] as const).filter((f) => r.proposal?.[f]).map((f) => `${IDENTITY_FIELD_LABEL_RU[f]}: ${show(f, r.proposal?.[f]?.from)} → ${show(f, r.proposal?.[f]?.to)}`).join(" · ")}
                  </span>
                )}
                {r.admin_feedback && <span className="mt-1 block whitespace-pre-wrap text-zinc-500">{r.admin_feedback}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
