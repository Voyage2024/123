"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · CONTRACT EDITOR — app/(dashboard)/partner/_components/ContractEditor.tsx
 *
 * Менеджер задаёт условия Digital Contract и отправляет их на подпись:
 *   · кто платит за перелёт и отель (менеджер / участница / пополам)
 *   · гонорар и валюта, схема выплаты — слова, которые увидит участница
 *   · окно бесплатной отмены
 *
 * Отправка = новая версия + подпись менеджера + запрос подписи участницам
 * в Telegram. Если условия уже были — видно, что именно меняется,
 * и предупреждение: старые подписи к новой версии не относятся.
 * ──────────────────────────────────────────────────────────────────── */

import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Banknote, BedDouble, Hourglass, Info, Plane, Send, type LucideIcon } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import type { ContractTerms, Payer } from "../_lib/command";
import type { NotifyResult } from "../_lib/actions";
import { TelegramAction } from "./TelegramAction";

const CURRENCIES = ["USD", "EUR", "AED", "AUD"] as const;
const SPLITS = ["50/50", "30/70", "100%"] as const;
const CANCEL_HOURS = [24, 48, 72, 168] as const;
const PAYERS: Payer[] = ["manager", "participant", "split"];
const MAX_SPLIT = 20;

export const DEFAULT_TERMS: ContractTerms = {
  flightPaidBy: "manager",
  hotelPaidBy: "manager",
  feeSplit: "50/50",
  feeAmount: null,
  feeCurrency: "USD",
  cancelFreeHours: 72,
};

type Dict = {
  locale: string;
  flight: string;
  hotel: string;
  fee: string;
  feePlaceholder: string;
  split: string;
  splitHint: string;
  cancel: string;
  cancelHint: string;
  cancelOption: (h: number) => string;
  payer: Record<Payer, string>;
  changes: string;
  noChanges: string;
  invalidFee: string;
  invalidSplit: string;
  newVersion: (v: number, prev: number) => string;
  firstVersion: (n: number) => string;
  submit: string;
  cancelEdit: string;
  sentLabel: (n: number) => string;
  none: string;
};

const ru = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
};

