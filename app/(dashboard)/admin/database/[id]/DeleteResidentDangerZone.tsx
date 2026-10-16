"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  LockKeyhole,
  Skull,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeLang } from "@/lib/gamification";
import {
  DELETE_RESIDENT_COPY,
  DELETE_RESIDENT_PHRASES,
} from "@/lib/i18n/resident-deletion";
import { deleteResidentCompletely } from "@/app/actions/delete-resident";

type Props = {
  profileId: string;
  fullName: string;
};

export default function DeleteResidentDangerZone({ profileId, fullName }: Props) {
  const languageContext = useLanguage();
  const lang = normalizeLang(languageContext.lang);
  const t = DELETE_RESIDENT_COPY[lang];
  const requiredPhrase = DELETE_RESIDENT_PHRASES[lang];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closeModal is intentionally represented by these stable state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  const closeModal = () => {
    if (pending) return;
    setOpen(false);
    setStep(1);
    setPhrase("");
    setError(null);
  };

  const executeDeletion = () => {
    if (pending || phrase.trim() !== requiredPhrase) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteResidentCompletely(profileId, phrase, lang);
        if (result && !result.ok) {
          const failures = {
            invalid: t.errorInvalid,
            unauthenticated: t.errorUnauthenticated,
            forbidden: t.errorForbidden,
            not_found: t.errorNotFound,
            not_resident: t.errorNotResident,
            server_error: t.errorServer,
          };
          setError(failures[result.reason] ?? t.errorServer);
        }
      } catch {
        setError(t.errorServer);
      }
    });
  };

  const ariaStep = t.stepAria.replace("{step}", String(step));
  const confirmationLevel = t.confirmationLevel.replace("{step}", String(step));

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/20 via-zinc-950/80 to-zinc-950 p-5 shadow-[0_18px_70px_-45px_rgba(244,63,94,0.25)] sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-rose-500/[0.05] blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-rose-300/75">
              <LockKeyhole size={12} /> {t.protocolLabel}
            </p>
            <h2 className="mt-3 font-serif text-2xl text-rose-100">{t.dangerTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {t.dangerBodyBefore}{" "}
              <span className="font-medium text-zinc-200">{fullName}</span>{" "}
              {t.dangerBodyAfter}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setError(null); setOpen(true); }}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] px-4 py-3 text-xs font-semibold tracking-[0.08em] text-rose-200 transition duration-200 hover:border-rose-300/55 hover:bg-rose-500/[0.14] hover:text-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
          >
            <Trash2 size={14} /> {t.deleteButton}
          </button>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resident-delete-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-rose-400/20 bg-zinc-950 shadow-[0_25px_110px_-25px_rgba(0,0,0,0.9)]"
          >
            <div className="border-b border-zinc-800/80 bg-gradient-to-r from-rose-950/40 via-zinc-950 to-zinc-950 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.25em] text-rose-300/70">
                    <Skull size={13} /> {t.modalEyebrow}
                  </p>
                  <h3 id="resident-delete-title" className="mt-2 font-serif text-2xl text-zinc-50">
                    {t.modalTitle}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-500">
                    {t.subjectLabel}: {fullName} · {profileId.slice(0, 8)}…
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t.close}
                  disabled={pending}
                  onClick={closeModal}
                  className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2" aria-label={ariaStep}>
                {[1, 2, 3].map((number) => (
                  <div key={number} className={`h-1 rounded-full transition-colors ${number <= step ? "bg-rose-300/80" : "bg-zinc-800"}`} />
                ))}
              </div>
              <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-zinc-600">{confirmationLevel}</p>
            </div>

            <div className="px-5 py-6 sm:px-6">
              {step === 1 && (
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.06] text-amber-100">
                    <AlertTriangle size={20} />
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-zinc-100">{t.step1Title}</h4>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {t.step1BodyBefore}{" "}<span className="text-zinc-200">{fullName}</span>{" "}
                    {t.step1BodyAfter}{" "}<span className="text-amber-100/90">{t.step1Conscience}</span>
                  </p>
                  <p className="mt-3 rounded-xl border border-zinc-800 bg-black/20 p-3 text-xs leading-5 text-zinc-500">
                    {t.step1MafiaNote}
                  </p>
                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <button type="button" onClick={closeModal} className="rounded-lg border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition hover:text-zinc-100">{t.cancel}</button>
                    <button type="button" onClick={() => setStep(2)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200/25 bg-amber-200/[0.07] px-4 py-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/[0.12]">
                      {t.step1Continue} <Zap size={13} />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/[0.06] text-rose-200">
                    <Skull size={20} />
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-zinc-100">{t.step2Title}</h4>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{t.step2Body}</p>
                  <div className="mt-4 space-y-2 rounded-xl border border-rose-400/15 bg-rose-950/10 p-4">
                    <p className="flex items-start gap-2 text-xs leading-5 text-rose-100/85"><Check size={13} className="mt-0.5 shrink-0" /> {t.bulletKyc}</p>
                    <p className="flex items-start gap-2 text-xs leading-5 text-rose-100/85"><Check size={13} className="mt-0.5 shrink-0" /> {t.bulletTelegram}</p>
                    <p className="flex items-start gap-2 text-xs leading-5 text-rose-100/85"><Check size={13} className="mt-0.5 shrink-0" /> {t.bulletAuth}</p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">{t.restoreWarning}</p>
                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => setStep(1)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition hover:text-zinc-100"><ArrowLeft size={13} /> {t.back}</button>
                    <button type="button" onClick={() => setStep(3)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/[0.09] px-4 py-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/[0.15]">
                      {t.step2Continue} <ArrowLeft size={13} className="rotate-180" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/[0.06] text-rose-200">
                    <LockKeyhole size={20} />
                  </div>
                  <h4 className="mt-4 text-lg font-semibold text-zinc-100">{t.step3Title}</h4>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{t.step3Body}</p>
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-4">
                    <p className="font-mono text-xs leading-6 tracking-wide text-amber-100">{requiredPhrase}</p>
                  </div>
                  <label htmlFor="resident-delete-phrase" className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {t.phraseLabel}
                  </label>
                  <input
                    id="resident-delete-phrase"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={phrase}
                    onChange={(event) => { setPhrase(event.target.value); setError(null); }}
                    disabled={pending}
                    placeholder={t.phrasePlaceholder}
                    className="mt-2 min-h-12 w-full rounded-xl border border-zinc-800 bg-black/30 px-4 py-3 font-mono text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-rose-300/35 focus:ring-2 focus:ring-rose-300/10 disabled:opacity-50"
                  />
                  {error && <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] px-3 py-2 text-xs leading-5 text-rose-200">{error}</p>}
                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <button type="button" disabled={pending} onClick={() => { setStep(2); setError(null); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition hover:text-zinc-100 disabled:opacity-40"><ArrowLeft size={13} /> {t.back}</button>
                    <button
                      type="button"
                      onClick={executeDeletion}
                      disabled={pending || phrase.trim() !== requiredPhrase}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/35 bg-rose-500/[0.12] px-4 py-3 text-xs font-bold tracking-[0.05em] text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-500/[0.2] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/50 disabled:text-zinc-600"
                    >
                      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      {pending ? t.pending : t.finalButton}
                    </button>
                  </div>
                  <p className="mt-4 text-center text-[10px] leading-5 text-zinc-700">{t.footer}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
