"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · DEAL ROOM — «Закрыть тур»
 * app/(dashboard)/partner/_components/CloseTourPanel.tsx
 *
 * Менеджер отмечает итог по каждой участнице (долетела / поздний срыв /
 * неявка / снята), при необходимости указывает страну тура и закрывает тур.
 * RPC partner_close_tour → тур closed → триггер начисляет баллы долетевшим
 * (миграция 20261020092000_partner_tour_completion_points.sql).
 * Показывается, только когда тур уже начался и ещё не закрыт.
 * ──────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { CheckCircle2, Flag, Loader2, Sparkles } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { closeTour, type CloseTourResult, type MemberOutcome } from "@/app/(dashboard)/partner/_lib/actions";
import { cormorant } from "@/app/components/profile/fonts";

type Dict = {
  eyebrow: string;
  title: string;
  text: string;
  outcome: Record<MemberOutcome, string>;
  country: string;
  countryHint: string;
  confirm: string;
  close: string;
  closing: string;
  cancel: string;
  done: (r: CloseTourResult) => string;
  failed: Record<"locked" | "invalid" | "forbidden" | "other", string>;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Tour finished",
    title: "Close the tour",
    text: "Mark how it went for each participant. Everyone who flew gets club points and a passport stamp right away; no-shows lower reliability.",
    outcome: { flown: "Flew", late_drop: "Late drop", no_show: "No-show", released: "Released" },
    country: "Country (ISO, e.g. AE)",
    countryHint: "Needed for the passport stamp if it isn’t set on the tour.",
    confirm: "Closing is final: the tour becomes read-only and points are awarded.",
    close: "Close tour · award points",
    closing: "Closing…",
    cancel: "Cancel",
    done: (r) => `Tour closed: ${r.flown} flew, ${r.dropped} dropped. Points awarded: ${r.pointsAwarded}.`,
    failed: {
      locked: "The tour has already been closed or cancelled.",
      invalid: "Check the country code and the marks.",
      forbidden: "Only the tour’s manager can close it.",
      other: "Couldn’t close the tour — try again.",
    },
  },
  RU: {
    eyebrow: "Тур завершён",
    title: "Закрыть тур",
    text: "Отметьте итог по каждой участнице. Долетевшие сразу получают баллы клуба и штамп в паспорт; неявка снижает надёжность.",
    outcome: { flown: "Долетела", late_drop: "Поздний срыв", no_show: "Неявка", released: "Снята" },
    country: "Страна (ISO, например AE)",
    countryHint: "Нужна для штампа в паспорте, если не указана в туре.",
    confirm: "Закрытие окончательное: комната станет только для чтения, баллы начислятся.",
    close: "Закрыть тур · начислить баллы",
    closing: "Закрываем…",
    cancel: "Отмена",
    done: (r) => `Тур закрыт: долетели ${r.flown}, сорвались ${r.dropped}. Начислено баллов: ${r.pointsAwarded}.`,
    failed: {
      locked: "Тур уже закрыт или отменён.",
      invalid: "Проверьте код страны и отметки.",
      forbidden: "Закрыть тур может только его менеджер.",
      other: "Не удалось закрыть тур — повторите.",
    },
  },
  ES: {
    eyebrow: "Tour terminado",
    title: "Cerrar el tour",
    text: "Marca el resultado de cada participante. Las que volaron reciben al instante puntos del club y un sello en el pasaporte; las ausencias bajan la fiabilidad.",
    outcome: { flown: "Voló", late_drop: "Baja tardía", no_show: "Ausencia", released: "Liberada" },
    country: "País (ISO, p. ej. AE)",
    countryHint: "Necesario para el sello si el tour no lo tiene.",
    confirm: "El cierre es definitivo: la sala queda de solo lectura y se otorgan los puntos.",
    close: "Cerrar tour · otorgar puntos",
    closing: "Cerrando…",
    cancel: "Cancelar",
    done: (r) => `Tour cerrado: volaron ${r.flown}, bajas ${r.dropped}. Puntos otorgados: ${r.pointsAwarded}.`,
    failed: {
      locked: "El tour ya está cerrado o cancelado.",
      invalid: "Revisa el código de país y las marcas.",
      forbidden: "Solo el gerente del tour puede cerrarlo.",
      other: "No se pudo cerrar el tour: inténtalo de nuevo.",
    },
  },
  PT: {
    eyebrow: "Tour concluído",
    title: "Fechar o tour",
    text: "Marque o resultado de cada participante. Quem voou recebe na hora pontos do clube e um carimbo no passaporte; ausências reduzem a confiabilidade.",
    outcome: { flown: "Voou", late_drop: "Desistência tardia", no_show: "Ausência", released: "Liberada" },
    country: "País (ISO, ex. AE)",
    countryHint: "Necessário para o carimbo se o tour não tiver.",
    confirm: "O fechamento é definitivo: a sala fica só leitura e os pontos são creditados.",
    close: "Fechar tour · creditar pontos",
    closing: "Fechando…",
    cancel: "Cancelar",
    done: (r) => `Tour fechado: voaram ${r.flown}, desistências ${r.dropped}. Pontos creditados: ${r.pointsAwarded}.`,
    failed: {
      locked: "O tour já foi fechado ou cancelado.",
      invalid: "Verifique o código do país e as marcações.",
      forbidden: "Só o gerente do tour pode fechá-lo.",
      other: "Não foi possível fechar o tour — tente de novo.",
    },
  },
};