const T: Record<Lang, Dict> = {
  EN: {
    locale: "en-GB",
    flight: "Flight paid by",
    hotel: "Hotel paid by",
    fee: "Participant fee",
    feePlaceholder: "Amount",
    split: "Payment schedule",
    splitHint: "How the fee is paid out — the participant sees exactly these words.",
    cancel: "Free cancellation",
    cancelHint: "Earlier than this — no consequences. Later — recorded in her Pulse.",
    cancelOption: (h) => (h % 24 === 0 && h >= 168 ? `${h / 24} days` : `${h} h`),
    payer: { manager: "Manager", participant: "Participant", split: "Split" },
    changes: "What changes",
    noChanges: "Terms are the same as the current version.",
    invalidFee: "Enter the fee as a number, e.g. 1200.",
    invalidSplit: `Describe the schedule in up to ${MAX_SPLIT} characters.`,
    newVersion: (v, p) => `This creates v${v}. Signatures on v${p} won’t count — every party signs again. Earlier versions stay in the history.`,
    firstVersion: (n) => `${n} ${n === 1 ? "participant" : "participants"} will get the terms in Telegram. Sending them is your signature.`,
    submit: "Sign and send for signature",
    cancelEdit: "Cancel",
    sentLabel: (n) => `Sent for signature · ${n}`,
    none: "not set",
  },
  RU: {
    locale: "ru-RU",
    flight: "Перелёт оплачивает",
    hotel: "Отель оплачивает",
    fee: "Гонорар участницы",
    feePlaceholder: "Сумма",
    split: "Схема выплаты",
    splitHint: "Как выплачивается гонорар — участница увидит ровно эти слова.",
    cancel: "Бесплатная отмена",
    cancelHint: "Снялась раньше — без последствий. Позже — фиксируется в её Pulse.",
    cancelOption: (h) => (h % 24 === 0 && h >= 168 ? `${h / 24} ${ru(h / 24, "день", "дня", "дней")}` : `${h} ч`),
    payer: { manager: "Менеджер", participant: "Участница", split: "Пополам" },
    changes: "Что меняется",
    noChanges: "Условия совпадают с текущей версией.",
    invalidFee: "Укажите гонорар числом, например 1200.",
    invalidSplit: `Опишите схему не длиннее ${MAX_SPLIT} символов.`,
    newVersion: (v, p) => `Будет создана версия v${v}. Подписи v${p} перестанут действовать — каждая сторона подпишет заново. Прежние версии останутся в истории.`,
    firstVersion: (n) => `Условия получат в Telegram ${n} ${ru(n, "участница", "участницы", "участниц")}. Отправка — это ваша подпись.`,
    submit: "Подписать и отправить на подпись",
    cancelEdit: "Отмена",
    sentLabel: (n) => `Отправлено на подпись · ${n}`,
    none: "не задано",
  },
  ES: {
    locale: "es-ES",
    flight: "El vuelo lo paga",
    hotel: "El hotel lo paga",
    fee: "Honorario de la participante",
    feePlaceholder: "Importe",
    split: "Forma de pago",
    splitHint: "Cómo se paga el honorario: la participante verá exactamente estas palabras.",
    cancel: "Cancelación gratis",
    cancelHint: "Antes de esto, sin consecuencias. Después, queda en su Pulse.",
    cancelOption: (h) => (h % 24 === 0 && h >= 168 ? `${h / 24} días` : `${h} h`),
    payer: { manager: "Gerente", participant: "Participante", split: "A medias" },
    changes: "Qué cambia",
    noChanges: "Las condiciones son iguales a la versión actual.",
    invalidFee: "Indica el honorario con un número, p. ej. 1200.",
    invalidSplit: `Describe la forma de pago en ${MAX_SPLIT} caracteres como máximo.`,
    newVersion: (v, p) => `Se creará la v${v}. Las firmas de la v${p} dejan de valer: todas las partes firman de nuevo. Las versiones anteriores quedan en el historial.`,
    firstVersion: (n) => `${n} ${n === 1 ? "participante recibirá" : "participantes recibirán"} las condiciones en Telegram. Enviarlas es tu firma.`,
    submit: "Firmar y enviar a firma",
    cancelEdit: "Cancelar",
    sentLabel: (n) => `Enviado a firma · ${n}`,
    none: "sin definir",
  },
  PT: {
    locale: "pt-BR",
    flight: "Passagem paga por",
    hotel: "Hotel pago por",
    fee: "Cachê da participante",
    feePlaceholder: "Valor",
    split: "Forma de pagamento",
    splitHint: "Como o cachê é pago — a participante verá exatamente estas palavras.",
    cancel: "Cancelamento grátis",
    cancelHint: "Antes disso, sem consequências. Depois, fica registrado no Pulse dela.",
    cancelOption: (h) => (h % 24 === 0 && h >= 168 ? `${h / 24} dias` : `${h} h`),
    payer: { manager: "Gerente", participant: "Participante", split: "Dividido" },
    changes: "O que muda",
    noChanges: "As condições são iguais à versão atual.",
    invalidFee: "Informe o cachê em número, por ex. 1200.",
    invalidSplit: `Descreva a forma de pagamento em até ${MAX_SPLIT} caracteres.`,
    newVersion: (v, p) => `Será criada a v${v}. As assinaturas da v${p} deixam de valer — todas as partes assinam de novo. As versões anteriores ficam no histórico.`,
    firstVersion: (n) => `${n} ${n === 1 ? "participante receberá" : "participantes receberão"} as condições no Telegram. Enviar é a sua assinatura.`,
    submit: "Assinar e enviar para assinatura",
    cancelEdit: "Cancelar",
    sentLabel: (n) => `Enviado para assinatura · ${n}`,
    none: "não definido",
  },
};

/* ── мелкие элементы формы ─────────────────────────────────────── */

