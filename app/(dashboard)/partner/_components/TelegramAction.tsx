"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · TELEGRAM ACTION — app/(dashboard)/partner/_components/TelegramAction.tsx
 *
 * Кнопка для любого действия, которое уходит в Telegram через бота
 * (Voyage Concierge): напоминание, запрос подписи, одобрение KYC.
 *
 *   idle        «Напомнить»
 *   submitting  спиннер «Отправляем…», кнопка заблокирована (isSubmitting)
 *   sent        «Отправлено в Telegram» — повторно не нажать, без спама
 *   partial     отправлено, но у кого-то не подключён Telegram (имена ниже)
 *   throttled   уже напоминали за последние 6 ч — сервер не продублирует
 *   nobody      Telegram не подключён ни у кого из получателей
 *   empty       некому отправлять (все уже подписали / загрузили)
 *   error       не ушло — кнопку можно нажать ещё раз
 *
 * Пример для админки (одобрение KYC):
 *   <TelegramAction
 *     label="Одобрить KYC"
 *     run={async () => {
 *       await supabase.rpc("club_admin_set_kyc_level", { p_profile: id, p_level: 3 });
 *       return { queued: hasTelegram ? 1 : 0, missing: hasTelegram ? [] : [name], throttled: 0 };
 *     }}
 *   />
 *   Уведомление «KYC одобрен» ставит в очередь триггер в базе — отдельно
 *   ничего вызывать не нужно.
 * ──────────────────────────────────────────────────────────────────── */

import { useId, useState } from "react";
import { Check, Clock, Loader2, Send, ShieldAlert, Unlink, type LucideIcon } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { ActionError, type ActionFailure, type NotifyResult } from "../_lib/actions";

type Phase = "idle" | "submitting" | "sent" | "partial" | "throttled" | "nobody" | "empty" | "error";

type Dict = {
  sending: string;
  sent: (n: number) => string;
  throttled: string;
  throttledHint: string;
  nobody: string;
  empty: string;
  missing: (names: string) => string;
  retry: string;
  errors: Record<ActionFailure, string>;
};

const T: Record<Lang, Dict> = {
  EN: {
    sending: "Sending…",
    sent: (n) => (n > 1 ? `Sent to Telegram · ${n}` : "Sent to Telegram"),
    throttled: "Already reminded",
    throttledHint: "A reminder went out less than 6 hours ago — no repeat, no spam.",
    nobody: "No Telegram linked",
    empty: "Nobody to remind",
    missing: (n) => `No Telegram linked: ${n}`,
    retry: "Not sent · Retry",
    errors: {
      forbidden: "You don’t have access to this tour.",
      invalid: "Check the terms — something is filled in incorrectly.",
      locked: "The tour has started — terms can no longer change.",
      network: "No connection. Try again.",
      unknown: "Something went wrong. Try again.",
    },
  },
  RU: {
    sending: "Отправляем…",
    sent: (n) => (n > 1 ? `Отправлено в Telegram · ${n}` : "Уведомление отправлено в Telegram"),
    throttled: "Уже напомнили",
    throttledHint: "Напоминание ушло меньше 6 часов назад — повторять не будем, без спама.",
    nobody: "Telegram не подключён",
    empty: "Напоминать некому",
    missing: (n) => `Без Telegram: ${n}`,
    retry: "Не отправлено · Повторить",
    errors: {
      forbidden: "Нет доступа к этому туру.",
      invalid: "Проверьте условия — что-то заполнено неверно.",
      locked: "Тур уже начался — условия больше не меняются.",
      network: "Нет связи. Попробуйте ещё раз.",
      unknown: "Что-то пошло не так. Попробуйте ещё раз.",
    },
  },
  ES: {
    sending: "Enviando…",
    sent: (n) => (n > 1 ? `Enviado a Telegram · ${n}` : "Aviso enviado a Telegram"),
    throttled: "Ya se recordó",
    throttledHint: "Se envió un aviso hace menos de 6 horas: no se repite, sin spam.",
    nobody: "Telegram no vinculado",
    empty: "Nadie a quien avisar",
    missing: (n) => `Sin Telegram: ${n}`,
    retry: "No enviado · Reintentar",
    errors: {
      forbidden: "No tienes acceso a este tour.",
      invalid: "Revisa las condiciones: algo no es correcto.",
      locked: "El tour ya empezó: las condiciones no cambian.",
      network: "Sin conexión. Inténtalo de nuevo.",
      unknown: "Algo salió mal. Inténtalo de nuevo.",
    },
  },
  PT: {
    sending: "Enviando…",
    sent: (n) => (n > 1 ? `Enviado ao Telegram · ${n}` : "Aviso enviado ao Telegram"),
    throttled: "Já lembramos",
    throttledHint: "Um aviso saiu há menos de 6 horas — sem repetir, sem spam.",
    nobody: "Telegram não vinculado",
    empty: "Ninguém para lembrar",
    missing: (n) => `Sem Telegram: ${n}`,
    retry: "Não enviado · Tentar de novo",
    errors: {
      forbidden: "Você não tem acesso a este tour.",
      invalid: "Confira as condições — algo está incorreto.",
      locked: "O tour já começou — as condições não mudam mais.",
      network: "Sem conexão. Tente de novo.",
      unknown: "Algo deu errado. Tente de novo.",
    },
  },
};