const OUTCOMES: MemberOutcome[] = ["flown", "late_drop", "no_show", "released"];

export function CloseTourPanel({
  tourId,
  participants,
  onClosed,
}: {
  tourId: string;
  participants: { id: string; name: string }[];
  onClosed: () => void;
}) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, MemberOutcome>>({});
  const [country, setCountry] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<keyof Dict["failed"] | null>(null);
  const [result, setResult] = useState<CloseTourResult | null>(null);

  const countryOk = country === "" || /^[A-Z]{2}$/.test(country);

  const submit = async () => {
    setState("sending");
    setError(null);
    try {
      const outcomes = Object.fromEntries(participants.map((p) => [p.id, marks[p.id] ?? "flown"]));
      const r = await closeTour(tourId, outcomes, country || null);
      setResult(r);
      setState("done");
      onClosed();
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      const reason = (e as { reason?: string })?.reason;
      setError(
        /already_closed|cancelled|not_started/.test(msg)
          ? "locked"
          : reason === "invalid"
            ? "invalid"
            : reason === "forbidden"
              ? "forbidden"
              : "other",
      );
      setState("idle");
    }
  };

  if (state === "done" && result) {
    return (
      <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" strokeWidth={1.5} aria-hidden />
        {t.done(result)}
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-200/20 bg-gradient-to-b from-amber-200/[0.05] to-zinc-900/30 p-5 backdrop-blur-xl md:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/10 text-amber-200">
          <Flag className="size-4" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">{t.eyebrow}</p>
          <h2 className={`${cormorant.className} mt-1 text-2xl font-medium text-zinc-50`}>{t.title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">{t.text}</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-200 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100"
          >
            <Sparkles className="size-4" aria-hidden />
            {t.close}
          </button>
        )}
      </div>

      {open && (
        <form
          className="mt-5 border-t border-zinc-800/70 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (countryOk && state !== "sending") void submit();
          }}
        >
          <ul className="space-y-2">
            {participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{p.name}</span>
                <div role="radiogroup" aria-label={p.name} className="flex flex-wrap gap-1.5">
                  {OUTCOMES.map((o) => {
                    const on = (marks[p.id] ?? "flown") === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setMarks((m) => ({ ...m, [p.id]: o }))}
                        className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[11px] transition ${
                          on
                            ? o === "flown"
                              ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                              : "border-rose-400/40 bg-rose-500/15 text-rose-100"
                            : "border-zinc-700/80 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        {t.outcome[o]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <label className="mt-4 block max-w-xs">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.country}</span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
              aria-invalid={!countryOk}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 font-mono text-sm uppercase tracking-widest text-zinc-100 focus:border-amber-200/40 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">{t.countryHint}</span>
          </label>

          <p className="mt-4 text-[11px] text-amber-200/70">{t.confirm}</p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {t.failed[error]}
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={state === "sending"}
              className="inline-flex min-h-11 items-center rounded-full border border-zinc-700 px-5 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!countryOk || state === "sending"}
              aria-busy={state === "sending"}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-200 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:opacity-50"
            >
              {state === "sending" && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
              {state === "sending" ? t.closing : t.close}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