function Field({ label, icon: Icon, hint, children }: { label: string; icon: LucideIcon; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
        <Icon className="size-3.5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
        {label}
      </p>
      {children}
      {hint && <p className="text-[11px] leading-snug text-zinc-500">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  render,
  onChange,
  cols,
}: {
  label: string;
  value: T | null;
  options: readonly T[];
  render: (v: T) => string;
  onChange: (v: T) => void;
  cols: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-1.5 ${cols}`}>
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o)}
            className={`min-h-11 rounded-xl border px-3 text-xs tracking-wide transition sm:min-h-10 ${
              active
                ? "border-amber-200/50 bg-amber-200/10 text-amber-100 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.15)]"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            }`}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

// Ширину задаёт каждое поле само: w-full и w-24 в одном списке классов
// спорят, и побеждает тот, что позже в CSS, а не в разметке
const INPUT =
  "min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-200/15 sm:min-h-10";

/* ── редактор ───────────────────────────────────────────────────── */

export type ContractEditorProps = {
  /** Действующие условия; null — контракта ещё нет */
  current: ContractTerms | null;
  currentVersion: number | null;
  participants: number;
  onSubmit: (terms: ContractTerms) => Promise<NotifyResult>;
  onSent: (terms: ContractTerms, result: NotifyResult) => void;
  onCancel?: () => void;
};

export function ContractEditor({ current, currentVersion, participants, onSubmit, onSent, onCancel }: ContractEditorProps) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const feeId = useId();
  const splitId = useId();

  const [draft, setDraft] = useState<ContractTerms>(() => current ?? DEFAULT_TERMS);
  const [feeText, setFeeText] = useState(() => (current?.feeAmount != null ? String(current.feeAmount) : ""));
  const set = (patch: Partial<ContractTerms>) => setDraft((d) => ({ ...d, ...patch }));

  // Гонорар: пусто — не указан; «1 200,50» → 1200.5
  const fee = useMemo(() => {
    const raw = feeText.replace(/\s/g, "").replace(",", ".");
    if (!raw) return { ok: true, value: null as number | null };
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? { ok: true, value: n } : { ok: false, value: null };
  }, [feeText]);

  const terms: ContractTerms = { ...draft, feeSplit: draft.feeSplit.trim(), feeAmount: fee.value };
  const splitOk = terms.feeSplit.length > 0 && terms.feeSplit.length <= MAX_SPLIT;
  const valid = fee.ok && splitOk;

  const money = (v: number | null, c: string | null) =>
    v === null
      ? t.none
      : c
        ? new Intl.NumberFormat(t.locale, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(v)
        : String(v);

  const diff = current
    ? [
        current.flightPaidBy !== terms.flightPaidBy && { label: t.flight, from: t.payer[current.flightPaidBy], to: t.payer[terms.flightPaidBy] },
        current.hotelPaidBy !== terms.hotelPaidBy && { label: t.hotel, from: t.payer[current.hotelPaidBy], to: t.payer[terms.hotelPaidBy] },
        (current.feeAmount !== terms.feeAmount || current.feeCurrency !== terms.feeCurrency) && {
          label: t.fee,
          from: money(current.feeAmount, current.feeCurrency),
          to: money(terms.feeAmount, terms.feeCurrency),
        },
        current.feeSplit !== terms.feeSplit && { label: t.split, from: current.feeSplit, to: terms.feeSplit || t.none },
        current.cancelFreeHours !== terms.cancelFreeHours && {
          label: t.cancel,
          from: current.cancelFreeHours !== null ? t.cancelOption(current.cancelFreeHours) : t.none,
          to: terms.cancelFreeHours !== null ? t.cancelOption(terms.cancelFreeHours) : t.none,
        },
      ].filter((x): x is { label: string; from: string; to: string } => !!x)
    : [];

  const unchanged = !!current && diff.length === 0;
  const nextVersion = (currentVersion ?? 0) + 1;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6" noValidate>
      <div className="grid gap-6 md:grid-cols-2">
        <Field label={t.flight} icon={Plane}>
          <Segmented
            label={t.flight}
            value={draft.flightPaidBy}
            options={PAYERS}
            render={(p) => t.payer[p]}
            onChange={(p) => set({ flightPaidBy: p })}
            cols="grid-cols-3"
          />
        </Field>
        <Field label={t.hotel} icon={BedDouble}>
          <Segmented
            label={t.hotel}
            value={draft.hotelPaidBy}
            options={PAYERS}
            render={(p) => t.payer[p]}
            onChange={(p) => set({ hotelPaidBy: p })}
            cols="grid-cols-3"
          />
        </Field>

        <Field label={t.fee} icon={Banknote}>
          <div className="flex gap-2">
            <label htmlFor={feeId} className="sr-only">
              {t.fee}
            </label>
            <input
              id={feeId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t.feePlaceholder}
              value={feeText}
              onChange={(e) => setFeeText(e.target.value)}
              aria-invalid={!fee.ok}
              className={`${INPUT} min-w-0 flex-1 font-mono ${fee.ok ? "" : "border-rose-400/50"}`}
            />
            <select
              aria-label={`${t.fee} · currency`}
              value={draft.feeCurrency ?? "USD"}
              onChange={(e) => set({ feeCurrency: e.target.value })}
              className={`${INPUT} w-24 shrink-0 cursor-pointer appearance-none px-2 text-center font-mono`}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c} className="bg-zinc-900">
                  {c}
                </option>
              ))}
            </select>
          </div>
          {!fee.ok && <p className="text-[11px] text-rose-300">{t.invalidFee}</p>}
        </Field>

        <Field label={t.split} icon={Banknote} hint={t.splitHint}>
          <div className="flex flex-wrap gap-1.5">
            {SPLITS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={draft.feeSplit === s}
                onClick={() => set({ feeSplit: s })}
                className={`min-h-9 rounded-full border px-3 font-mono text-xs transition ${
                  draft.feeSplit === s
                    ? "border-amber-200/50 bg-amber-200/10 text-amber-100"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <label htmlFor={splitId} className="sr-only">
            {t.split}
          </label>
          <input
            id={splitId}
            type="text"
            maxLength={MAX_SPLIT}
            value={draft.feeSplit}
            onChange={(e) => set({ feeSplit: e.target.value })}
            aria-invalid={!splitOk}
            className={`${INPUT} w-full ${splitOk ? "" : "border-rose-400/50"}`}
          />
          {!splitOk && <p className="text-[11px] text-rose-300">{t.invalidSplit}</p>}
        </Field>
      </div>

      <Field label={t.cancel} icon={Hourglass} hint={t.cancelHint}>
        <Segmented
          label={t.cancel}
          value={draft.cancelFreeHours}
          options={CANCEL_HOURS}
          render={(h) => `≥ ${t.cancelOption(h)}`}
          onChange={(h) => set({ cancelFreeHours: h })}
          cols="grid-cols-2 sm:grid-cols-4"
        />
      </Field>

      {current && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.changes}</p>
          {diff.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">{t.noChanges}</p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {diff.map((d) => (
                <li key={d.label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-zinc-400">{d.label}:</span>
                  <span className="text-zinc-500 line-through decoration-zinc-600">{d.from}</span>
                  <ArrowRight className="size-3 shrink-0 text-amber-200/70" aria-hidden />
                  <span className="font-medium text-amber-100">{d.to}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-200/80" strokeWidth={1.5} aria-hidden />
        <p className="text-xs leading-relaxed text-zinc-300">
          {currentVersion !== null ? t.newVersion(nextVersion, currentVersion) : t.firstVersion(participants)}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-end gap-2 border-t border-zinc-800/80 pt-5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-xs text-zinc-400 transition hover:text-zinc-100 sm:min-h-9"
          >
            {t.cancelEdit}
          </button>
        )}
        <TelegramAction
          variant="gold"
          icon={Send}
          label={t.submit}
          disabled={!valid || unchanged}
          sentLabel={t.sentLabel}
          run={() => onSubmit(terms)}
          onDone={(r) => onSent(terms, r)}
        />
      </div>
    </form>
  );
}