function phaseOf(r: NotifyResult): Phase {
  if (r.queued > 0) return r.missing.length > 0 ? "partial" : "sent";
  if (r.throttled > 0) return "throttled";
  if (r.missing.length > 0) return "nobody";
  return "empty";
}

const BASE =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs tracking-wide transition active:scale-[0.98] disabled:active:scale-100 sm:min-h-9";

const LOOK: Record<"ghost" | "gold", Record<Phase, string>> = {
  ghost: {
    idle: "border border-zinc-700/80 bg-zinc-900/60 text-zinc-200 hover:border-amber-200/40 hover:text-amber-100",
    submitting: "border border-zinc-700/80 bg-zinc-900/60 text-zinc-400",
    sent: "border border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200",
    partial: "border border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200",
    throttled: "border border-zinc-700 bg-zinc-900/60 text-zinc-400",
    nobody: "border border-amber-400/30 bg-amber-400/[0.07] text-amber-200",
    empty: "border border-zinc-700 bg-zinc-900/60 text-zinc-400",
    error: "border border-rose-400/35 bg-rose-500/[0.08] text-rose-200 hover:border-rose-300/60",
  },
  gold: {
    idle: "bg-amber-200 font-medium text-zinc-950 shadow-[0_0_24px_-8px_rgba(253,230,138,0.6)] hover:bg-amber-100",
    submitting: "bg-amber-200/70 font-medium text-zinc-950",
    sent: "border border-emerald-400/25 bg-emerald-400/[0.07] font-medium text-emerald-200",
    partial: "border border-emerald-400/25 bg-emerald-400/[0.07] font-medium text-emerald-200",
    throttled: "border border-zinc-700 bg-zinc-900/60 text-zinc-400",
    nobody: "border border-amber-400/30 bg-amber-400/[0.07] text-amber-200",
    empty: "border border-zinc-700 bg-zinc-900/60 text-zinc-400",
    error: "border border-rose-400/35 bg-rose-500/[0.08] font-medium text-rose-200",
  },
};

export type TelegramActionProps = {
  label: string;
  run: () => Promise<NotifyResult>;
  variant?: "ghost" | "gold";
  icon?: LucideIcon;
  disabled?: boolean;
  /** Подпись под кнопкой: справа (в строках-уведомлениях) или слева */
  align?: "start" | "end";
  /** Текст успешной отправки вместо стандартного */
  sentLabel?: (n: number) => string;
  onDone?: (r: NotifyResult) => void;
  className?: string;
};

export function TelegramAction({
  label,
  run,
  variant = "ghost",
  icon: Icon = Send,
  disabled = false,
  align = "end",
  sentLabel,
  onDone,
  className = "",
}: TelegramActionProps) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const statusId = useId();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<NotifyResult | null>(null);
  const [failure, setFailure] = useState<ActionFailure | null>(null);

  const isSubmitting = phase === "submitting";
  // После результата кнопка остаётся в нём — повторное нажатие не плодит сообщения.
  // Исключение — ошибка: её можно повторить.
  const locked = disabled || isSubmitting || (phase !== "idle" && phase !== "error");

  async function handle() {
    if (locked) return;
    setPhase("submitting");
    setFailure(null);
    try {
      const r = await run();
      setResult(r);
      setPhase(phaseOf(r));
      onDone?.(r);
    } catch (e) {
      setFailure(e instanceof ActionError ? e.reason : "unknown");
      setPhase("error");
    }
  }

  const sent = (n: number) => (sentLabel ? sentLabel(n) : t.sent(n));
  const content: Record<Phase, { icon: LucideIcon; text: string }> = {
    idle: { icon: Icon, text: label },
    submitting: { icon: Loader2, text: t.sending },
    sent: { icon: Check, text: sent(result?.queued ?? 1) },
    partial: { icon: Check, text: sent(result?.queued ?? 1) },
    throttled: { icon: Clock, text: t.throttled },
    nobody: { icon: Unlink, text: t.nobody },
    empty: { icon: Check, text: t.empty },
    error: { icon: ShieldAlert, text: t.retry },
  };
  const { icon: PhaseIcon, text } = content[phase];

  const caption =
    phase === "error" && failure
      ? t.errors[failure]
      : result && result.missing.length > 0 && (phase === "partial" || phase === "nobody" || phase === "throttled")
        ? t.missing(result.missing.join(", "))
        : phase === "throttled"
          ? t.throttledHint
          : null;

  return (
    <div className={`flex flex-col gap-1 ${align === "end" ? "items-end text-right" : "items-start text-left"} ${className}`}>
      <button
        type="button"
        onClick={() => void handle()}
        disabled={locked}
        aria-busy={isSubmitting}
        aria-describedby={caption ? statusId : undefined}
        className={`${BASE} ${LOOK[variant][phase]} ${disabled && phase === "idle" ? "opacity-50" : ""}`}
      >
        <PhaseIcon className={`size-3.5 shrink-0 ${isSubmitting ? "motion-safe:animate-spin" : ""}`} aria-hidden />
        <span>{text}</span>
      </button>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={`max-w-[18rem] text-[11px] leading-snug ${phase === "error" ? "text-rose-300" : "text-zinc-500"} ${caption ? "" : "sr-only"}`}
      >
        {caption ?? (phase === "sent" || phase === "partial" ? text : "")}
      </p>
    </div>
  );
}
